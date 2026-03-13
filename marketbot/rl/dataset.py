"""Dataset helpers for replay logs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator


def iter_jsonl(path: str | Path) -> Iterator[dict[str, Any]]:
    """Yield JSONL records from disk."""
    source = Path(path)
    if not source.exists():
        return
    with source.open("r", encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if not text:
                continue
            yield json.loads(text)


def load_market_signal_rollouts(path: str | Path) -> list[dict[str, Any]]:
    """Load all market signal rollout events from a JSONL file."""
    return list(iter_jsonl(path))


def build_market_signal_dataset_records(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize rollout events into lightweight training records."""
    records: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        features = event.get("features") if isinstance(event.get("features"), dict) else {}
        decision = event.get("decision") if isinstance(event.get("decision"), dict) else {}
        result = event.get("result") if isinstance(event.get("result"), dict) else {}
        structured_action = decision.get("structured_action") if isinstance(decision.get("structured_action"), dict) else {}
        symbol = str(features.get("symbol", "")).upper()
        if not symbol:
            continue
        prompt = (
            f"Analyze {symbol} with price_change_pct={features.get('price_change_pct', 0.0)}, "
            f"news_sentiment={features.get('news_sentiment', 0.0)}, "
            f"social_sentiment={features.get('social_sentiment', 0.0)}, "
            f"macro_risk={features.get('macro_risk', 0.0)}."
        )
        records.append(
            {
                "id": f"market_signal_{index}",
                "prompt": prompt,
                "task": {
                    "symbol": symbol,
                    "objective": "predict structured market action",
                },
                "features": features,
                "label": {
                    "action": structured_action.get("action", result.get("action")),
                    "position_pct": structured_action.get("position_pct", result.get("positionPct")),
                    "stop_loss_pct": structured_action.get("stop_loss_pct", result.get("stopLossPct")),
                    "confidence": structured_action.get("confidence", result.get("confidence")),
                    "score": decision.get("score", result.get("score")),
                },
                "metadata": {
                    "event": event.get("event"),
                    "timestamp": event.get("ts"),
                    "policy_name": decision.get("policy_name"),
                    "policy_mode": decision.get("policy_mode"),
                },
            }
        )
    return records


def build_market_episode_dataset_records(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize episode rollout events into episode-level training records."""
    records: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        if str(event.get("event", "")).strip() != "market_signal_episode":
            continue
        task = event.get("task") if isinstance(event.get("task"), dict) else {}
        signal = event.get("signal") if isinstance(event.get("signal"), dict) else {}
        environment = event.get("environment") if isinstance(event.get("environment"), dict) else {}
        evaluation = environment.get("evaluation") if isinstance(environment.get("evaluation"), dict) else {}
        reward = evaluation.get("reward") if isinstance(evaluation.get("reward"), dict) else {}
        structured_action = signal.get("structuredAction") if isinstance(signal.get("structuredAction"), dict) else {}
        symbol = str(task.get("symbol", "")).upper()
        prices = [float(item) for item in task.get("prices", []) if item is not None]
        if not symbol or len(prices) < 2:
            continue
        prompt = (
            f"Trade {symbol} over an offline episode with {len(prices)} prices and "
            f"evaluate the structured action for reward optimization."
        )
        records.append(
            {
                "id": f"market_episode_{index}",
                "prompt": prompt,
                "task": {
                    "task_key": task.get("taskKey"),
                    "symbol": symbol,
                    "prices": prices,
                    "requested_steps": task.get("requestedSteps"),
                    "objective": "maximize episode reward",
                },
                "trajectory": {
                    "signal": {
                        "action": structured_action.get("action", signal.get("action")),
                        "position_pct": structured_action.get("position_pct", signal.get("positionPct")),
                        "confidence": structured_action.get("confidence", signal.get("confidence")),
                        "score": signal.get("score"),
                    },
                    "actions": evaluation.get("actionHistory", []),
                    "final_snapshot": evaluation.get("finalSnapshot"),
                    "final_portfolio": evaluation.get("finalPortfolio"),
                },
                "reward": reward,
                "metadata": {
                    "event": event.get("event"),
                    "timestamp": event.get("ts"),
                    "turnover": evaluation.get("turnover"),
                    "max_drawdown": evaluation.get("maxDrawdown"),
                },
            }
        )
    return records


def detect_rollout_type(events: list[dict[str, Any]]) -> str:
    """Detect dataset conversion type from rollout events."""
    kinds = {str(event.get("event", "")).strip() for event in events if isinstance(event, dict)}
    if "market_signal_episode" in kinds:
        return "episode"
    return "signal"


def write_jsonl(path: str | Path, records: list[dict[str, Any]]) -> Path:
    """Write records to JSONL."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return target

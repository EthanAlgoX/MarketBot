"""Episode collection helpers for offline market signal rollouts."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from marketbot.agent.tools.market import MarketSignalTool
from marketbot.rl.env.market_env import LocalMarketEnv


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def collect_market_signal_episode(
    *,
    config: Any,
    workspace: Path,
    symbol: str,
    prices: list[float],
    price_change_pct: float | None,
    news_sentiment: float,
    social_sentiment: float,
    macro_risk: float,
    evidence: list[str],
    task_key: str,
    steps: int = 0,
    drawdown_coef: float = 0.5,
    turnover_coef: float = 0.02,
    slippage_bps: float = 5.0,
) -> dict[str, Any]:
    """Collect one offline episode by mapping market_signal output into the local env."""
    signal_tool = MarketSignalTool(config=config.tools.market, workspace=workspace)
    signal_payload = json.loads(
        asyncio.run(
            signal_tool.execute(
                symbol=symbol,
                priceChangePct=price_change_pct,
                newsSentiment=news_sentiment,
                socialSentiment=social_sentiment,
                macroRisk=macro_risk,
                evidence=evidence,
            )
        )
    )

    task_meta = {
        "symbol": symbol,
        "prices": [float(item) for item in prices],
        "instruction": f"Trade {symbol} using MarketBot market_signal output.",
        "objective": "evaluate structured market signal action",
        "max_position_pct": float(config.tools.market.risk.max_position_pct),
        "drawdown_coef": float(drawdown_coef),
        "turnover_coef": float(turnover_coef),
        "slippage_bps": float(slippage_bps),
    }
    env = LocalMarketEnv(task_catalog={task_key: task_meta})
    lease = asyncio.run(env.allocate(task_key, request_id="rl_collect"))
    lease_id = str(lease["lease_id"])
    reset = asyncio.run(env.reset(lease_id, task_meta=task_meta, run_ctx={"uid": "rl_collect"}))

    structured_action = (
        signal_payload.get("structuredAction")
        if isinstance(signal_payload.get("structuredAction"), dict)
        else {}
    )
    action = str(structured_action.get("action", signal_payload.get("action", "watch"))).lower()
    position_pct = float(structured_action.get("position_pct", signal_payload.get("positionPct", 0.0)) or 0.0)
    submit_payload = json.loads(
        asyncio.run(
            env.exec_tool(
                lease_id,
                "submit_trade_action",
                {
                    "action": action,
                    "position_pct": position_pct,
                },
            )
        )
    )
    advance_steps = steps if steps > 0 else max(len(prices) - 1, 1)
    advance_payload = json.loads(asyncio.run(env.exec_tool(lease_id, "advance_time", {"steps": advance_steps})))
    evaluation = env.evaluate_details(lease_id)
    asyncio.run(env.close(lease_id))

    return {
        "ts": _utc_now_iso(),
        "event": "market_signal_episode",
        "task": {
            "taskKey": task_key,
            "symbol": symbol,
            "prices": [float(item) for item in prices],
            "requestedSteps": advance_steps,
        },
        "signal": signal_payload,
        "environment": {
            "reset": reset,
            "submit": submit_payload,
            "advance": advance_payload,
            "evaluation": evaluation,
        },
    }


def append_episode_log(path: str | Path, event: dict[str, Any]) -> Path:
    """Append an episode event to JSONL."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return target

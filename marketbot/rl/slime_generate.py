"""Minimal Slime-compatible rollout entrypoint for MarketBot RL tasks."""

from __future__ import annotations

import json
import os
from inspect import isawaitable
from typing import Any

from marketbot.agent.tools.market import MarketSignalTool
from marketbot.config.schema import MarketToolsConfig
from marketbot.rl.env.market_env import LocalMarketEnv
from marketbot.rl.env.remote_client import RemoteMarketEnvClient


def _coerce_task_meta(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    nested = value.get("task")
    if isinstance(nested, dict):
        return nested
    return value


def _task_meta_from_sample(sample: Any) -> dict[str, Any]:
    prompt = getattr(sample, "prompt", None)
    task_meta = _coerce_task_meta(prompt)
    if task_meta is not None:
        return task_meta
    if isinstance(prompt, str):
        text = prompt.strip()
        if text.startswith("{"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            task_meta = _coerce_task_meta(parsed)
            if task_meta is not None:
                return task_meta
    metadata = getattr(sample, "metadata", None)
    if isinstance(metadata, dict):
        task_meta = _coerce_task_meta(metadata.get("task_meta"))
        if task_meta is not None:
            return task_meta
        task_meta = _coerce_task_meta(metadata.get("task"))
        if task_meta is not None:
            return task_meta
    raise ValueError("sample prompt must be a dict-like task payload for marketbot.rl.slime_generate")


def _infer_signal_inputs(task_meta: dict[str, Any]) -> tuple[str, list[float], dict[str, Any]]:
    symbol = str(task_meta.get("symbol") or "UNKNOWN").upper()
    prices = [float(item) for item in task_meta.get("prices", []) if item is not None]
    if len(prices) < 2:
        raise ValueError("task_meta.prices must contain at least two values")
    features = task_meta.get("features") if isinstance(task_meta.get("features"), dict) else {}
    price_change_pct = float(features.get("price_change_pct", 0.0) or 0.0)
    if price_change_pct == 0.0 and prices[0] != 0:
        price_change_pct = ((prices[1] / prices[0]) - 1.0) * 100.0
    return symbol, prices, {
        "priceChangePct": price_change_pct,
        "newsSentiment": float(features.get("news_sentiment", 0.0) or 0.0),
        "socialSentiment": float(features.get("social_sentiment", 0.0) or 0.0),
        "macroRisk": float(features.get("macro_risk", 0.0) or 0.0),
        "evidence": list(features.get("evidence", []) or []),
    }


async def generate(args: Any, sample: Any, sampling_params: dict[str, Any]) -> Any:
    """Run a local MarketBot rollout and attach reward metadata to the sample."""
    _ = args
    _ = sampling_params
    task_meta = _task_meta_from_sample(sample)
    symbol, prices, signal_inputs = _infer_signal_inputs(task_meta)

    signal_tool = MarketSignalTool(config=MarketToolsConfig())
    signal_payload = json.loads(await signal_tool.execute(symbol=symbol, **signal_inputs))
    structured_action = (
        signal_payload.get("structuredAction")
        if isinstance(signal_payload.get("structuredAction"), dict)
        else {}
    )

    env_task = {
        "symbol": symbol,
        "prices": prices,
        "instruction": str(task_meta.get("instruction") or f"Trade {symbol} in a local MarketBot rollout."),
        "objective": str(task_meta.get("objective") or "maximize episode reward"),
        "max_position_pct": float(task_meta.get("target_position_pct", 1.0) or 1.0),
    }
    env_server_url = str(os.getenv("ENV_SERVER_URL", "")).strip()
    task_key = str(task_meta.get("task_name") or "marketbot_slime_task")
    env: Any
    if env_server_url:
        env = RemoteMarketEnvClient(env_server_url)
    else:
        env = LocalMarketEnv(task_catalog={task_key: env_task})
    lease = await env.allocate(task_key, request_id="slime")
    lease_id = str(lease["lease_id"])
    await env.reset(lease_id, task_meta=env_task, run_ctx={"uid": "slime"})
    await env.exec_tool(
        lease_id,
        "submit_trade_action",
        {
            "action": str(structured_action.get("action", signal_payload.get("action", "watch"))).lower(),
            "position_pct": float(structured_action.get("position_pct", signal_payload.get("positionPct", 0.0)) or 0.0),
        },
    )
    await env.exec_tool(lease_id, "advance_time", {"steps": max(len(prices) - 1, 1)})
    details_method = getattr(env, "evaluate_details", None)
    if details_method is None:
        raise AttributeError("environment must expose evaluate_details for MarketBot rollout metadata")
    evaluation = details_method(lease_id)
    if isawaitable(evaluation):
        evaluation = await evaluation
    await env.close(lease_id)

    response_payload = {
        "structuredAction": structured_action,
        "reward": evaluation.get("reward", {}),
    }
    sample.response = json.dumps(response_payload, ensure_ascii=False, sort_keys=True)
    sample.response_length = len(sample.response)
    sample.reward = {"score": float(evaluation.get("reward", {}).get("score", 0.0))}
    metadata = getattr(sample, "metadata", None)
    if not isinstance(metadata, dict):
        metadata = {}
        sample.metadata = metadata
    metadata["task_meta"] = task_meta
    metadata["marketbot_eval"] = evaluation
    status_enum = getattr(type(sample), "Status", None)
    if status_enum is not None and hasattr(status_enum, "COMPLETED"):
        sample.status = status_enum.COMPLETED
    return sample

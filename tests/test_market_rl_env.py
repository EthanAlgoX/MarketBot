import asyncio
import json

from marketbot.rl.env.market_env import LocalMarketEnv


def _run(coro):
    return asyncio.run(coro)


def test_local_market_env_lifecycle_and_positive_reward() -> None:
    env = LocalMarketEnv(
        task_catalog={
            "spy_uptrend": {
                "symbol": "SPY",
                "prices": [100.0, 105.0, 110.0],
                "timestamps": [
                    "2026-03-10T09:30:00Z",
                    "2026-03-10T10:30:00Z",
                    "2026-03-10T11:30:00Z",
                ],
                "instruction": "Trade SPY during the morning session.",
                "max_position_pct": 1.0,
                "drawdown_coef": 0.5,
                "turnover_coef": 0.02,
                "slippage_bps": 5.0,
            }
        }
    )

    lease = _run(env.allocate("spy_uptrend", request_id="req-1"))
    lease_id = lease["lease_id"]
    reset = _run(env.reset(lease_id, task_meta={}, run_ctx={"uid": "u1"}))

    assert reset["task"]["symbol"] == "SPY"
    tool_names = [item["function"]["name"] for item in reset["tool_schemas"]]
    assert tool_names == ["market_snapshot", "portfolio_state", "submit_trade_action", "advance_time"]

    snapshot = json.loads(_run(env.exec_tool(lease_id, "market_snapshot", {})))
    assert snapshot["price"] == 100.0
    assert snapshot["step"] == 0

    submit = json.loads(
        _run(
            env.exec_tool(
                lease_id,
                "submit_trade_action",
                {"action": "buy", "position_pct": 0.5},
            )
        )
    )
    assert submit["applied"]["positionPct"] == 0.5

    advance = json.loads(_run(env.exec_tool(lease_id, "advance_time", {"steps": 2})))
    assert advance["done"] is True
    assert advance["portfolio"]["equity"] > 1.0
    assert advance["snapshot"]["price"] == 110.0

    score = _run(env.evaluate(lease_id))
    details = env.evaluate_details(lease_id)
    assert score == details["reward"]["score"]
    assert details["reward"]["realized_return"] > 0
    assert details["reward"]["score"] > 0

    _run(env.close(lease_id))
    try:
        env.evaluate_details(lease_id)
    except KeyError:
        pass
    else:  # pragma: no cover
        raise AssertionError("lease should be removed after close")


def test_local_market_env_applies_drawdown_and_turnover_penalties() -> None:
    env = LocalMarketEnv(
        task_catalog={
            "qqq_chop": {
                "symbol": "QQQ",
                "prices": [100.0, 90.0, 92.0],
                "max_position_pct": 1.0,
                "drawdown_coef": 0.6,
                "turnover_coef": 0.1,
                "slippage_bps": 10.0,
            }
        }
    )

    lease_id = _run(env.allocate("qqq_chop"))["lease_id"]
    _run(env.reset(lease_id, task_meta={}, run_ctx={}))
    _run(env.exec_tool(lease_id, "submit_trade_action", {"action": "buy", "position_pct": 1.0}))
    _run(env.exec_tool(lease_id, "advance_time", {"steps": 1}))
    _run(env.exec_tool(lease_id, "submit_trade_action", {"action": "flat"}))
    _run(env.exec_tool(lease_id, "advance_time", {"steps": 1}))

    details = env.evaluate_details(lease_id)
    reward = details["reward"]

    assert details["turnover"] == 2.0
    assert details["maxDrawdown"] > 0
    assert reward["realized_return"] < 0
    assert reward["max_drawdown_penalty"] > 0
    assert reward["turnover_penalty"] > 0
    assert reward["slippage_penalty"] > 0
    assert reward["score"] < reward["realized_return"]

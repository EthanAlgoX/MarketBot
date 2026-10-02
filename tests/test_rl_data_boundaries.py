"""Invalid data must not become bullish signals, full exposure, or replayable rollouts."""

import asyncio
import json

import pytest

from marketbot.rl.env.market_env import LocalMarketEnv
from marketbot.rl.policy import HeuristicMarketSignalPolicy, clamp
from marketbot.rl.recorder import MarketSignalRolloutRecorder
from marketbot.rl.types import MarketSignalFeatures


def _policy(**overrides):
    return HeuristicMarketSignalPolicy(**{"min_confidence": 0.58, "max_position_pct": 0.1, "stop_loss_pct": 0.03, "weights": (0.35, 0.30, 0.20, 0.15), **overrides})


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf"), "NaN", True])
@pytest.mark.parametrize("factor", ["price_change_pct", "news_sentiment", "social_sentiment", "macro_risk"])
def test_policy_rejects_nonfinite_factors_instead_of_clamping_into_signals(value, factor):
    features = MarketSignalFeatures(symbol="SPY", news_sentiment=1, social_sentiment=1)
    setattr(features, factor, value)
    with pytest.raises(ValueError, match="finite"):
        _policy().decide(features)


@pytest.mark.parametrize("field", ["min_confidence", "max_position_pct", "stop_loss_pct"])
def test_policy_rejects_nonfinite_risk_controls(field):
    with pytest.raises(ValueError, match="finite"):
        _policy(**{field: float("nan")})
    with pytest.raises(ValueError, match="bounds"):
        _policy(**{field: 2})


def test_policy_clamp_and_weights_cannot_admit_nonfinite_values():
    for value in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(ValueError, match="finite"):
            clamp(value, -1, 1)
        with pytest.raises(ValueError, match="finite"):
            _policy(weights=(0.35, value, 0.2, 0.15))
        with pytest.raises(ValueError, match="finite"):
            _policy().action_from_score(value)
    decision = _policy().decide(MarketSignalFeatures(symbol="SPY", price_change_pct=2.5, news_sentiment=0.3, social_sentiment=0.1))
    assert decision.score == 0.285
    assert decision.action.action == "watch"


@pytest.mark.parametrize("price", [0, -1, float("nan"), float("inf"), float("-inf"), "NaN", True])
def test_environment_rejects_invalid_prices_before_allocating_lease(price):
    env = LocalMarketEnv({"invalid": {"symbol": "SPY", "prices": [100, price]}})
    with pytest.raises(ValueError):
        asyncio.run(env.allocate("invalid"))
    assert env.status()["leaseCount"] == 0


@pytest.mark.parametrize("field", ["max_position_pct", "drawdown_coef", "turnover_coef", "slippage_bps"])
def test_environment_rejects_nonfinite_configuration_before_allocating(field):
    env = LocalMarketEnv({"invalid": {"symbol": "SPY", "prices": [100, 101], field: float("nan")}})
    with pytest.raises(ValueError, match="finite"):
        asyncio.run(env.allocate("invalid"))
    assert env.status()["leaseCount"] == 0


@pytest.mark.parametrize("position", [float("nan"), float("inf"), float("-inf"), "NaN", True, None])
def test_environment_invalid_position_does_not_mutate_portfolio(position):
    async def exercise():
        env = LocalMarketEnv({"one": {"symbol": "SPY", "prices": [100, 105]}})
        lease_id = (await env.allocate("one"))["lease_id"]
        before = env.evaluate_details(lease_id)
        with pytest.raises(ValueError, match="finite"):
            await env.exec_tool(lease_id, "submit_trade_action", {"action": "buy", "position_pct": position})
        assert env.evaluate_details(lease_id) == before

    asyncio.run(exercise())


def test_explicit_zero_buy_preserves_zero_exposure_and_omitted_size_uses_cap():
    async def exercise():
        env = LocalMarketEnv({"one": {"symbol": "SPY", "prices": [100, 105], "max_position_pct": 0.25}})
        lease_id = (await env.allocate("one"))["lease_id"]
        zero = json.loads(await env.exec_tool(lease_id, "submit_trade_action", {"action": "buy", "position_pct": 0}))
        assert zero["applied"]["positionPct"] == 0
        omitted = json.loads(await env.exec_tool(lease_id, "submit_trade_action", {"action": "buy"}))
        assert omitted["applied"]["positionPct"] == 0.25

    asyncio.run(exercise())


def test_arithmetic_overflow_is_rejected_before_mutating_episode_state():
    async def exercise():
        env = LocalMarketEnv({"one": {"symbol": "SPY", "prices": [1e-308, 1e308]}})
        lease_id = (await env.allocate("one"))["lease_id"]
        await env.exec_tool(lease_id, "submit_trade_action", {"action": "buy", "position_pct": 1})
        before = env.evaluate_details(lease_id)
        with pytest.raises(ValueError, match="finite"):
            await env.exec_tool(lease_id, "advance_time", {"steps": 1})
        assert env.evaluate_details(lease_id) == before

    asyncio.run(exercise())


@pytest.mark.parametrize("steps", [float("nan"), float("inf"), 1.5, 0, -1, True])
def test_advance_steps_require_positive_integer_without_mutation(steps):
    async def exercise():
        env = LocalMarketEnv({"one": {"symbol": "SPY", "prices": [100, 105]}})
        lease_id = (await env.allocate("one"))["lease_id"]
        with pytest.raises(ValueError, match="positive integer"):
            await env.exec_tool(lease_id, "advance_time", {"steps": steps})
        assert env.evaluate_details(lease_id)["step"] == 0

    asyncio.run(exercise())


def _write_rollout(recorder, *, features=None, result=None):
    features = features or MarketSignalFeatures(symbol="SPY", price_change_pct=1)
    decision = _policy().decide(MarketSignalFeatures(symbol="SPY", price_change_pct=1))
    return recorder.record(features=features, decision=decision, rendered_result=result or {"symbol": "SPY", "price": 123.5})


@pytest.mark.parametrize("relative", ["../outside.jsonl", "/tmp/outside.jsonl", "rl/../../outside.jsonl", "C:/outside.jsonl", "C:\\outside.jsonl", "."])
def test_rollout_path_escape_is_rejected_before_writes(tmp_path, relative):
    workspace = tmp_path / "workspace"
    recorder = MarketSignalRolloutRecorder(workspace, relative)
    with pytest.raises(ValueError):
        _write_rollout(recorder)
    assert not workspace.exists()


def test_rollout_symlink_escape_is_rejected(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "rl").symlink_to(outside, target_is_directory=True)
    recorder = MarketSignalRolloutRecorder(workspace, "rl/signals.jsonl")
    with pytest.raises(ValueError, match="symlink"):
        _write_rollout(recorder)
    assert list(outside.iterdir()) == []


def test_rollout_nonfinite_data_never_creates_or_appends_a_record(tmp_path):
    workspace = tmp_path / "workspace"
    recorder = MarketSignalRolloutRecorder(workspace, "rl/signals.jsonl")
    with pytest.raises(ValueError, match="finite"):
        _write_rollout(recorder, features=MarketSignalFeatures(symbol="SPY", price_change_pct=float("nan")))
    assert not workspace.exists()
    path = _write_rollout(recorder)
    original = path.read_bytes()
    with pytest.raises(ValueError, match="finite"):
        _write_rollout(recorder, result={"nested": [{"reward": float("inf")} ]})
    assert path.read_bytes() == original
    assert json.loads(original)["result"]["price"] == 123.5

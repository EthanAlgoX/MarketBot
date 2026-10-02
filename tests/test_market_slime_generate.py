import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum

import httpx
import pytest

from marketbot.rl.env.server import MarketEnvHttpServer
from marketbot.rl.slime_generate import generate


@dataclass
class _FakeSample:
    class Status(Enum):
        PENDING = "pending"
        COMPLETED = "completed"

    prompt: object
    response: str = ""
    response_length: int = 0
    reward: object = None
    metadata: dict = field(default_factory=dict)
    status: Status = Status.PENDING


def test_slime_generate_runs_signal_task_from_prompt_wrapper() -> None:
    sample = _FakeSample(
        prompt={
            "task": {
                "task_name": "market_signal::NVDA",
                "instruction": "Analyze NVDA and trade the local rollout.",
                "symbol": "NVDA",
                "prices": [100.0, 104.0, 108.0],
                "features": {
                    "price_change_pct": 4.0,
                    "news_sentiment": 0.8,
                    "social_sentiment": 0.6,
                    "macro_risk": 0.1,
                    "evidence": ["earnings beat", "AI demand"],
                },
                "target_position_pct": 0.1,
            }
        }
    )

    result = asyncio.run(generate(args=None, sample=sample, sampling_params={}))

    assert result is sample
    assert sample.status == _FakeSample.Status.COMPLETED
    assert isinstance(sample.reward, dict)
    assert sample.reward["score"] > 0
    payload = json.loads(sample.response)
    assert payload["structuredAction"]["action"] == "buy"
    assert payload["reward"]["score"] == sample.reward["score"]
    assert sample.metadata["task_meta"]["symbol"] == "NVDA"
    assert sample.metadata["marketbot_eval"]["symbol"] == "NVDA"


def test_slime_generate_runs_episode_task_from_json_prompt() -> None:
    sample = _FakeSample(
        prompt=json.dumps(
            {
                "task": {
                    "task_name": "market_episode::QQQ",
                    "instruction": "Trade QQQ over the local episode.",
                    "symbol": "QQQ",
                    "prices": [100.0, 98.0, 103.0],
                    "requested_steps": 2,
                    "signal": {"action": "watch", "position_pct": 0.0},
                    "reward": {"score": 0.0},
                }
            },
            ensure_ascii=False,
        )
    )

    result = asyncio.run(generate(args=None, sample=sample, sampling_params={"max_tokens": 64}))

    assert result is sample
    assert sample.status == _FakeSample.Status.COMPLETED
    assert isinstance(sample.reward, dict)
    assert "score" in sample.reward
    assert isinstance(sample.metadata["marketbot_eval"]["actionHistory"], list)
    assert sample.metadata["marketbot_eval"]["finalSnapshot"]["price"] == 103.0
    assert sample.response_length == len(sample.response)


def test_slime_generate_preserves_explicit_zero_position_limit(monkeypatch) -> None:
    monkeypatch.delenv("ENV_SERVER_URL", raising=False)
    sample = _FakeSample(prompt={"task": {
        "task_name": "zero-exposure", "symbol": "NVDA", "prices": [100, 104, 108],
        "features": {"price_change_pct": 4, "news_sentiment": 0.8, "social_sentiment": 0.6, "macro_risk": 0.1},
        "target_position_pct": 0,
    }})
    asyncio.run(generate(args=None, sample=sample, sampling_params={}))
    evaluation = sample.metadata["marketbot_eval"]
    assert json.loads(sample.response)["structuredAction"]["action"] == "buy"
    assert evaluation["finalPortfolio"]["positionPct"] == 0
    assert evaluation["turnover"] == 0
    assert evaluation["equity"] == 1
    assert sample.reward == {"score": 0}


@pytest.mark.parametrize("position", [True, None, float("nan"), float("inf"), -0.1, 1.1])
def test_slime_generate_rejects_invalid_position_limit(monkeypatch, position) -> None:
    monkeypatch.delenv("ENV_SERVER_URL", raising=False)
    sample = _FakeSample(prompt={"task": {
        "symbol": "NVDA", "prices": [100, 104], "target_position_pct": position,
    }})
    with pytest.raises(ValueError):
        asyncio.run(generate(args=None, sample=sample, sampling_params={}))
    assert sample.status == _FakeSample.Status.PENDING


def test_slime_generate_rejects_boolean_prices(monkeypatch) -> None:
    monkeypatch.delenv("ENV_SERVER_URL", raising=False)
    sample = _FakeSample(prompt={"task": {"symbol": "SPY", "prices": [True, 100]}})
    with pytest.raises(ValueError, match="booleans"):
        asyncio.run(generate(None, sample, {}))
    assert sample.status == _FakeSample.Status.PENDING


def test_remote_slime_failure_closes_allocated_lease(monkeypatch) -> None:
    server = MarketEnvHttpServer(host="127.0.0.1", port=0)
    server.start_in_thread()
    monkeypatch.setenv("ENV_SERVER_URL", server.base_url)
    sample = _FakeSample(prompt={"task": {
        "symbol": "SPY", "prices": [100, 105], "target_position_pct": True,
    }})
    try:
        with pytest.raises(httpx.HTTPStatusError):
            asyncio.run(generate(None, sample, {}))
        assert server.env.status()["leaseCount"] == 0
        assert sample.status == _FakeSample.Status.PENDING
    finally:
        server.shutdown()

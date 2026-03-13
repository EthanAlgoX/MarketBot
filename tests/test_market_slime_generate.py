import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum

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

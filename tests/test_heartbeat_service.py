import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from marketbot.heartbeat.service import HeartbeatService
from marketbot.providers.base import LLMResponse, ToolCallRequest


class DummyProvider:
    def __init__(self, responses: list[LLMResponse]):
        self._responses = list(responses)
        self.calls: list[dict] = []

    async def chat(self, *args, **kwargs) -> LLMResponse:
        self.calls.append(kwargs)
        if self._responses:
            return self._responses.pop(0)
        return LLMResponse(content="", tool_calls=[])


@pytest.mark.asyncio
async def test_start_is_idempotent(tmp_path) -> None:
    provider = DummyProvider([])

    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
        interval_s=9999,
        enabled=True,
    )

    await service.start()
    first_task = service._task
    await service.start()

    assert service._task is first_task

    service.stop()
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_decide_returns_skip_when_no_tool_call(tmp_path) -> None:
    provider = DummyProvider([LLMResponse(content="no tool call", tool_calls=[])])
    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
    )

    action, tasks = await service._decide("heartbeat content")
    assert action == "skip"
    assert tasks == ""


@pytest.mark.asyncio
async def test_decide_includes_current_time_context(tmp_path) -> None:
    provider = DummyProvider(
        [
            LLMResponse(
                content="",
                tool_calls=[
                    ToolCallRequest(id="hb_1", name="heartbeat", arguments={"action": "skip"})
                ],
            )
        ]
    )
    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
    )

    action, _ = await service._decide("Run something only at 09:30.")

    assert action == "skip"
    user_message = provider.calls[0]["messages"][1]["content"]
    assert "Current local time:" in user_message
    assert "Timezone:" in user_message


@pytest.mark.asyncio
async def test_trigger_now_executes_when_decision_is_run(tmp_path) -> None:
    (tmp_path / "HEARTBEAT.md").write_text("- [ ] do thing", encoding="utf-8")

    provider = DummyProvider([
        LLMResponse(
            content="",
            tool_calls=[
                ToolCallRequest(
                    id="hb_1",
                    name="heartbeat",
                    arguments={"action": "run", "tasks": "check open tasks"},
                )
            ],
        )
    ])

    called_with: list[str] = []

    async def _on_execute(tasks: str) -> str:
        called_with.append(tasks)
        return "done"

    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
        on_execute=_on_execute,
    )

    result = await service.trigger_now()
    assert result == "done"
    assert called_with == ["check open tasks"]


@pytest.mark.asyncio
async def test_trigger_now_returns_none_when_decision_is_skip(tmp_path) -> None:
    (tmp_path / "HEARTBEAT.md").write_text("- [ ] do thing", encoding="utf-8")

    provider = DummyProvider([
        LLMResponse(
            content="",
            tool_calls=[
                ToolCallRequest(
                    id="hb_1",
                    name="heartbeat",
                    arguments={"action": "skip"},
                )
            ],
        )
    ])

    async def _on_execute(tasks: str) -> str:
        return tasks

    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
        on_execute=_on_execute,
    )

    assert await service.trigger_now() is None


def test_extract_constraints_parses_marketbot_directives() -> None:
    content = """
<!-- marketbot:timezone America/New_York -->
<!-- marketbot:weekdays mon,tue,fri -->
<!-- marketbot:windows 09:20-09:40,15:55-16:10 -->
"""
    constraints = HeartbeatService._extract_constraints(content)
    assert constraints["timezone"] == "America/New_York"
    assert constraints["weekdays"] == {0, 1, 4}
    assert len(constraints["windows"]) == 2


def test_within_constraints_blocks_outside_market_window() -> None:
    content = """
<!-- marketbot:timezone America/New_York -->
<!-- marketbot:weekdays mon,tue,wed,thu,fri -->
<!-- marketbot:windows 09:20-09:40 -->
"""
    current = datetime(2026, 3, 9, 8, 0, tzinfo=ZoneInfo("America/New_York"))
    allowed, reason = HeartbeatService._within_constraints(content, now=current)
    assert allowed is False
    assert reason == "outside configured windows"


@pytest.mark.asyncio
async def test_trigger_now_skips_without_provider_call_when_outside_constraints(tmp_path, monkeypatch) -> None:
    (tmp_path / "HEARTBEAT.md").write_text(
        "<!-- marketbot:timezone America/New_York -->\n"
        "<!-- marketbot:weekdays mon,tue,wed,thu,fri -->\n"
        "<!-- marketbot:windows 09:20-09:40 -->\n",
        encoding="utf-8",
    )
    provider = DummyProvider([
        LLMResponse(
            content="",
            tool_calls=[ToolCallRequest(id="hb_1", name="heartbeat", arguments={"action": "run", "tasks": "x"})],
        )
    ])
    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
        on_execute=lambda tasks: asyncio.sleep(0, result=tasks),
    )

    monkeypatch.setattr(
        HeartbeatService,
        "_within_constraints",
        classmethod(lambda cls, content, now=None: (False, "outside configured windows")),
    )
    assert await service.trigger_now() is None
    assert provider.calls == []


@pytest.mark.asyncio
async def test_trigger_now_uses_market_heartbeat_spec_without_provider_call(tmp_path, monkeypatch) -> None:
    (tmp_path / "HEARTBEAT.md").write_text(
        "<!-- marketbot:mode market-report -->\n"
        "<!-- marketbot:symbols NVDA,SPY -->\n",
        encoding="utf-8",
    )
    provider = DummyProvider([
        LLMResponse(
            content="",
            tool_calls=[ToolCallRequest(id="hb_1", name="heartbeat", arguments={"action": "skip"})],
        )
    ])
    called_with: list[str] = []

    async def _on_execute(tasks: str) -> str:
        called_with.append(tasks)
        return "market-report"

    service = HeartbeatService(
        workspace=tmp_path,
        provider=provider,
        model="openai/gpt-4o-mini",
        on_execute=_on_execute,
    )

    monkeypatch.setattr(
        "marketbot.heartbeat.service.extract_market_heartbeat_spec",
        lambda content: {
            "mode": "market-report",
            "symbols": ["NVDA", "SPY"],
            "timezone": "America/New_York",
            "session": "premarket",
            "task": "Generate a premarket market report for symbols: NVDA, SPY.",
        },
    )

    result = await service.trigger_now()
    assert result == "market-report"
    assert called_with == ["Generate a premarket market report for symbols: NVDA, SPY."]
    assert provider.calls == []

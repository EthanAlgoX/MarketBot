import asyncio

from marketbot.agent import tool_runtime
from marketbot.agent.executor import AgentExecutor
from marketbot.agent.runner import AgentRunResult, AgentRunSpec, MarketAgentRunner


def test_agent_run_result_exposes_legacy_tuple() -> None:
    result = AgentRunResult(
        final_content="done",
        tools_used=["market_snapshot"],
        messages=[{"role": "assistant", "content": "done"}],
        usage={"total_tokens": 9},
    )

    assert result.as_legacy_tuple() == (
        "done",
        ["market_snapshot"],
        [{"role": "assistant", "content": "done"}],
        {"total_tokens": 9},
    )


def test_market_agent_runner_delegates_to_tool_runtime(monkeypatch) -> None:
    calls: list[tuple] = []

    async def _fake_run_agent_loop(loop, initial_messages, on_progress=None):
        calls.append((loop.name, initial_messages, on_progress is not None))
        return "ok", ["web_search"], [{"role": "assistant", "content": "ok"}], {"total_tokens": 3}

    monkeypatch.setattr(tool_runtime, "run_agent_loop", _fake_run_agent_loop)
    loop = type("Loop", (), {"name": "loop-1"})()

    result = asyncio.run(
        MarketAgentRunner(loop).run(
            AgentRunSpec(
                initial_messages=[{"role": "user", "content": "hello"}],
                on_progress=lambda *_args, **_kwargs: None,
            )
        )
    )

    assert result.final_content == "ok"
    assert result.tools_used == ["web_search"]
    assert result.usage == {"total_tokens": 3}
    assert calls == [("loop-1", [{"role": "user", "content": "hello"}], True)]


def test_agent_executor_uses_runner_contract() -> None:
    calls: list[AgentRunSpec] = []

    class _Runner:
        async def run(self, spec: AgentRunSpec) -> AgentRunResult:
            calls.append(spec)
            return AgentRunResult(
                final_content="done",
                tools_used=["market_news"],
                messages=[{"role": "assistant", "content": "done"}],
                usage={"total_tokens": 4},
            )

    loop = type("Loop", (), {"runner": _Runner(), "_active_allowed_tools": None})()

    result = asyncio.run(
        AgentExecutor(loop).execute_messages(
            [{"role": "user", "content": "scan"}],
            allowed_tools={"market_news"},
        )
    )

    assert result == (
        "done",
        ["market_news"],
        [{"role": "assistant", "content": "done"}],
        {"total_tokens": 4},
    )
    assert calls[0].initial_messages == [{"role": "user", "content": "scan"}]
    assert loop._active_allowed_tools is None

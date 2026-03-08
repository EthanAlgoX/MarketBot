from marketbot.agent.context import ContextBuilder
from marketbot.agent.loop import AgentLoop
from marketbot.session.manager import Session
from marketbot.providers.base import ToolCallRequest


def _mk_loop() -> AgentLoop:
    loop = AgentLoop.__new__(AgentLoop)
    loop._TOOL_RESULT_MAX_CHARS = 500
    return loop


def test_save_turn_skips_multimodal_user_when_only_runtime_context() -> None:
    loop = _mk_loop()
    session = Session(key="test:runtime-only")
    runtime = ContextBuilder._RUNTIME_CONTEXT_TAG + "\nCurrent Time: now (UTC)"

    loop._save_turn(
        session,
        [{"role": "user", "content": [{"type": "text", "text": runtime}]}],
        skip=0,
    )
    assert session.messages == []


def test_save_turn_keeps_image_placeholder_after_runtime_strip() -> None:
    loop = _mk_loop()
    session = Session(key="test:image")
    runtime = ContextBuilder._RUNTIME_CONTEXT_TAG + "\nCurrent Time: now (UTC)"

    loop._save_turn(
        session,
        [{
            "role": "user",
            "content": [
                {"type": "text", "text": runtime},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
            ],
        }],
        skip=0,
    )
    assert session.messages[0]["content"] == [{"type": "text", "text": "[image]"}]


def test_compress_tool_result_truncates_large_plain_text() -> None:
    result = AgentLoop._compress_tool_result("web_search", "A" * 2000)

    assert "tool output truncated for context efficiency" in result
    assert len(result) < 1700


def test_compress_tool_result_preserves_market_brief_payload() -> None:
    payload = '{"summary":"ok","signal":{"action":"watch"}}' * 80

    result = AgentLoop._compress_tool_result("market_brief", payload)

    assert result == payload


def test_parallel_safe_tool_policy_is_conservative() -> None:
    assert AgentLoop._is_parallel_safe_tool("market_snapshot") is True
    assert AgentLoop._is_parallel_safe_tool("web_search") is True
    assert AgentLoop._is_parallel_safe_tool("message") is False
    assert AgentLoop._is_parallel_safe_tool("exec") is False


def test_execute_tool_calls_keeps_original_order_while_parallelizing_safe_tools() -> None:
    import asyncio

    loop = _mk_loop()

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            await asyncio.sleep(0.01 if name != "message" else 0)
            return f"{name}:{params['value']}"

    loop.tools = _FakeRegistry()
    tool_calls = [
        ToolCallRequest(id="1", name="market_snapshot", arguments={"value": "a"}),
        ToolCallRequest(id="2", name="web_search", arguments={"value": "b"}),
        ToolCallRequest(id="3", name="message", arguments={"value": "c"}),
    ]

    results = asyncio.run(loop._execute_tool_calls(tool_calls))

    assert [(call.name, result) for call, result in results] == [
        ("market_snapshot", "market_snapshot:a"),
        ("web_search", "web_search:b"),
        ("message", "message:c"),
    ]


def test_execute_tool_calls_reuses_identical_calls_with_cache_note() -> None:
    import asyncio

    loop = _mk_loop()
    seen: list[tuple[str, dict]] = []

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            seen.append((name, params))
            await asyncio.sleep(0.01)
            return f"{name}:{params['value']}"

    loop.tools = _FakeRegistry()
    tool_calls = [
        ToolCallRequest(id="1", name="market_snapshot", arguments={"value": "same"}),
        ToolCallRequest(id="2", name="market_snapshot", arguments={"value": "same"}),
    ]

    results = asyncio.run(loop._execute_tool_calls(tool_calls))

    assert seen == [("market_snapshot", {"value": "same"})]
    assert results[0][1] == "market_snapshot:same"
    assert '"cached": true' in results[1][1]

from pathlib import Path
import asyncio

from marketbot.agent.context import ContextBuilder
from marketbot.agent.loop import AgentLoop
from marketbot.bus.events import InboundMessage
from marketbot.session.manager import Session
from marketbot.providers.base import ToolCallRequest
from marketbot.providers.base import LLMResponse


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


def test_execute_tool_calls_blocks_exec_for_broad_market_scan() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {"broad_market_scan": True}

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("exec should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="exec", arguments={"command": "echo hi"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "exec disabled for generic daily market scans" in results[0][1]


def test_execute_tool_calls_allows_exec_outside_broad_market_scan() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {}

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            return f"{name}:{params['command']}"

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="exec", arguments={"command": "echo hi"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert results == [(tool_call, "exec:echo hi")]


def test_tool_definitions_for_broad_market_scan_only_exposes_market_pipeline() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"broad_market_scan": True}

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "market_snapshot"}},
                {"type": "function", "function": {"name": "market_news"}},
                {"type": "function", "function": {"name": "market_macro"}},
                {"type": "function", "function": {"name": "market_brief"}},
                {"type": "function", "function": {"name": "market_fundamentals"}},
                {"type": "function", "function": {"name": "market_social_sentiment"}},
                {"type": "function", "function": {"name": "web_search"}},
                {"type": "function", "function": {"name": "exec"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == [
        {"type": "function", "function": {"name": "market_snapshot"}},
        {"type": "function", "function": {"name": "market_news"}},
        {"type": "function", "function": {"name": "market_macro"}},
        {"type": "function", "function": {"name": "market_brief"}},
    ]


def test_tool_definitions_for_normal_request_keep_full_set() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {}

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "market_snapshot"}},
                {"type": "function", "function": {"name": "web_search"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == [
        {"type": "function", "function": {"name": "market_snapshot"}},
        {"type": "function", "function": {"name": "web_search"}},
    ]


def test_normalize_market_brief_arguments_for_broad_market_scan() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"broad_market_scan": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "market_brief",
        {
            "includeFundamentals": True,
            "includeSocial": True,
            "includeChips": True,
            "includeMacro": True,
            "includeNews": True,
            "symbols": ["NVDA", "SPY"],
        },
    )

    assert normalized["includeFundamentals"] is False
    assert normalized["includeSocial"] is False
    assert normalized["includeChips"] is False
    assert normalized["includeMacro"] is True
    assert normalized["includeNews"] is True


def test_normalize_market_snapshot_arguments_for_broad_market_scan() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"broad_market_scan": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "market_snapshot",
        {"symbols": ["NVDA"], "includeMacro": True},
    )

    assert normalized["symbols"] == list(loop._BROAD_MARKET_SCAN_SNAPSHOT_SYMBOLS)
    assert normalized["includeMacro"] is False


def test_normalize_market_news_arguments_for_broad_market_scan() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"broad_market_scan": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "market_news",
        {"symbols": ["NVDA"], "limit": 99},
    )

    assert normalized["symbols"] == list(loop._BROAD_MARKET_SCAN_NEWS_SYMBOLS)
    assert normalized["limit"] == 12


def test_run_agent_loop_disables_tools_after_first_broad_market_scan_round() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 4
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "market_snapshot"}},
                {"type": "function", "function": {"name": "market_news"}},
                {"type": "function", "function": {"name": "market_macro"}},
                {"type": "function", "function": {"name": "market_brief"}},
                {"type": "function", "function": {"name": "exec"}},
            ]

        async def execute(self, name: str, params: dict) -> str:
            return f"{name}:{params}"

    class _FakeContext:
        @staticmethod
        def add_assistant_message(messages, content, tool_calls=None, **kwargs):
            updated = list(messages)
            entry = {"role": "assistant", "content": content}
            if tool_calls is not None:
                entry["tool_calls"] = tool_calls
            updated.append(entry)
            return updated

        @staticmethod
        def add_tool_result(messages, tool_call_id, tool_name, result):
            updated = list(messages)
            updated.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": tool_name,
                    "content": result,
                }
            )
            return updated

    responses = iter(
        [
            LLMResponse(
                content="",
                tool_calls=[ToolCallRequest(id="1", name="market_snapshot", arguments={})],
            ),
            LLMResponse(content="final answer", tool_calls=[]),
        ]
    )
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))
    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()

    final_content, tools_used, _, _ = asyncio.run(
        loop._run_agent_loop([{"role": "user", "content": "每日机会"}])
    )

    assert final_content == "final answer"
    assert tools_used == ["market_snapshot"]
    assert len(loop.provider.chat.await_args_list) == 2
    assert [d["function"]["name"] for d in loop.provider.chat.await_args_list[0].kwargs["tools"]] == [
        "market_snapshot",
        "market_news",
        "market_macro",
        "market_brief",
    ]
    assert loop.provider.chat.await_args_list[1].kwargs["tools"] == []


def test_run_agent_loop_auto_appends_market_brief_for_daily_opportunity() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 5
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "market_snapshot"}},
                {"type": "function", "function": {"name": "market_news"}},
                {"type": "function", "function": {"name": "market_macro"}},
                {"type": "function", "function": {"name": "market_brief"}},
                {"type": "function", "function": {"name": "exec"}},
            ]

        async def execute(self, name: str, params: dict) -> str:
            return f"{name}:{params}"

    class _FakeContext:
        @staticmethod
        def add_assistant_message(messages, content, tool_calls=None, **kwargs):
            updated = list(messages)
            entry = {"role": "assistant", "content": content}
            if tool_calls is not None:
                entry["tool_calls"] = tool_calls
            updated.append(entry)
            return updated

        @staticmethod
        def add_tool_result(messages, tool_call_id, tool_name, result):
            updated = list(messages)
            updated.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": tool_name,
                    "content": result,
                }
            )
            return updated

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    responses = iter(
        [
            LLMResponse(
                content="",
                tool_calls=[ToolCallRequest(id="1", name="market_snapshot", arguments={})],
            ),
            LLMResponse(content="final answer", tool_calls=[]),
        ]
    )
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))
    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()
    loop.processor = _FakeProcessor()

    final_content, tools_used, _, _ = asyncio.run(
        loop._run_agent_loop([{"role": "user", "content": "每日机会"}])
    )

    assert final_content == "final answer"
    assert tools_used == ["market_snapshot", "market_brief"]
    assert len(loop.provider.chat.await_args_list) == 2
    assert [d["function"]["name"] for d in loop.provider.chat.await_args_list[0].kwargs["tools"]] == [
        "market_snapshot",
        "market_news",
        "market_macro",
        "market_brief",
    ]
    assert loop.provider.chat.await_args_list[1].kwargs["tools"] == []


def test_persist_local_report_if_needed_writes_daily_market_markdown(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {
                "selected": [
                    {"name": "daily-market-opportunity"},
                ]
            }

    loop.processor = _FakeProcessor()

    report_path = loop._persist_local_report_if_needed(
        "# 📅 每日机会扫描\n\n今日无高置信机会，维持观察名单",
        request_text="每日机会",
    )

    assert report_path is not None
    assert report_path.exists()
    saved = report_path.read_text(encoding="utf-8")
    assert "# Daily Market Opportunity" in saved
    assert "- request: 每日机会" in saved
    assert "今日无高置信机会" in saved


def test_append_saved_report_path_includes_local_path() -> None:
    result = AgentLoop._append_saved_report_path("report body", Path("/tmp/report.md"))

    assert result == "report body\n\n已保存到本地: /tmp/report.md"


def test_build_response_metadata_collects_optional_fields() -> None:
    loop = _mk_loop()

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    loop.processor = _Processor()

    metadata = loop._build_response_metadata(
        msg_metadata={"message_id": "abc"},
        usage={"total_tokens": 42},
        explainability={"summary": "ok"},
        external_skill_suggestions=[{"name": "k8s-release"}],
        report_path=Path("/tmp/report.md"),
    )

    assert metadata["message_id"] == "abc"
    assert metadata["usage"] == {"total_tokens": 42}
    assert metadata["skill_routing"] == {"selected": [{"name": "market-report"}]}
    assert metadata["explainability"] == {"summary": "ok"}
    assert metadata["skill_install_suggestions"] == [{"name": "k8s-release"}]
    assert metadata["saved_report_path"] == "/tmp/report.md"


def test_finalize_response_content_applies_empty_fallback() -> None:
    loop = _mk_loop()
    loop._build_chat_explainability = lambda *_args, **_kwargs: None
    loop._build_external_skill_install_suggestions = lambda: []
    loop._append_chat_explainability = lambda content, _exp: content
    loop._append_external_skill_suggestions = lambda content, _sug: content
    loop._persist_local_report_if_needed = lambda content, request_text=None: None
    loop._append_saved_report_path = lambda content, _path: content

    final_content, explainability, suggestions, report_path = loop._finalize_response_content(
        None,
        all_msgs=[],
        channel="cli",
        request_text="hello",
        append_inline_explainability=True,
        empty_fallback="fallback text",
    )

    assert final_content == "fallback text"
    assert explainability is None
    assert suggestions == []
    assert report_path is None


def test_preview_message_content_truncates_long_inputs() -> None:
    preview = AgentLoop._preview_message_content("A" * 90)

    assert preview == ("A" * 80) + "..."


def test_prepare_system_turn_sets_context_and_builds_messages() -> None:
    loop = _mk_loop()
    calls: list[tuple] = []

    class _Processor:
        @staticmethod
        def get_recent_history(session):
            calls.append(("history", session.key))
            return [{"role": "user", "content": "old"}]

        @staticmethod
        def build_messages(**kwargs):
            calls.append(("build", kwargs["current_message"], kwargs["channel"], kwargs["chat_id"]))
            return [{"role": "system", "content": "prompt"}]

    loop.processor = _Processor()
    loop._set_tool_context = lambda channel, chat_id, message_id=None: calls.append(
        ("context", channel, chat_id, message_id)
    )
    session = Session(key="cli:direct")

    history, messages = loop._prepare_system_turn(
        session=session,
        channel="cli",
        chat_id="direct",
        current_message="ping",
        message_id="m1",
    )

    assert history == [{"role": "user", "content": "old"}]
    assert messages == [{"role": "system", "content": "prompt"}]
    assert calls == [
        ("context", "cli", "direct", "m1"),
        ("history", "cli:direct"),
        ("build", "ping", "cli", "direct"),
    ]


def test_build_bus_progress_callback_marks_progress_metadata() -> None:
    loop = _mk_loop()
    published = []

    class _Bus:
        @staticmethod
        async def publish_outbound(msg):
            published.append(msg)

    loop.bus = _Bus()
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="hello", metadata={"m": 1})

    callback = loop._build_bus_progress_callback(msg=msg)
    asyncio.run(callback("working", tool_hint=True))

    assert len(published) == 1
    outbound = published[0]
    assert outbound.content == "working"
    assert outbound.metadata["m"] == 1
    assert outbound.metadata["_progress"] is True
    assert outbound.metadata["_tool_hint"] is True


def test_run_user_turn_uses_shared_finalize_pipeline() -> None:
    loop = _mk_loop()
    session = Session(key="cli:direct")
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="hello")
    calls = []

    async def _fake_run_agent_loop(messages, on_progress=None):
        calls.append(("run", messages, on_progress is not None))
        return ("draft", None, [{"role": "assistant", "content": "draft"}], {"total_tokens": 3})

    loop._run_agent_loop = _fake_run_agent_loop
    loop._normalize_daily_opportunity_report = lambda content: f"normalized:{content}"
    loop._finalize_response_content = lambda *args, **kwargs: ("final", {"summary": "ok"}, [{"name": "x"}], Path("/tmp/r.md"))
    loop._record_completed_turn = lambda **kwargs: calls.append(("record", kwargs["history_len"], kwargs["usage"]))

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    loop.processor = _Processor()

    final_content, metadata = asyncio.run(
        loop._run_user_turn(
            msg=msg,
            session=session,
            history=[{"role": "user", "content": "old"}],
            initial_messages=[{"role": "system", "content": "prompt"}],
        )
    )

    assert final_content == "final"
    assert metadata["usage"] == {"total_tokens": 3}
    assert metadata["explainability"] == {"summary": "ok"}
    assert metadata["skill_install_suggestions"] == [{"name": "x"}]
    assert metadata["saved_report_path"] == "/tmp/r.md"
    assert calls[0] == ("run", [{"role": "system", "content": "prompt"}], True)
    assert calls[1] == ("record", 1, {"total_tokens": 3})


def test_append_chat_explainability_skips_daily_opportunity_inline_footer() -> None:
    loop = _mk_loop()

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    result = loop._append_chat_explainability(
        "# 📅 每日机会扫描",
        {"delivery": "inline", "inline_footer": "## Capability & Data Notes\n- Data reliability: ok"},
    )

    assert result == "# 📅 每日机会扫描"


def test_normalize_daily_opportunity_report_rewrites_header_suffix() -> None:
    loop = _mk_loop()

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    result = loop._normalize_daily_opportunity_report(
        "# 📅 每日机会扫描 | 2026-03-22 (周日)\n\n## 1. Market Regime\n- ok"
    )

    assert result is not None
    assert result.splitlines()[0] == "# 📅 每日机会扫描"


def test_normalize_daily_opportunity_report_backfills_required_sections() -> None:
    loop = _mk_loop()

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    result = loop._normalize_daily_opportunity_report("# 市场机会扫描 | 2026-03-22\n\n正文")

    assert result is not None
    assert result.startswith("# 📅 每日机会扫描")
    assert "## 1. Market Regime" in result
    assert "## 2. High-Conviction Setups" in result
    assert "## 3. Watchlist" in result
    assert "## 4. Invalidations" in result
    assert "## 5. Data Gaps" in result


def test_match_daily_opportunity_report_query() -> None:
    loop = _mk_loop()

    assert loop._match_daily_opportunity_report_query("每日机会保存地址在哪") is True
    assert loop._match_daily_opportunity_report_query("每日机会文档在哪") is True
    assert loop._match_daily_opportunity_report_query("每日机会") is False


def test_build_daily_opportunity_report_query_response_lists_recent_files(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path
    report_dir = tmp_path / "reports" / "daily-market-opportunity"
    report_dir.mkdir(parents=True)
    newest = report_dir / "20260322-000821-daily-market-opportunity.md"
    newest.write_text("ok", encoding="utf-8")

    content = loop._build_daily_opportunity_report_query_response()

    assert str(report_dir) in content
    assert str(newest) in content


def test_persist_local_report_if_needed_skips_error_payloads(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    report_path = loop._persist_local_report_if_needed(
        "Error: backend status 2013: invalid params",
        request_text="每日机会",
    )

    assert report_path is None


def test_persist_local_report_if_needed_skips_meta_queries(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    report_path = loop._persist_local_report_if_needed(
        "# 📅 每日机会扫描\n\n今日无高置信机会，维持观察名单",
        request_text="每日机会保存地址在哪",
    )

    assert report_path is None


def test_normalize_daily_opportunity_report_rewrites_pseudo_tool_output() -> None:
    loop = _mk_loop()

    class _FakeProcessor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "daily-market-opportunity"}]}

    loop.processor = _FakeProcessor()

    normalized = loop._normalize_daily_opportunity_report(
        "<minimax:tool_call>\n<invoke name=\"market_brief\"></invoke>\n</minimax:tool_call>"
    )

    assert normalized is not None
    assert "<minimax:tool_call>" not in normalized
    assert "今日无高置信机会" in normalized

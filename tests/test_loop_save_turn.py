from pathlib import Path
import asyncio
from types import SimpleNamespace

from marketbot.agent.context import ContextBuilder
from marketbot.agent import request_policy
from marketbot.agent import tool_runtime
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


def test_execute_tool_calls_blocks_exec_for_xiaohongshu_skill_when_cli_available() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {}
    loop._selected_skill_names = lambda: ["xiaohongshu-browser-research"]
    loop.context = SimpleNamespace(available_tools={"xiaohongshu_cli"})

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("exec should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="exec", arguments={"command": "echo hi"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "exec disabled for xiaohongshu-browser-research" in results[0][1]


def test_execute_tool_calls_blocks_exec_for_lark_request_when_lark_tools_available() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {"lark_request": True}
    loop.context = SimpleNamespace(available_tools={"lark_base", "exec"})

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("exec should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="exec", arguments={"command": "echo hi"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "exec disabled for Lark/Feishu structured requests" in results[0][1]


def test_execute_tool_calls_blocks_read_file_for_xiaohongshu_skill_when_cli_available() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {}
    loop._selected_skill_names = lambda: ["xiaohongshu-browser-research"]
    loop.context = SimpleNamespace(available_tools={"xiaohongshu_cli", "read_file"})

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("read_file should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="read_file", arguments={"path": "/tmp/demo.txt"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "read_file disabled for xiaohongshu-browser-research" in results[0][1]


def test_execute_tool_calls_blocks_list_dir_for_xiaohongshu_skill_when_cli_available() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {}
    loop._selected_skill_names = lambda: ["xiaohongshu-browser-research"]
    loop.context = SimpleNamespace(available_tools={"xiaohongshu_cli", "list_dir"})

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("list_dir should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="list_dir", arguments={"path": "/tmp"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "list_dir disabled for xiaohongshu-browser-research" in results[0][1]


def test_execute_tool_calls_blocks_browser_site_for_xiaohongshu_skill_when_cli_available() -> None:
    import asyncio

    loop = _mk_loop()
    loop._active_request_flags = {}
    loop._selected_skill_names = lambda: ["xiaohongshu-browser-research"]
    loop.context = SimpleNamespace(available_tools={"xiaohongshu_cli", "browser_site"})

    class _FakeRegistry:
        async def execute(self, name: str, params: dict) -> str:
            raise AssertionError("browser_site should be blocked before tool execution")

    loop.tools = _FakeRegistry()
    tool_call = ToolCallRequest(id="1", name="browser_site", arguments={"adapter": "xiaohongshu/search"})

    results = asyncio.run(loop._execute_tool_calls([tool_call]))

    assert len(results) == 1
    assert "browser_site disabled for xiaohongshu-browser-research" in results[0][1]


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
    loop._current_tool_rounds = 0

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


def test_tool_definitions_for_xiaohongshu_request_disable_tools_after_two_rounds() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"xiaohongshu_request": True, "xiaohongshu_research": True}
    loop._current_tool_rounds = 2

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "xiaohongshu_cli"}},
                {"type": "function", "function": {"name": "exec"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == []


def test_tool_definitions_for_xiaohongshu_request_only_exposes_xiaohongshu_cli() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"xiaohongshu_request": True}
    loop._current_tool_rounds = 0
    loop.context = SimpleNamespace(available_tools={"xiaohongshu_cli", "exec", "browser_site"})

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "xiaohongshu_cli"}},
                {"type": "function", "function": {"name": "exec"}},
                {"type": "function", "function": {"name": "browser_site"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == [{"type": "function", "function": {"name": "xiaohongshu_cli"}}]


def test_tool_definitions_for_twitter_request_only_exposes_twitter_cli() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_request": True}
    loop._current_tool_rounds = 0
    loop.context = SimpleNamespace(available_tools={"twitter_cli", "exec", "browser_site"})

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "twitter_cli"}},
                {"type": "function", "function": {"name": "exec"}},
                {"type": "function", "function": {"name": "browser_site"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == [{"type": "function", "function": {"name": "twitter_cli"}}]


def test_tool_definitions_for_twitter_request_disable_tools_after_first_round() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_request": True}
    loop._current_tool_rounds = 1
    loop.context = SimpleNamespace(available_tools={"twitter_cli", "exec", "browser_site"})

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "twitter_cli"}},
                {"type": "function", "function": {"name": "exec"}},
                {"type": "function", "function": {"name": "browser_site"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == []


def test_tool_definitions_for_lark_request_keep_full_set() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"lark_request": True}
    loop._current_tool_rounds = 0

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "lark_base"}},
                {"type": "function", "function": {"name": "exec"}},
            ]

    loop.tools = _FakeRegistry()

    defs = loop._tool_definitions_for_request()

    assert defs == [
        {"type": "function", "function": {"name": "lark_base"}},
        {"type": "function", "function": {"name": "exec"}},
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


def test_normalize_twitter_search_arguments_for_twitter_research() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_research": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "twitter_cli",
        {"operation": "search", "query": "NVDA guidance", "max_count": 30},
    )

    assert normalized["search_type"] == "Latest"
    assert normalized["max_count"] == 12
    assert normalized["exclude"] == ["replies", "retweets"]
    assert normalized["do_filter"] is True
    assert normalized["min_likes"] == 2
    assert normalized["query"] == "$NVDA guidance earnings revenue"


def test_normalize_twitter_search_arguments_preserves_existing_excludes() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_research": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "twitter_cli",
        {"operation": "search", "query": "NVDA guidance", "exclude": ["replies"], "max_count": 8},
    )

    assert normalized["search_type"] == "Latest"
    assert normalized["max_count"] == 8
    assert normalized["exclude"] == ["replies", "retweets"]


def test_normalize_twitter_search_arguments_forces_latest_over_top() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_research": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "twitter_cli",
        {"operation": "search", "query": "NVDA earnings guidance", "search_type": "Top", "max_count": 20},
    )

    assert normalized["search_type"] == "Latest"
    assert normalized["query"] == "$NVDA earnings guidance"


def test_normalize_twitter_search_arguments_skips_ticker_expansion_for_handles() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_research": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "twitter_cli",
        {"operation": "search", "query": "@elonmusk guidance", "max_count": 20},
    )

    assert normalized["query"] == "@elonmusk guidance"


def test_normalize_twitter_tweet_arguments_for_twitter_research() -> None:
    loop = _mk_loop()
    loop._active_request_flags = {"twitter_research": True}

    normalized = loop._normalize_tool_arguments_for_request(
        "twitter_cli",
        {"operation": "tweet", "target": "123", "max_count": 99},
    )

    assert normalized["max_count"] == 20


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


def test_run_agent_loop_only_exposes_xiaohongshu_cli_for_xiaohongshu_request() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 3
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None
    loop._BROAD_MARKET_SCAN_MARKERS = ()
    loop._DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"
    loop._selected_skill_names = lambda: ["xiaohongshu-browser-research"]
    loop._is_broad_market_scan_request = lambda messages: False
    loop._is_xiaohongshu_request = lambda messages: True
    loop._merge_usage = AgentLoop._merge_usage

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "xiaohongshu_cli"}},
                {"type": "function", "function": {"name": "exec"}},
                {"type": "function", "function": {"name": "browser_site"}},
            ]

        async def execute(self, name: str, params: dict) -> str:
            return f"{name}:{params}"

    class _FakeContext:
        available_tools = {"xiaohongshu_cli", "exec", "browser_site"}

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

    responses = iter([LLMResponse(content="final answer", tool_calls=[])])
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))
    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()

    final_content, tools_used, _, _ = asyncio.run(
        loop._run_agent_loop([{"role": "user", "content": "用小红书分析瑞幸咖啡"}])
    )

    assert final_content == "final answer"
    assert tools_used == []
    assert loop.provider.chat.await_count == 1
    assert loop.provider.chat.await_args.kwargs["tools"] == [
        {"type": "function", "function": {"name": "xiaohongshu_cli"}}
    ]


def test_run_agent_loop_only_exposes_twitter_cli_for_twitter_request() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 3
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None
    loop._BROAD_MARKET_SCAN_MARKERS = ()
    loop._DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"
    loop._selected_skill_names = lambda: ["twitter-browser-research"]
    loop._is_broad_market_scan_request = lambda messages: False
    loop._is_xiaohongshu_request = lambda messages: False
    loop._is_twitter_request = lambda messages: True
    loop._is_lark_request = lambda messages: False
    loop._merge_usage = AgentLoop._merge_usage

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "twitter_cli"}},
                {"type": "function", "function": {"name": "exec"}},
                {"type": "function", "function": {"name": "browser_site"}},
            ]

        async def execute(self, name: str, params: dict) -> str:
            return f"{name}:{params}"

    class _FakeContext:
        available_tools = {"twitter_cli", "exec", "browser_site"}

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

    responses = iter([LLMResponse(content="final answer", tool_calls=[])])
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))
    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()

    final_content, tools_used, _, _ = asyncio.run(
        loop._run_agent_loop([{"role": "user", "content": "分析这个 Twitter 话题情绪"}])
    )

    assert final_content == "final answer"
    assert tools_used == []
    assert loop.provider.chat.await_count == 1
    assert loop.provider.chat.await_args.kwargs["tools"] == [
        {"type": "function", "function": {"name": "twitter_cli"}}
    ]


def test_run_agent_loop_retries_when_model_returns_pseudo_tool_text_after_real_tools() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 5
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None
    loop._BROAD_MARKET_SCAN_MARKERS = ()
    loop._DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"
    loop._selected_skill_names = lambda: ["twitter-browser-research"]
    loop._is_broad_market_scan_request = lambda messages: False
    loop._is_xiaohongshu_request = lambda messages: False
    loop._is_twitter_request = lambda messages: True
    loop._is_lark_request = lambda messages: False
    loop._merge_usage = AgentLoop._merge_usage

    class _FakeRegistry:
        def get_definitions(self):
            return [{"type": "function", "function": {"name": "twitter_cli"}}]

        async def execute(self, name: str, params: dict) -> str:
            return '{"ok":true,"data":[{"id":"1","text":"nvda guidance discussion"}]}'

    class _FakeContext:
        available_tools = {"twitter_cli"}

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

    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(
        side_effect=[
            LLMResponse(
                content="",
                tool_calls=[ToolCallRequest(id="1", name="twitter_cli", arguments={"operation": "search"})],
            ),
            LLMResponse(
                content='<minimax:tool_call><invoke name="twitter_cli"></invoke></minimax:tool_call>',
                tool_calls=[],
            ),
            LLMResponse(content="Twitter 上关于 NVDA guidance 的讨论偏噪音，整体情绪中性偏多。"),
        ]
    )

    final_content, tools_used, messages, _usage = asyncio.run(
        tool_runtime.run_agent_loop(loop, [{"role": "user", "content": "分析 Twitter 上 NVDA guidance 讨论"}])
    )

    assert tools_used == ["twitter_cli"]
    assert "整体情绪中性偏多" in str(final_content)
    assert loop.provider.chat.await_count == 3
    assert loop.provider.chat.await_args_list[1].kwargs["tools"] == []
    assert loop.provider.chat.await_args_list[2].kwargs["tools"] == []
    assert any(
        isinstance(message, dict)
        and message.get("role") == "user"
        and "Do not call tools again" in str(message.get("content"))
        for message in messages
    )


def test_run_agent_loop_runs_market_news_fallback_when_twitter_empty() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 3
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None
    loop._BROAD_MARKET_SCAN_MARKERS = ()
    loop._DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"
    loop._selected_skill_names = lambda: ["twitter-browser-research"]
    loop._is_broad_market_scan_request = lambda messages: False
    loop._is_xiaohongshu_request = lambda messages: False
    loop._is_twitter_request = lambda messages: True
    loop._is_lark_request = lambda messages: False
    loop._merge_usage = AgentLoop._merge_usage

    class _FakeRegistry:
        def get_definitions(self):
            return [
                {"type": "function", "function": {"name": "twitter_cli"}},
                {"type": "function", "function": {"name": "market_news"}},
            ]

        async def execute(self, name: str, params: dict) -> str:
            if name == "twitter_cli":
                return '{"ok":true,"data":{"count":0,"results":[]}}'
            if name == "market_news":
                return '{"ok":true,"data":{"results":[{"headline":"fallback news"}]}}'
            return '{"ok":false}'

    class _FakeContext:
        available_tools = {"twitter_cli", "market_news"}

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

    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(
        side_effect=[
            LLMResponse(
                content="",
                tool_calls=[
                    ToolCallRequest(id="1", name="twitter_cli", arguments={"operation": "search", "query": "$NVDA guidance"}),
                ],
            ),
            LLMResponse(content="Final summary"),
        ]
    )

    final_content, tools_used, messages, _ = asyncio.run(
        tool_runtime.run_agent_loop(loop, [{"role": "user", "content": "分析 Twitter 上 NVDA guidance 讨论"}])
    )

    assert tools_used == ["twitter_cli", "market_news"]
    assert final_content == "Final summary"


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


def test_build_provider_error_fallback_uses_latest_tool_results() -> None:
    messages = [
        {"role": "user", "content": "查表结构"},
        {
            "role": "tool",
            "name": "lark_base",
            "content": '{"ok":true,"data":{"returned":2,"items":[{"name":"需求调研（ AI 分析）"},{"name":"🛠️问卷管理员配置"}]}}',
        },
    ]

    result = tool_runtime.build_provider_error_fallback(
        messages,
        tools_used=["lark_base"],
        provider_error="Error: Client error '403 Forbidden'",
    )

    assert result is not None
    assert "latest tool call succeeded" in result
    assert "需求调研（ AI 分析）" in result
    assert "403 Forbidden" in result


def test_run_agent_loop_returns_tool_fallback_when_provider_errors_after_tool_call() -> None:
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    loop = _mk_loop()
    loop.max_iterations = 3
    loop.model = "test-model"
    loop.temperature = 0.1
    loop.max_tokens = 512
    loop.reasoning_effort = None

    class _FakeRegistry:
        def get_definitions(self):
            return [{"type": "function", "function": {"name": "lark_base"}}]

        async def execute(self, name: str, params: dict) -> str:
            return '{"ok":true,"data":{"returned":2,"items":[{"name":"表A"},{"name":"表B"}]}}'

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
                tool_calls=[ToolCallRequest(id="1", name="lark_base", arguments={"action": "table_list"})],
            ),
            LLMResponse(content="Error: Client error '403 Forbidden'", tool_calls=[], finish_reason="error"),
        ]
    )
    loop.provider = MagicMock()
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))
    loop.tools = _FakeRegistry()
    loop.context = _FakeContext()

    final_content, tools_used, _, _ = asyncio.run(
        loop._run_agent_loop([{"role": "user", "content": "读 base 表"}])
    )

    assert tools_used == ["lark_base"]
    assert "latest tool call succeeded" in final_content
    assert "表A" in final_content


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
    loop._last_skill_fallback = {
        "used": True,
        "primarySkill": "xueqiu-research",
        "selectedFallback": "social-signal-browser",
        "finalSkill": "social-signal-browser",
        "fallbackSkills": ["social-signal-browser"],
    }

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
    assert metadata["skill_routing"] == {
        "selected": [{"name": "market-report"}],
        "fallbackExecution": {
            "used": True,
            "primarySkill": "xueqiu-research",
            "selectedFallback": "social-signal-browser",
            "finalSkill": "social-signal-browser",
            "fallbackSkills": ["social-signal-browser"],
        },
    }
    assert metadata["skill_fallback"]["primarySkill"] == "xueqiu-research"
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


def test_finalize_response_content_drops_explainability_for_publish_result() -> None:
    loop = _mk_loop()
    loop._build_chat_explainability = lambda *_args, **_kwargs: {
        "delivery": "inline",
        "inline_footer": "_Capability & Data_: Skills: xiaohongshu-browser-research",
    }
    loop._build_external_skill_install_suggestions = lambda: []
    loop._append_chat_explainability = lambda content, exp: AgentLoop._append_chat_explainability(loop, content, exp)
    loop._append_external_skill_suggestions = lambda content, _sug: content
    loop._persist_local_report_if_needed = lambda content, request_text=None: None
    loop._append_saved_report_path = lambda content, _path: content

    final_content, explainability, suggestions, report_path = loop._finalize_response_content(
        "推特发送失败：Twitter API error (HTTP 0): Twitter API returned errors: Authorization: Tweet needs to be a bit shorter. (186)",
        all_msgs=[],
        channel="feishu",
        request_text="发布一条推特",
        append_inline_explainability=False,
        empty_fallback=None,
    )

    assert final_content == "推特发送失败：Twitter API error (HTTP 0): Twitter API returned errors: Authorization: Tweet needs to be a bit shorter. (186)"
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


def test_run_user_turn_feishu_twitter_publish_skips_explainability_footer() -> None:
    loop = _mk_loop()
    session = Session(key="feishu:direct")
    msg = InboundMessage(
        channel="feishu",
        sender_id="user",
        chat_id="chat",
        content="发布一条推特，大概内容如下：\n\nMarketBot + 小红书 CLI\n总结：高价值场景聚焦",
    )

    class _FakeTools:
        @staticmethod
        def has(name: str) -> bool:
            return name == "twitter_cli"

        @staticmethod
        async def execute(name: str, params: dict) -> str:
            assert name == "twitter_cli"
            assert params["operation"] == "post"
            return '{"ok":true,"data":{"id":"1","url":"https://x.com/i/status/1"}}'

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "twitter-publisher"}]}

    async def _fake_retry(**kwargs):
        return [], None, None, None, {}

    recorded = []
    loop.tools = _FakeTools()
    loop.processor = _Processor()
    loop.workspace = Path("/tmp")
    loop.max_iterations = 3
    loop._run_agent_loop = lambda messages, on_progress=None: tool_runtime.run_agent_loop(loop, messages, on_progress=on_progress)
    loop._classify_skill_outcome = lambda **kwargs: "success"
    loop._retry_turn_with_fallback = _fake_retry
    loop._normalize_daily_opportunity_report = lambda content: content
    loop._build_chat_explainability = lambda messages, channel: AgentLoop._build_chat_explainability(loop, messages, channel=channel)
    loop._append_chat_explainability = lambda content, explainability: AgentLoop._append_chat_explainability(loop, content, explainability)
    loop._build_external_skill_install_suggestions = lambda: []
    loop._append_external_skill_suggestions = lambda content, suggestions: content
    loop._persist_local_report_if_needed = lambda content, request_text=None: None
    loop._append_saved_report_path = lambda content, report_path: content
    loop._finalize_response_content = lambda content, **kwargs: (
        content,
        loop._build_chat_explainability(kwargs["all_msgs"], channel=kwargs["channel"]),
        [],
        None,
    )
    loop._record_completed_turn = lambda **kwargs: recorded.append(kwargs)
    loop._build_response_metadata = lambda **kwargs: AgentLoop._build_response_metadata(loop, **kwargs)
    loop._build_bus_progress_callback = lambda **kwargs: (lambda *args, **kw: None)

    final_content, metadata = asyncio.run(
        loop._run_user_turn(
            msg=msg,
            session=session,
            history=[],
            initial_messages=[{"role": "user", "content": msg.content}],
        )
    )

    assert "推特已发送成功" in str(final_content)
    assert "explainability" not in metadata
    assert recorded[0]["tools_used"] == ["twitter_cli"]


def test_run_user_turn_feishu_twitter_publish_retries_with_shorter_cjk_text() -> None:
    loop = _mk_loop()
    session = Session(key="feishu:retry")
    msg = InboundMessage(
        channel="feishu",
        sender_id="user",
        chat_id="chat",
        content=(
            "发布一条推特，大概内容如下：\n\n"
            "MarketBot + 小红书 CLI\n"
            "总结：高价值场景聚焦\n"
            "舆情驱动交易：实时捕捉散户行为和热点，优化短线策略\n"
            "趋势挖掘与早期机会发现：新品、概念股、行业趋势\n"
            "散户心理分析：理解非理性行为，辅助量化和风控\n"
            "市场研究和投研辅助：产品设计、策略验证、闭环实验\n"
            "数据自动化和多模态融合：降低人工成本，拓展信号维度"
        ),
    )

    attempts: list[str] = []

    class _FakeTools:
        @staticmethod
        def has(name: str) -> bool:
            return name == "twitter_cli"

        @staticmethod
        async def execute(name: str, params: dict) -> str:
            assert name == "twitter_cli"
            if params["operation"] == "tweet":
                return '{"ok":true,"data":{"id":"2","media":[{"type":"photo"}]}}'
            assert params["operation"] == "post"
            attempts.append(params["text"])
            if len(attempts) == 1:
                return '{"ok":false,"error":{"message":"Twitter API error (HTTP 0): Twitter API returned errors: Authorization: Tweet needs to be a bit shorter. (186)"}}'
            return '{"ok":true,"data":{"id":"2","url":"https://x.com/i/status/2"}}'

    loop.tools = _FakeTools()

    result = asyncio.run(
        tool_runtime._direct_twitter_publish(loop, [{"role": "user", "content": msg.content}])
    )

    assert result is not None
    assert "推特已发送成功" in result
    assert len(attempts) == 2
    assert tool_runtime._twitter_weighted_length(attempts[1]) < tool_runtime._twitter_weighted_length(attempts[0])
    assert tool_runtime._twitter_weighted_length(attempts[1]) <= 240
    assert "｜" not in attempts[1]
    assert "\n" in attempts[1]
    assert "• " in attempts[1]


def test_direct_twitter_publish_attaches_auto_generated_image_by_default(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path
    calls: list[dict] = []

    class _FakeTools:
        @staticmethod
        def has(name: str) -> bool:
            return name == "twitter_cli"

        @staticmethod
        async def execute(name: str, params: dict) -> str:
            calls.append({"name": name, "params": dict(params)})
            if params["operation"] == "tweet":
                return '{"ok":true,"data":{"id":"3","media":[{"type":"photo"}]}}'
            return '{"ok":true,"data":{"id":"3","url":"https://x.com/i/status/3"}}'

    async def _fake_render(workspace: Path, text: str) -> tuple[Path, Path]:
        assert workspace == tmp_path
        assert "MarketBot + Twitter CLI" in text
        image_path = tmp_path / "generated" / "twitter" / "poster.png"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.write_bytes(b"png")
        return tmp_path / "generated" / "twitter" / "poster.html", image_path

    loop.tools = _FakeTools()
    original_render = tool_runtime._render_twitter_poster
    tool_runtime._render_twitter_poster = _fake_render
    try:
        result = asyncio.run(
            tool_runtime._direct_twitter_publish(
                loop,
                [{
                    "role": "user",
                    "content": "发布一条推特，内容如下：\n\nMarketBot + Twitter CLI\n总结：高价值场景聚焦",
                }],
            )
        )
    finally:
        tool_runtime._render_twitter_poster = original_render

    assert result is not None
    assert "推特已发送成功" in result
    assert calls == [
        {
            "name": "twitter_cli",
            "params": {
                "operation": "post",
                "text": "MarketBot + Twitter CLI\n• 总结：高价值场景聚焦",
                "images": [str(tmp_path / "generated" / "twitter" / "poster.png")],
            },
        },
        {
            "name": "twitter_cli",
            "params": {
                "operation": "tweet",
                "target": "3",
                "full_text": True,
                "max_count": 1,
            },
        },
    ]


def test_auto_generate_twitter_image_matches_natural_language_request() -> None:
    assert tool_runtime._should_auto_generate_twitter_image("发布这条推特，并自动生成一张 Twitter 配图")
    assert tool_runtime._should_auto_generate_twitter_image("发图文版推文，给这条内容配图")
    assert tool_runtime._should_auto_generate_twitter_image("post to twitter with an auto-generated poster")
    assert tool_runtime._should_auto_generate_twitter_image("发布一条推特，内容如下：NVDA demand still looks strong")
    assert not tool_runtime._should_auto_generate_twitter_image("发布一条推特，纯文本发，不要图，内容如下：NVDA demand still looks strong")


def test_direct_twitter_publish_retries_duplicate_with_small_text_variant(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path
    attempts: list[dict] = []

    class _FakeTools:
        @staticmethod
        def has(name: str) -> bool:
            return name == "twitter_cli"

        @staticmethod
        async def execute(name: str, params: dict) -> str:
            attempts.append(dict(params))
            if params["operation"] == "tweet":
                return '{"ok":true,"data":{"id":"4","media":[{"type":"photo"}]}}'
            if len(attempts) == 1:
                return '{"ok":false,"error":{"message":"Twitter API error (HTTP 0): Twitter API returned errors: Authorization: Status is a duplicate. (187)"}}'
            return '{"ok":true,"data":{"id":"4","url":"https://x.com/i/status/4"}}'

    async def _fake_render(workspace: Path, text: str) -> tuple[Path, Path]:
        image_path = tmp_path / "generated" / "twitter" / "poster.png"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.write_bytes(b"png")
        return tmp_path / "generated" / "twitter" / "poster.html", image_path

    loop.tools = _FakeTools()
    original_render = tool_runtime._render_twitter_poster
    tool_runtime._render_twitter_poster = _fake_render
    try:
        result = asyncio.run(
            tool_runtime._direct_twitter_publish(
                loop,
                [{
                    "role": "user",
                    "content": "发布一条推特，内容如下：\n\nMarketBot + Twitter CLI\n总结：高价值场景聚焦",
                }],
            )
        )
    finally:
        tool_runtime._render_twitter_poster = original_render

    assert result is not None
    assert "推特已发送成功" in result
    assert len(attempts) == 3
    assert attempts[0]["images"] == attempts[1]["images"]
    assert attempts[1]["text"].endswith("#MarketBot")
    assert attempts[2]["operation"] == "tweet"


def test_direct_twitter_publish_warns_when_media_verification_missing(tmp_path) -> None:
    loop = _mk_loop()
    loop.workspace = tmp_path

    class _FakeTools:
        @staticmethod
        def has(name: str) -> bool:
            return name == "twitter_cli"

        @staticmethod
        async def execute(name: str, params: dict) -> str:
            if params["operation"] == "tweet":
                return '{"ok":true,"data":{"id":"5","text":"hello"}}'
            return '{"ok":true,"data":{"id":"5","url":"https://x.com/i/status/5"}}'

    async def _fake_render(workspace: Path, text: str) -> tuple[Path, Path]:
        image_path = tmp_path / "generated" / "twitter" / "poster.png"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.write_bytes(b"png")
        return tmp_path / "generated" / "twitter" / "poster.html", image_path

    loop.tools = _FakeTools()
    original_render = tool_runtime._render_twitter_poster
    tool_runtime._render_twitter_poster = _fake_render
    try:
        result = asyncio.run(
            tool_runtime._direct_twitter_publish(
                loop,
                [{
                    "role": "user",
                    "content": "发布一条推特，内容如下：\n\nMarketBot + Twitter CLI\n总结：高价值场景聚焦",
                }],
            )
        )
    finally:
        tool_runtime._render_twitter_poster = original_render

    assert result is not None
    assert "未校验到配图已挂载" in result


def test_extract_twitter_publish_text_formats_title_and_bullets() -> None:
    text = tool_runtime._extract_twitter_publish_text(
        "发布一条推特，大概内容如下：\n\n"
        "MarketBot + 小红书 CLI\n"
        "总结：高价值场景聚焦\n"
        "舆情驱动交易：实时捕捉散户行为和热点，优化短线策略\n"
        "趋势挖掘与早期机会发现：新品、概念股、行业趋势\n"
    )

    assert text == (
        "MarketBot + 小红书 CLI\n\n"
        "• 总结：高价值场景聚焦\n"
        "• 舆情驱动交易：实时捕捉散户行为和热点，优化短线策略\n"
        "• 趋势挖掘与早期机会发现：新品、概念股、行业趋势"
    )


def test_extract_twitter_publish_text_ignores_auto_image_instruction() -> None:
    text = tool_runtime._extract_twitter_publish_text(
        "发布一条推特，自动生图，内容如下：\n\n"
        "MarketBot + Twitter CLI\n"
        "自动生成推特图片\n"
        "总结：高价值场景聚焦\n"
    )

    assert text == "MarketBot + Twitter CLI\n\n• 总结：高价值场景聚焦"


def test_run_user_turn_retries_with_fallback_skill_after_primary_failure() -> None:
    loop = _mk_loop()
    session = Session(key="cli:direct")
    session.messages.append({"role": "user", "content": "old"})
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="用雪球看看 NVDA 的讨论热度")
    calls = []
    state = {
        "routing": {
            "selected": [
                {"name": "xueqiu-research"},
                {"name": "social-signal-browser", "source": "fallback", "parent": "xueqiu-research"},
            ]
        }
    }

    async def _fake_run_agent_loop(messages, on_progress=None):
        calls.append(("run", messages, on_progress is not None))
        if len([item for item in calls if item[0] == "run"]) == 1:
            return ("", ["browser_site"], [{"role": "tool", "content": "Error: xueqiu failed"}], {"total_tokens": 3})
        return ("fallback answer", ["browser_site"], [{"role": "assistant", "content": "fallback answer"}], {"total_tokens": 5})

    progress_updates = []

    async def _progress(content: str, *, tool_hint: bool = False) -> None:
        progress_updates.append((content, tool_hint))

    class _Skills:
        def __init__(self):
            self.events = []

        def record_skill_outcome(self, **kwargs):
            self.events.append(kwargs)
            return kwargs

    skills = _Skills()
    loop.context = SimpleNamespace(skills=skills, available_tools={"browser_site"})
    loop._run_agent_loop = _fake_run_agent_loop
    loop._normalize_daily_opportunity_report = lambda content: content
    loop._finalize_response_content = lambda content, **kwargs: (content, {"summary": "ok"}, [], None)
    recorded = []
    loop._record_completed_turn = lambda **kwargs: recorded.append(kwargs)

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return state["routing"]

        @staticmethod
        def build_messages(**kwargs):
            calls.append(("build", kwargs["skill_names"], kwargs["current_message"]))
            state["routing"] = {"selected": [{"name": "social-signal-browser"}]}
            return [{"role": "system", "content": "retry prompt"}]

    loop.processor = _Processor()

    final_content, metadata = asyncio.run(
        loop._run_user_turn(
            msg=msg,
            session=session,
            history=[{"role": "user", "content": "old"}],
            initial_messages=[{"role": "system", "content": "prompt"}],
            on_progress=_progress,
        )
    )

    assert final_content == "fallback answer"
    assert metadata["usage"]["total_tokens"] == 8
    assert calls[0] == ("run", [{"role": "system", "content": "prompt"}], True)
    assert calls[1] == ("build", ["social-signal-browser"], "用雪球看看 NVDA 的讨论热度")
    assert calls[2] == ("run", [{"role": "system", "content": "retry prompt"}], True)
    assert len(skills.events) == 1
    assert skills.events[0]["name"] == "xueqiu-research"
    assert skills.events[0]["text"] == "用雪球看看 NVDA 的讨论热度"
    assert skills.events[0]["outcome"] == "failure"
    assert skills.events[0]["available_tools"] == {"browser_site"}
    assert isinstance(skills.events[0]["route"], dict)
    assert metadata["skill_fallback"] == {
        "used": True,
        "primarySkill": "xueqiu-research",
        "fallbackSkills": ["social-signal-browser"],
        "selectedFallback": "social-signal-browser",
        "finalSkill": "social-signal-browser",
    }
    assert progress_updates == [("Primary skill `xueqiu-research` failed. Retrying with fallback skill `social-signal-browser`.", False)]
    assert recorded[0]["history_len"] == 1
    assert recorded[0]["final_content"] == "fallback answer"


def test_run_system_turn_uses_shared_finalize_pipeline() -> None:
    loop = _mk_loop()
    session = Session(key="cli:direct")
    msg = InboundMessage(channel="system", sender_id="system", chat_id="cli:direct", content="hello")
    calls = []

    async def _fake_run_agent_loop(messages):
        calls.append(("run", messages))
        return (None, None, [{"role": "assistant", "content": ""}], {"total_tokens": 5})

    loop._run_agent_loop = _fake_run_agent_loop
    loop._finalize_response_content = lambda *args, **kwargs: ("final system", {"summary": "ok"}, [{"name": "x"}], Path("/tmp/s.md"))
    loop._record_completed_turn = lambda **kwargs: calls.append(("record", kwargs["history_len"], kwargs["usage"]))

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    loop.processor = _Processor()

    outbound = asyncio.run(
        loop._run_system_turn(
            msg=msg,
            session=session,
            history=[{"role": "user", "content": "old"}],
            messages=[{"role": "system", "content": "prompt"}],
            channel="cli",
            chat_id="direct",
        )
    )

    assert outbound.content == "final system"
    assert outbound.metadata["usage"] == {"total_tokens": 5}
    assert outbound.metadata["explainability"] == {"summary": "ok"}
    assert outbound.metadata["skill_install_suggestions"] == [{"name": "x"}]
    assert outbound.metadata["saved_report_path"] == "/tmp/s.md"
    assert calls[0] == ("run", [{"role": "system", "content": "prompt"}])
    assert calls[1] == ("record", 1, {"total_tokens": 5})


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


def test_append_chat_explainability_skips_publish_result_inline_footer() -> None:
    loop = _mk_loop()
    result = loop._append_chat_explainability(
        "推特发送失败：Twitter API error (HTTP 0): Tweet needs to be a bit shorter. (186)",
        {"delivery": "inline", "inline_footer": "_Capability & Data_: Skills: xiaohongshu-browser-research"},
    )

    assert result == "推特发送失败：Twitter API error (HTTP 0): Tweet needs to be a bit shorter. (186)"


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


def test_is_twitter_request_ignores_publish_commands() -> None:
    messages = [{"role": "user", "content": "发布一条推特，大概内容如下：\nNVDA demand still looks strong"}]

    assert request_policy.is_twitter_request(messages) is False


def test_is_xiaohongshu_request_ignores_publish_commands() -> None:
    messages = [{"role": "user", "content": "发布一条小红书，标题是测试，正文是测试正文"}]

    assert request_policy.is_xiaohongshu_request(messages) is False


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

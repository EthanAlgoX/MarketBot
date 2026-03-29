import json
from typing import Any

from marketbot.agent.tools.browser import BrowserNetworkTool, BrowserPageTool, BrowserSiteTool
from marketbot.agent.tools.base import Tool
from marketbot.agent.tools.lark import LarkBaseTool, LarkCliTool, LarkDocTool, LarkIMTool, LarkSheetsTool, LarkTaskTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.agent.tools.shell import ExecTool
from marketbot.agent.tools.twitter import TwitterCliTool
from marketbot.agent.tools.xiaohongshu import XiaohongshuCliTool
from marketbot.config.schema import BrowserToolsConfig, LarkCliToolsConfig, TwitterCliToolsConfig, XiaohongshuCliToolsConfig


class SampleTool(Tool):
    @property
    def name(self) -> str:
        return "sample"

    @property
    def description(self) -> str:
        return "sample tool"

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 2},
                "count": {"type": "integer", "minimum": 1, "maximum": 10},
                "mode": {"type": "string", "enum": ["fast", "full"]},
                "meta": {
                    "type": "object",
                    "properties": {
                        "tag": {"type": "string"},
                        "flags": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["tag"],
                },
            },
            "required": ["query", "count"],
        }

    async def execute(self, **kwargs: Any) -> str:
        return "ok"


def test_validate_params_missing_required() -> None:
    tool = SampleTool()
    errors = tool.validate_params({"query": "hi"})
    assert "missing required count" in "; ".join(errors)


def test_validate_params_type_and_range() -> None:
    tool = SampleTool()
    errors = tool.validate_params({"query": "hi", "count": 0})
    assert any("count must be >= 1" in e for e in errors)

    errors = tool.validate_params({"query": "hi", "count": "2"})
    assert any("count should be integer" in e for e in errors)


def test_validate_params_enum_and_min_length() -> None:
    tool = SampleTool()
    errors = tool.validate_params({"query": "h", "count": 2, "mode": "slow"})
    assert any("query must be at least 2 chars" in e for e in errors)
    assert any("mode must be one of" in e for e in errors)


def test_validate_params_nested_object_and_array() -> None:
    tool = SampleTool()
    errors = tool.validate_params(
        {
            "query": "hi",
            "count": 2,
            "meta": {"flags": [1, "ok"]},
        }
    )
    assert any("missing required meta.tag" in e for e in errors)
    assert any("meta.flags[0] should be string" in e for e in errors)


def test_validate_params_ignores_unknown_fields() -> None:
    tool = SampleTool()
    errors = tool.validate_params({"query": "hi", "count": 2, "extra": "x"})
    assert errors == []


async def test_registry_returns_validation_error() -> None:
    reg = ToolRegistry()
    reg.register(SampleTool())
    result = await reg.execute("sample", {"query": "hi"})
    payload = json.loads(result)
    assert payload["ok"] is False
    assert payload["error"]["type"] == "invalid_parameters"
    assert payload["error"]["retryable"] is True


async def test_registry_returns_structured_tool_not_found_error() -> None:
    reg = ToolRegistry()

    result = await reg.execute("missing_tool", {"query": "hi"})

    payload = json.loads(result)
    assert payload["ok"] is False
    assert payload["error"]["tool"] == "missing_tool"
    assert payload["error"]["type"] == "tool_not_found"
    assert payload["error"]["retryable"] is False


async def test_registry_filters_tool_definitions_by_visibility() -> None:
    reg = ToolRegistry()
    reg.register(SampleTool())

    definitions = reg.get_definitions(exposed_names={"other"})

    assert definitions == []


def test_exec_extract_absolute_paths_keeps_full_windows_path() -> None:
    cmd = r"type C:\user\workspace\txt"
    paths = ExecTool._extract_absolute_paths(cmd)
    assert paths == [r"C:\user\workspace\txt"]


def test_exec_extract_absolute_paths_ignores_relative_posix_segments() -> None:
    cmd = ".venv/bin/python script.py"
    paths = ExecTool._extract_absolute_paths(cmd)
    assert "/bin/python" not in paths


def test_exec_extract_absolute_paths_captures_posix_absolute_paths() -> None:
    cmd = "cat /tmp/data.txt > /tmp/out.txt"
    paths = ExecTool._extract_absolute_paths(cmd)
    assert "/tmp/data.txt" in paths
    assert "/tmp/out.txt" in paths


# --- cast_params tests ---


class CastTestTool(Tool):
    """Minimal tool for testing cast_params."""

    def __init__(self, schema: dict[str, Any]) -> None:
        self._schema = schema

    @property
    def name(self) -> str:
        return "cast_test"

    @property
    def description(self) -> str:
        return "test tool for casting"

    @property
    def parameters(self) -> dict[str, Any]:
        return self._schema

    async def execute(self, **kwargs: Any) -> str:
        return "ok"


def test_cast_params_string_to_int() -> None:
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"count": {"type": "integer"}},
        }
    )
    result = tool.cast_params({"count": "42"})
    assert result["count"] == 42
    assert isinstance(result["count"], int)


def test_cast_params_string_to_number() -> None:
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"rate": {"type": "number"}},
        }
    )
    result = tool.cast_params({"rate": "3.14"})
    assert result["rate"] == 3.14
    assert isinstance(result["rate"], float)


def test_cast_params_string_to_bool() -> None:
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"enabled": {"type": "boolean"}},
        }
    )
    assert tool.cast_params({"enabled": "true"})["enabled"] is True
    assert tool.cast_params({"enabled": "false"})["enabled"] is False
    assert tool.cast_params({"enabled": "1"})["enabled"] is True


def test_cast_params_array_items() -> None:
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {
                "nums": {"type": "array", "items": {"type": "integer"}},
            },
        }
    )
    result = tool.cast_params({"nums": ["1", "2", "3"]})
    assert result["nums"] == [1, 2, 3]


def test_cast_params_nested_object() -> None:
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {
                "config": {
                    "type": "object",
                    "properties": {
                        "port": {"type": "integer"},
                        "debug": {"type": "boolean"},
                    },
                },
            },
        }
    )
    result = tool.cast_params({"config": {"port": "8080", "debug": "true"}})
    assert result["config"]["port"] == 8080
    assert result["config"]["debug"] is True


def test_cast_params_bool_not_cast_to_int() -> None:
    """Booleans should not be silently cast to integers."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"count": {"type": "integer"}},
        }
    )
    result = tool.cast_params({"count": True})
    assert result["count"] is True
    errors = tool.validate_params(result)
    assert any("count should be integer" in e for e in errors)


def test_cast_params_preserves_empty_string() -> None:
    """Empty strings should be preserved for string type."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"name": {"type": "string"}},
        }
    )
    result = tool.cast_params({"name": ""})
    assert result["name"] == ""


def test_cast_params_bool_string_false() -> None:
    """Test that 'false', '0', 'no' strings convert to False."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"flag": {"type": "boolean"}},
        }
    )
    assert tool.cast_params({"flag": "false"})["flag"] is False
    assert tool.cast_params({"flag": "False"})["flag"] is False
    assert tool.cast_params({"flag": "0"})["flag"] is False
    assert tool.cast_params({"flag": "no"})["flag"] is False
    assert tool.cast_params({"flag": "NO"})["flag"] is False


def test_cast_params_bool_string_invalid() -> None:
    """Invalid boolean strings should not be cast."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"flag": {"type": "boolean"}},
        }
    )
    # Invalid strings should be preserved (validation will catch them)
    result = tool.cast_params({"flag": "random"})
    assert result["flag"] == "random"
    result = tool.cast_params({"flag": "maybe"})
    assert result["flag"] == "maybe"


async def test_browser_page_blocks_url_outside_domain_allowlist() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, allow_domains=["xueqiu.com"]),
    )

    result = await tool.execute(action="open", target="https://reddit.com/r/stocks")

    assert "blocked by domain allowlist" in result


async def test_browser_page_allows_url_inside_domain_allowlist() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, allow_domains=["xueqiu.com"]),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run = _async_return('{"ok":true}')  # type: ignore[method-assign]

    result = await tool.execute(action="open", target="https://xueqiu.com/u/123456")

    assert result == '{"ok":true}'


async def test_browser_page_ignores_non_url_target_for_click() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="interactive", allow_domains=["xueqiu.com"]),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run = _async_return('{"ok":true}')  # type: ignore[method-assign]

    result = await tool.execute(action="click", target="#login-button")

    assert result == '{"ok":true}'


async def test_browser_page_blocks_url_outside_prefix_allowlist() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(
            enabled=True,
            allow_url_prefixes=["https://www.youtube.com/watch?v="],
        ),
    )

    result = await tool.execute(action="open", target="https://www.youtube.com/channel/abc")

    assert "blocked by prefix allowlist" in result


async def test_browser_page_eval_requires_explicit_flag() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="sensitive"),
    )

    result = await tool.execute(action="eval", value="document.title")

    assert "browser eval is disabled" in result


async def test_browser_page_eval_allows_when_explicitly_enabled() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="sensitive", allow_eval=True),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run = _async_return('{"ok":true}')  # type: ignore[method-assign]

    result = await tool.execute(action="eval", value="document.title")

    assert result == '{"ok":true}'


async def test_browser_page_places_tab_flag_before_subcommand() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="interactive"),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    captured: dict[str, Any] = {}

    async def _fake_run(args: list[str], prefix_args: list[str] | None = None) -> str:
        captured["args"] = args
        captured["prefix_args"] = prefix_args
        return '{"ok":true}'

    tool._run = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="snapshot", tab="tab-123")

    assert result == '{"ok":true}'
    assert captured["prefix_args"] == ["--tab", "tab-123"]
    assert captured["args"] == ["snapshot", "--json"]


async def test_browser_page_press_action_passes_key_value() -> None:
    tool = BrowserPageTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="interactive"),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    captured: dict[str, Any] = {}

    async def _fake_run(args: list[str], prefix_args: list[str] | None = None) -> str:
        captured["args"] = args
        captured["prefix_args"] = prefix_args
        return '{"ok":true}'

    tool._run = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="press", value="Enter", tab="tab-123")

    assert result == '{"ok":true}'
    assert captured["prefix_args"] == ["--tab", "tab-123"]
    assert captured["args"] == ["press", "Enter", "--json"]


async def test_browser_network_fetch_blocks_url_outside_domain_allowlist() -> None:
    tool = BrowserNetworkTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="sensitive", allow_domains=["github.com"]),
    )

    result = await tool.execute(mode="fetch", url="https://example.com/data.json")

    assert "blocked by domain allowlist" in result


async def test_browser_network_fetch_allows_url_inside_prefix_allowlist() -> None:
    tool = BrowserNetworkTool(
        browser_config=BrowserToolsConfig(
            enabled=True,
            mode="sensitive",
            allow_url_prefixes=["https://api.github.com/repos/"],
        ),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run = _async_return('{"ok":true}')  # type: ignore[method-assign]

    result = await tool.execute(mode="fetch", url="https://api.github.com/repos/openai/openai-python")

    assert result == '{"ok":true}'


async def test_browser_network_requests_requires_explicit_capture_flag() -> None:
    tool = BrowserNetworkTool(
        browser_config=BrowserToolsConfig(enabled=True, mode="sensitive"),
    )

    result = await tool.execute(mode="requests")

    assert "request capture is disabled" in result


async def test_browser_network_requests_with_body_requires_explicit_body_flag() -> None:
    tool = BrowserNetworkTool(
        browser_config=BrowserToolsConfig(
            enabled=True,
            mode="sensitive",
            allow_request_capture=True,
        ),
    )

    result = await tool.execute(mode="requests", withBody=True)

    assert "request bodies are disabled" in result


async def test_browser_network_requests_allows_with_body_when_explicitly_enabled() -> None:
    tool = BrowserNetworkTool(
        browser_config=BrowserToolsConfig(
            enabled=True,
            mode="sensitive",
            allow_request_capture=True,
            allow_request_bodies=True,
        ),
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run = _async_return('{"ok":true}')  # type: ignore[method-assign]

    result = await tool.execute(mode="requests", withBody=True)

    assert result == '{"ok":true}'


def _async_return(value: str):
    async def _inner(*args: Any, **kwargs: Any) -> str:
        return value

    return _inner


class _BrowserConfig:
    enabled = True
    command = "bb-browser"
    mode = "safe"
    timeout_s = 20
    allow_sites = ["xueqiu", "eastmoney"]
    allow_adapters = []
    adapter_catalog = []


class _BrowserAdapterConfig(_BrowserConfig):
    allow_sites = []
    allow_adapters = ["xueqiu/hot-stock"]


class _BrowserCatalogConfig(_BrowserConfig):
    allow_sites = ["xueqiu", "eastmoney", "reddit"]
    allow_adapters = ["xueqiu/hot-stock", "reddit/search"]
    adapter_catalog = ["xueqiu/hot-stock"]


async def test_browser_site_blocks_adapter_outside_allowlist() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserConfig())
    result = await tool.execute(adapter="reddit/search", args=["ai"])
    assert "adapter blocked by allowlist" in result


async def test_browser_site_rejects_invalid_adapter_shape() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserConfig())
    result = await tool.execute(adapter="xueqiu", args=["ai"])
    assert "adapter must look like <site>/<command>" in result


async def test_browser_site_rejects_raw_cli_flags_in_args() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserConfig())
    result = await tool.execute(adapter="xueqiu/hot-stock", args=["--json"])
    assert "must not include raw CLI flags" in result


async def test_browser_page_blocks_unsafe_actions_in_safe_mode() -> None:
    tool = BrowserPageTool(browser_config=_BrowserConfig())
    result = await tool.execute(action="eval", target="document.title")
    assert "blocked in safe mode" in result


async def test_browser_site_adapter_allowlist_overrides_site_allowlist() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserAdapterConfig())
    blocked = await tool.execute(adapter="xueqiu/stock", args=["TSLA"])
    allowed_shape = await tool.execute(adapter="xueqiu/hot-stock", args=["--bad"])
    assert "adapter blocked by allowlist" in blocked
    assert "must not include raw CLI flags" in allowed_shape


async def test_browser_site_catalog_blocks_adapter_outside_catalog() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserCatalogConfig())
    result = await tool.execute(adapter="reddit/search", args=["ai"])
    assert "adapter blocked by allowlist" in result


async def test_browser_site_catalog_overrides_legacy_allowlists() -> None:
    tool = BrowserSiteTool(browser_config=_BrowserCatalogConfig())
    blocked = await tool.execute(adapter="eastmoney/stock", args=["000001"])
    allowed_shape = await tool.execute(adapter="xueqiu/hot-stock", args=["--bad"])
    assert "adapter blocked by allowlist" in blocked
    assert "must not include raw CLI flags" in allowed_shape


async def test_xiaohongshu_cli_search_builds_expected_command() -> None:
    tool = XiaohongshuCliTool(
        XiaohongshuCliToolsConfig(enabled=True, command="xhs", cookie_source="chrome")
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        assert args == [
            "--cookie-source",
            "chrome",
            "search",
            "咖啡",
            "--sort",
            "popular",
            "--type",
            "video",
            "--page",
            "2",
            "--json",
        ]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        operation="search",
        keyword="咖啡",
        sort="popular",
        note_type="video",
        page=2,
    )

    assert '"operation": "search"' in result
    assert '"counts"' in result


async def test_xiaohongshu_cli_compacts_search_payload_for_model_consumption() -> None:
    tool = XiaohongshuCliTool(XiaohongshuCliToolsConfig(enabled=True, command="xhs"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run_command = _async_return(
        (
            0,
            json.dumps(
                {
                    "ok": True,
                    "schema_version": "1",
                    "data": {
                        "has_more": True,
                        "items": [
                            {
                                "id": "note-1",
                                "model_type": "note",
                                "note_card": {
                                    "display_title": "瑞幸陶喆联名值得冲吗",
                                    "type": "normal",
                                    "user": {"nickname": "咖啡脑袋", "user_id": "user-1"},
                                    "interact_info": {
                                        "liked_count": "38112",
                                        "comment_count": "8482",
                                        "collected_count": "2151",
                                        "shared_count": "19259",
                                    },
                                    "corner_tag_info": [{"type": "publish_time", "text": "1天前"}],
                                },
                            },
                            {
                                "id": "hot-1",
                                "model_type": "hot_query",
                                "hot_query": {
                                    "queries": [
                                        {"name": "瑞幸咖啡陶喆联名"},
                                        {"name": "瑞幸咖啡最好喝的前三名"},
                                    ]
                                },
                            },
                        ],
                    },
                },
                ensure_ascii=False,
            ),
            "",
        )
    )  # type: ignore[method-assign]

    result = await tool.execute(operation="search", keyword="瑞幸咖啡", sort="popular")

    assert '"operation": "search"' in result
    assert '"max_likes": 38112' in result
    assert '"hot_queries": ["瑞幸咖啡陶喆联名", "瑞幸咖啡最好喝的前三名"]' in result
    assert '"title": "瑞幸陶喆联名值得冲吗"' in result
    assert '"image_list"' not in result


async def test_xiaohongshu_cli_post_requires_allow_write() -> None:
    tool = XiaohongshuCliTool(XiaohongshuCliToolsConfig(enabled=True, command="xhs", allow_write=False))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(
        operation="post",
        title="标题",
        body="正文",
        images=["/tmp/demo.jpg"],
    )

    assert "write operations are disabled" in result


async def test_xiaohongshu_cli_post_builds_expected_command() -> None:
    tool = XiaohongshuCliTool(
        XiaohongshuCliToolsConfig(enabled=True, command="xhs", cookie_source="chrome", allow_write=True)
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        assert args == [
            "--cookie-source",
            "chrome",
            "post",
            "--title",
            "标题",
            "--body",
            "正文",
            "--images",
            "/tmp/a.jpg",
            "--images",
            "/tmp/b.jpg",
            "--topic",
            "瑞幸咖啡",
            "--topic",
            "咖啡",
            "--private",
            "--json",
        ]
        return 0, '{"ok":true,"data":{"note_id":"abc"}}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        operation="post",
        title="标题",
        body="正文",
        images=["/tmp/a.jpg", "/tmp/b.jpg"],
        topics=["瑞幸咖啡", "咖啡"],
        is_private=True,
    )

    assert '"note_id":"abc"' in result


async def test_xiaohongshu_cli_requires_keyword_for_search() -> None:
    tool = XiaohongshuCliTool(XiaohongshuCliToolsConfig(enabled=True, command="xhs"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    result = await tool.execute(operation="search")
    assert "keyword is required" in result


async def test_xiaohongshu_cli_surfaces_structured_stdout_on_failure() -> None:
    tool = XiaohongshuCliTool(XiaohongshuCliToolsConfig(enabled=True, command="xhs"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    tool._run_command = _async_return((1, '{"ok":false,"error":{"code":"not_authenticated"}}', ""))  # type: ignore[method-assign]

    result = await tool.execute(operation="status")

    assert '"not_authenticated"' in result


async def test_xiaohongshu_cli_sets_home_env_when_configured() -> None:
    tool = XiaohongshuCliTool(
        XiaohongshuCliToolsConfig(enabled=True, command="xhs", home_dir="/tmp/xhs-home")
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        assert tool.home_dir == "/tmp/xhs-home"
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(operation="status")

    assert result == '{"ok":true}'


async def test_twitter_cli_search_builds_expected_command() -> None:
    tool = TwitterCliTool(TwitterCliToolsConfig(enabled=True, command="twitter"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        assert args == [
            "search",
            "NVDA guidance",
            "--type",
            "Latest",
            "--from",
            "sama",
            "--lang",
            "en",
            "--since",
            "2026-01-01",
            "--has",
            "links",
            "--exclude",
            "retweets",
            "--min-likes",
            "50",
            "--max",
            "20",
            "--full-text",
            "--json",
        ]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        operation="search",
        query="NVDA guidance",
        search_type="Latest",
        from_user="@sama",
        lang="en",
        since="2026-01-01",
        has=["links"],
        exclude=["retweets"],
        min_likes=50,
        max_count=20,
        full_text=True,
    )

    payload = json.loads(result)
    assert payload["ok"] is True
    assert payload["operation"] == "search"


async def test_twitter_cli_post_requires_allow_write() -> None:
    tool = TwitterCliTool(TwitterCliToolsConfig(enabled=True, command="twitter", allow_write=False))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(operation="post", text="hello world")

    assert "write operations are disabled" in result


async def test_twitter_cli_post_builds_expected_command() -> None:
    tool = TwitterCliTool(TwitterCliToolsConfig(enabled=True, command="twitter", allow_write=True))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        assert args == [
            "post",
            "hello world",
            "--reply-to",
            "1234567890",
            "--image",
            "/tmp/a.png",
            "--image",
            "/tmp/b.jpg",
            "--json",
        ]
        return 0, '{"ok":true,"data":{"id":"1"}}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        operation="post",
        text="hello world",
        target="1234567890",
        images=["/tmp/a.png", "/tmp/b.jpg"],
    )

    assert '"id":"1"' in result


async def test_twitter_cli_search_compacts_results_for_prompt_efficiency() -> None:
    tool = TwitterCliTool(TwitterCliToolsConfig(enabled=True, command="twitter"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str]) -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "schema_version": "1",
            "data": [
                {
                    "id": "1",
                    "text": "Line one\nline two " * 80,
                    "author": {
                        "name": "Jane Doe",
                        "screenName": "janedoe",
                        "verified": True,
                        "profileImageUrl": "https://example.com/avatar.jpg",
                    },
                    "metrics": {
                        "likes": 10,
                        "retweets": 2,
                        "replies": 1,
                        "quotes": 0,
                        "views": 300,
                        "bookmarks": 7,
                    },
                    "createdAtLocal": "2026-03-29 20:00",
                    "lang": "en",
                    "score": 42.5,
                    "isRetweet": False,
                    "media": [{"type": "photo", "url": "https://example.com/image.jpg"}],
                }
            ],
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        operation="search",
        query="NVDA guidance",
        search_type="Latest",
        max_count=5,
    )
    payload = json.loads(result)

    assert payload["operation"] == "search"
    assert payload["data"]["count"] == 1
    compact = payload["data"]["results"][0]
    assert compact["url"] == "https://x.com/janedoe/status/1"
    assert compact["author"] == {
        "name": "Jane Doe",
        "screenName": "janedoe",
        "verified": True,
    }
    assert compact["media"] == [{"type": "photo"}]
    assert "profileImageUrl" not in result
    assert "\n" not in compact["text"]
    assert len(compact["text"]) <= 320


async def test_lark_cli_runs_read_command_with_expected_args() -> None:
    tool = LarkCliTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == ["im", "+chat-search", "--query", "财报日历", "--format", "json"]
        assert stdin == ""
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(args=["im", "+chat-search", "--query", "财报日历", "--format", "json"])

    assert result == '{"ok":true}'


async def test_lark_cli_blocks_write_operations_by_default() -> None:
    tool = LarkCliTool(LarkCliToolsConfig(enabled=True, command="lark-cli", allow_write=False))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(args=["docs", "+create", "--title", "日报"])

    assert "write operations are disabled" in result


async def test_lark_cli_blocks_auth_commands_by_default() -> None:
    tool = LarkCliTool(LarkCliToolsConfig(enabled=True, command="lark-cli", allow_auth=False))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(args=["auth", "status"])

    assert "auth commands are disabled" in result


async def test_lark_cli_injects_config_dir_env() -> None:
    tool = LarkCliTool(
        LarkCliToolsConfig(enabled=True, command="lark-cli", config_dir="/tmp/lark-cli-config")
    )
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert tool.config_dir == "/tmp/lark-cli-config"
        return 0, '{"ok":true,"data":{"items":[]}}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(args=["contact", "+search-user", "--query", "Ethan"])

    assert result == '{"ok":true,"data":{"items":[]}}'


async def test_lark_im_chat_search_builds_expected_command() -> None:
    tool = LarkIMTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == ["im", "+chat-search", "--query", "财报", "--format", "json"]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="chat_search", query="财报")
    assert result == '{"ok":true}'


async def test_lark_im_chat_search_summarizes_results() -> None:
    tool = LarkIMTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "chats": [
                    {
                        "chat_id": "oc_123",
                        "name": "市场讨论组",
                        "description": "研究讨论",
                        "chat_mode": "group",
                        "owner_id": "ou_owner",
                    }
                ],
                "total": 1,
                "has_more": False,
                "page_token": "",
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="chat_search", query="市场")

    assert '"returned": 1' in result
    assert '"name": "市场讨论组"' in result
    assert '"chatId": "oc_123"' in result


async def test_lark_im_messages_search_summarizes_results() -> None:
    tool = LarkIMTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "messages": [
                    {
                        "message_id": "om_123",
                        "chat_id": "oc_123",
                        "chat_name": "市场讨论组",
                        "chat_type": "group",
                        "msg_type": "text",
                        "content": "市场今天波动很大",
                        "create_time": "2026-03-29T19:00:00+08:00",
                        "sender": {"name": "Ethan"},
                    }
                ],
                "total": 1,
                "has_more": False,
                "page_token": "",
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="messages_search", query="市场")

    assert '"returned": 1' in result
    assert '"messageId": "om_123"' in result
    assert '"sender": "Ethan"' in result
    assert '"content": "市场今天波动很大"' in result


async def test_lark_im_send_message_respects_write_guard() -> None:
    tool = LarkIMTool(LarkCliToolsConfig(enabled=True, command="lark-cli", allow_write=False))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(action="send_message", chat_id="oc_xxx", text="hello")
    assert "write operations are disabled" in result


async def test_lark_doc_fetch_builds_expected_command() -> None:
    tool = LarkDocTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == ["docs", "+fetch", "--doc-token", "doccn123", "--format", "json"]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="fetch", doc_token="doccn123")
    assert result == '{"ok":true}'


async def test_lark_doc_search_supports_page_size() -> None:
    tool = LarkDocTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == ["docs", "+search", "--query", "市场", "--page-size", "3", "--format", "json"]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="search", query="市场", page_size=3)
    assert result == '{"ok":true}'


async def test_lark_doc_search_summarizes_results() -> None:
    tool = LarkDocTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "total": 7,
                "has_more": True,
                "results": [
                    {
                        "entity_type": "DOC",
                        "title_highlighted": "<h>市场</h>分析报告",
                        "summary_highlighted": "关于<h>市场</h>趋势的总结",
                        "result_meta": {
                            "url": "https://www.feishu.cn/docx/abc",
                            "token": "abc",
                            "doc_types": "DOCX",
                            "update_time_iso": "2026-03-29T19:00:00+08:00",
                        },
                    }
                ],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="search", query="市场", page_size=3)

    assert '"returned": 1' in result
    assert '"title": "市场分析报告"' in result
    assert '"summary": "关于市场趋势的总结"' in result
    assert '"url": "https://www.feishu.cn/docx/abc"' in result


async def test_lark_sheets_append_requires_values_json() -> None:
    tool = LarkSheetsTool(LarkCliToolsConfig(enabled=True, command="lark-cli", allow_write=True))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    result = await tool.execute(action="append", spreadsheet_token="sht123", range="sheet1!A1:B2")
    assert "values_json is required" in result


async def test_lark_sheets_read_builds_expected_command() -> None:
    tool = LarkSheetsTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == [
            "sheets",
            "+read",
            "--spreadsheet-token",
            "sht123",
            "--range",
            "sheet1!A1:B2",
        ]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="read", spreadsheet_token="sht123", range="sheet1!A1:B2")
    assert result == '{"ok":true}'


async def test_lark_sheets_read_summarizes_results() -> None:
    tool = LarkSheetsTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "valueRange": {
                    "range": "sheet1!A1:B2",
                    "values": [["标题", "链接"], ["市场分析", "https://example.com"]],
                }
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="read", spreadsheet_token="sht123", range="sheet1!A1:B2")

    assert '"range": "sheet1!A1:B2"' in result
    assert '"rowCount": 2' in result
    assert '"columnCount": 2' in result
    assert '"rows": [["标题", "链接"], ["市场分析", "https://example.com"]]' in result


async def test_lark_sheets_read_supports_sheet_id() -> None:
    tool = LarkSheetsTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == [
            "sheets",
            "+read",
            "--spreadsheet-token",
            "sht123",
            "--sheet-id",
            "sheetABC",
            "--range",
            "A1:B2",
        ]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="read",
        spreadsheet_token="sht123",
        sheet_id="sheetABC",
        range="A1:B2",
    )
    assert result == '{"ok":true}'


async def test_lark_task_update_builds_expected_command() -> None:
    tool = LarkTaskTool(LarkCliToolsConfig(enabled=True, command="lark-cli", allow_write=True))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == [
            "task",
            "+update",
            "--task-id",
            "task_123",
            "--summary",
            "更新标题",
            "--due",
            "+2d",
            "--format",
            "json",
        ]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="update", task_id="task_123", summary="更新标题", due="+2d")
    assert result == '{"ok":true}'


async def test_lark_task_list_summarizes_results() -> None:
    tool = LarkTaskTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "items": [
                    {
                        "guid": "task_123",
                        "summary": "更新市场周报",
                        "url": "https://feishu.cn/task/task_123",
                        "created_at": "2026-03-29T10:00:00Z",
                        "due_at": "2026-03-30T10:00:00Z",
                    }
                ],
                "has_more": False,
                "page_token": "",
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="list", query="市场")

    assert '"returned": 1' in result
    assert '"taskId": "task_123"' in result
    assert '"summary": "更新市场周报"' in result


async def test_lark_base_table_list_builds_expected_command() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        assert args == ["base", "+table-list", "--base-token", "app123", "--limit", "5"]
        return 0, '{"ok":true}', ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="table_list", base_token="app123", limit=5)
    assert result == '{"ok":true}'


async def test_lark_base_field_list_summarizes_results() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "items": [
                    {"field_id": "fld1", "field_name": "名称", "type": 1, "is_primary": True},
                    {"field_id": "fld2", "field_name": "状态", "type": 3, "is_primary": False},
                ],
                "has_more": False,
                "page_token": "",
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="field_list", base_token="app123", table_id="tbl123")
    assert '"returned": 2' in result
    assert '"fieldName": "名称"' in result
    assert '"isPrimary": true' in result


async def test_lark_base_table_list_summarizes_table_name() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "items": [
                    {"table_id": "tbl1", "table_name": "需求调研（ AI 分析）"},
                ],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(action="table_list", base_token="app123")
    assert '"tableName": "需求调研（ AI 分析）"' in result
    assert '"name": "需求调研（ AI 分析）"' in result


async def test_lark_base_record_get_summarizes_result() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "record": {
                    "record_id": "rec123",
                    "fields": {"名称": "活动A", "状态": "进行中"},
                }
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_get",
        base_token="app123",
        table_id="tbl123",
        record_id="rec123",
    )
    assert '"recordId": "rec123"' in result
    assert '"状态": "进行中"' in result


async def test_lark_base_record_list_maps_field_names_to_objects() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "fields": ["名称", "状态"],
                "data": [
                    ["活动A", "进行中"],
                    ["活动B", "已完成"],
                ],
                "record_id_list": ["rec1", "rec2"],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_id="tbl123",
        limit=2,
    )
    assert '"returned": 2' in result
    assert '"recordId": "rec1"' in result
    assert '"名称": "活动A"' in result
    assert '"状态": "已完成"' in result


async def test_lark_base_record_list_filters_selected_fields() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "fields": ["名称", "状态", "年龄"],
                "data": [
                    ["活动A", "进行中", "25-34岁"],
                ],
                "record_id_list": ["rec1"],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_id="tbl123",
        fields=["名称", "状态"],
    )
    assert '"名称": "活动A"' in result
    assert '"状态": "进行中"' in result
    assert '"年龄"' not in result


async def test_lark_base_record_list_filters_records_by_field_value() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "fields": ["编号", "AI 情感打标", "您的年龄范围？"],
                "data": [
                    ["1", "负向", "45-54岁"],
                    ["2", "正向", "25-34岁"],
                ],
                "record_id_list": ["rec1", "rec2"],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_id="tbl123",
        field_filters={"AI 情感打标": "负向"},
    )
    assert '"returned": 1' in result
    assert '"recordId": "rec1"' in result
    assert '"recordId": "rec2"' not in result


async def test_lark_base_record_list_supports_filter_dsl() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "fields": ["编号", "AI 情感打标", "您的年龄范围？"],
                "data": [
                    ["1", "负向", "45-54岁"],
                    ["2", "正向", "25-34岁"],
                    ["3", "负向", "18岁以下"],
                ],
                "record_id_list": ["rec1", "rec2", "rec3"],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_id="tbl123",
        field_filters={
            "conjunction": "and",
            "conditions": [
                {"field_name": "AI 情感打标", "operator": "is", "value": ["负向"]},
                {"field_name": "您的年龄范围？", "operator": "contains", "value": "45-54"},
            ],
        },
    )
    assert '"returned": 1' in result
    assert '"recordId": "rec1"' in result
    assert '"recordId": "rec3"' not in result


async def test_lark_base_field_list_resolves_table_name_to_table_id() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]
    seen_args: list[list[str]] = []

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        seen_args.append(args)
        if args[:2] == ["base", "+table-list"]:
            payload = {
                "ok": True,
                "identity": "user",
                "data": {
                    "items": [
                        {"table_id": "tbl123", "table_name": "需求调研（ AI 分析）"},
                    ],
                },
            }
            return 0, json.dumps(payload, ensure_ascii=False), ""
        if args[:2] == ["base", "+field-list"]:
            payload = {
                "ok": True,
                "identity": "user",
                "data": {
                    "items": [
                        {"field_id": "fld1", "field_name": "名称", "type": 1, "is_primary": True},
                    ],
                },
            }
            return 0, json.dumps(payload, ensure_ascii=False), ""
        return 1, "", "unexpected args"

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="field_list",
        base_token="app123",
        table_name="需求调研",
    )
    assert seen_args[0] == ["base", "+table-list", "--base-token", "app123"]
    assert seen_args[1] == ["base", "+field-list", "--base-token", "app123", "--table-id", "tbl123"]
    assert '"tableId": "tbl123"' in result
    assert '"tableName": "需求调研（ AI 分析）"' in result


async def test_lark_base_record_list_returns_error_when_table_name_not_found() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "items": [
                    {"table_id": "tbl123", "table_name": "需求调研（ AI 分析）"},
                    {"table_id": "tbl456", "table_name": "🛠️问卷管理员配置"},
                ],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_name="不存在的表",
    )
    payload = json.loads(result)
    assert payload["ok"] is False
    assert payload["error"]["code"] == "table_name_not_found"
    assert payload["error"]["message"] == "table_name '不存在的表' was not found in base app123"
    assert payload["data"]["candidates"] == ["需求调研（ AI 分析）", "🛠️问卷管理员配置"]


async def test_lark_base_record_list_returns_ambiguity_error_for_multiple_table_name_matches() -> None:
    tool = LarkBaseTool(LarkCliToolsConfig(enabled=True, command="lark-cli"))
    tool._ensure_available = lambda: None  # type: ignore[method-assign]

    async def _fake_run(args: list[str], stdin: str = "") -> tuple[int, str, str]:
        payload = {
            "ok": True,
            "identity": "user",
            "data": {
                "items": [
                    {"table_id": "tbl123", "table_name": "需求调研（ AI 分析）"},
                    {"table_id": "tbl456", "table_name": "需求调研（问卷回收）"},
                    {"table_id": "tbl789", "table_name": "🛠️问卷管理员配置"},
                ],
            },
        }
        return 0, json.dumps(payload, ensure_ascii=False), ""

    tool._run_command = _fake_run  # type: ignore[method-assign]

    result = await tool.execute(
        action="record_list",
        base_token="app123",
        table_name="需求调研",
    )
    payload = json.loads(result)
    assert payload["ok"] is False
    assert payload["error"]["code"] == "ambiguous_table_name"
    assert payload["error"]["message"] == "table_name '需求调研' matched multiple tables in base app123"
    assert payload["data"]["candidates"] == ["需求调研（ AI 分析）", "需求调研（问卷回收）"]


def test_cast_params_invalid_string_to_int() -> None:
    """Invalid strings should not be cast to integer."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"count": {"type": "integer"}},
        }
    )
    result = tool.cast_params({"count": "abc"})
    assert result["count"] == "abc"  # Original value preserved
    result = tool.cast_params({"count": "12.5.7"})
    assert result["count"] == "12.5.7"


def test_cast_params_invalid_string_to_number() -> None:
    """Invalid strings should not be cast to number."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"rate": {"type": "number"}},
        }
    )
    result = tool.cast_params({"rate": "not_a_number"})
    assert result["rate"] == "not_a_number"


def test_validate_params_bool_not_accepted_as_number() -> None:
    """Booleans should not pass number validation."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"rate": {"type": "number"}},
        }
    )
    errors = tool.validate_params({"rate": False})
    assert any("rate should be number" in e for e in errors)


def test_cast_params_none_values() -> None:
    """Test None handling for different types."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "count": {"type": "integer"},
                "items": {"type": "array"},
                "config": {"type": "object"},
            },
        }
    )
    result = tool.cast_params(
        {
            "name": None,
            "count": None,
            "items": None,
            "config": None,
        }
    )
    # None should be preserved for all types
    assert result["name"] is None
    assert result["count"] is None
    assert result["items"] is None
    assert result["config"] is None


def test_cast_params_single_value_not_auto_wrapped_to_array() -> None:
    """Single values should NOT be automatically wrapped into arrays."""
    tool = CastTestTool(
        {
            "type": "object",
            "properties": {"items": {"type": "array"}},
        }
    )
    # Non-array values should be preserved (validation will catch them)
    result = tool.cast_params({"items": 5})
    assert result["items"] == 5  # Not wrapped to [5]
    result = tool.cast_params({"items": "text"})
    assert result["items"] == "text"  # Not wrapped to ["text"]

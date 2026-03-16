from typing import Any

from marketbot.agent.tools.browser import BrowserNetworkTool, BrowserPageTool, BrowserSiteTool
from marketbot.agent.tools.base import Tool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.agent.tools.shell import ExecTool
from marketbot.config.schema import BrowserToolsConfig


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
    assert "Invalid parameters" in result


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

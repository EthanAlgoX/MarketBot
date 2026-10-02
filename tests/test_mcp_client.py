"""MCP configuration and lifecycle tests without launching external servers."""

from __future__ import annotations

import asyncio
import json
from contextlib import AsyncExitStack, asynccontextmanager
from types import SimpleNamespace

import anyio
import pytest
from loguru import logger
from mcp import types

from marketbot.agent.tools import mcp as mcp_tools
from marketbot.agent.tools.mcp import MCPToolWrapper, connect_mcp_servers
from marketbot.agent.tools.registry import ToolRegistry


def config(command="finance", **overrides):
    values = {
        "type": None, "command": command, "args": [], "env": {}, "url": "", "headers": {},
        "enabled": True, "enabled_tools": ["*"], "startup_timeout": 1, "tool_timeout": 30,
    }
    return SimpleNamespace(**(values | overrides))


def tool(name):
    return SimpleNamespace(name=name, description=f"Read {name}", inputSchema={"type": "object"})


def page(*names, cursor=None):
    return SimpleNamespace(tools=[tool(name) for name in names], nextCursor=cursor)


@pytest.fixture
def mcp_logs(monkeypatch):
    """Capture diagnostics independently of CLI commands disabling Loguru."""
    messages = []

    def record(message, *args, **kwargs):
        messages.append(message.format(*args, **kwargs))

    for level in ("debug", "info", "warning", "error"):
        monkeypatch.setattr(logger, level, record)
    return messages


@pytest.fixture
def fake_mcp(monkeypatch):
    """Exercise real AnyIO task groups while replacing transport IO and RPC."""
    import mcp.client.sse
    import mcp.client.stdio
    import mcp.client.streamable_http

    state = SimpleNamespace(
        opened=[], closed=[], params=[], pages={}, calls={}, groups={}, sessions={},
        failures={}, hangs={}, http_clients=[],
    )

    @asynccontextmanager
    async def transport(name):
        owner = asyncio.current_task()
        async with anyio.create_task_group() as group:
            state.groups[name] = group
            state.opened.append(name)
            try:
                if state.hangs.get(name) == "transport":
                    await asyncio.Event().wait()
                yield name, object()
            finally:
                # AnyIO cancel scopes cannot be exited in a different task.
                assert asyncio.current_task() is owner
                state.closed.append(name)

    def stdio(params):
        state.params.append(params)
        return transport(params.command)

    @asynccontextmanager
    async def streamable_http(url, http_client):
        async with transport(url) as (read, write):
            yield read, write, None

    @asynccontextmanager
    async def sse(url, httpx_client_factory):
        async with httpx_client_factory(headers={"X-SDK": "sdk"}):
            async with transport(url) as streams:
                yield streams

    class FakeHTTPClient:
        def __init__(self, **kwargs):
            state.http_clients.append(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    class FakeSession:
        def __init__(self, read, write):
            self.name = read
            state.sessions[read] = self
            state.calls[read] = []

        async def __aenter__(self):
            self.owner = asyncio.current_task()
            return self

        async def __aexit__(self, *args):
            assert asyncio.current_task() is self.owner

        async def initialize(self):
            if state.hangs.get(self.name) == "initialize":
                await asyncio.Event().wait()
            if state.failures.get(self.name) == "worker":
                async def fail_in_transport_worker():
                    raise RuntimeError("failure includes SECRET_TOKEN_VALUE")

                state.groups[self.name].start_soon(fail_in_transport_worker)
                await asyncio.Event().wait()

        async def list_tools(self, params=None):
            cursor = None if params is None else params.cursor
            state.calls[self.name].append(cursor)
            if state.hangs.get(self.name) == "discovery":
                await asyncio.Event().wait()
            if state.failures.get(self.name) == "discovery":
                raise RuntimeError("failure includes SECRET_TOKEN_VALUE")
            return state.pages.get(self.name, {None: page("quote", "trade")})[cursor]

        async def call_tool(self, name, arguments):
            assert self.name not in state.closed
            return SimpleNamespace(content=[types.TextContent(type="text", text=f"{name}:{arguments}")])

    monkeypatch.setattr(mcp, "ClientSession", FakeSession)
    monkeypatch.setattr(mcp.client.stdio, "stdio_client", stdio)
    monkeypatch.setattr(mcp.client.sse, "sse_client", sse)
    monkeypatch.setattr(mcp.client.streamable_http, "streamable_http_client", streamable_http)
    monkeypatch.setattr(mcp_tools.httpx, "AsyncClient", FakeHTTPClient)
    return state


async def test_disabled_server_is_not_resolved_or_launched(fake_mcp, monkeypatch):
    monkeypatch.delenv("UNSET_MCP_TOKEN", raising=False)
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({
            "disabled": config("${UNSET_MCP_TOKEN}", enabled=False),
            "healthy": config("healthy"),
        }, registry, stack)
        assert fake_mcp.opened == ["healthy"]
        assert registry.tool_names == ["mcp_healthy_quote", "mcp_healthy_trade"]
    assert fake_mcp.closed == ["healthy"]


@pytest.mark.parametrize("enabled_tools, expected", [
    (["quote"], ["mcp_finance_quote"]),
    (["mcp_finance_quote"], ["mcp_finance_quote"]),
    (["*"], ["mcp_finance_quote", "mcp_finance_trade"]),
    ([], []),
    (["does_not_exist"], []),
])
async def test_tool_allowlist_supports_raw_and_wrapped_names(fake_mcp, enabled_tools, expected):
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({"finance": config(enabled_tools=enabled_tools)}, registry, stack)
        assert registry.tool_names == expected
    assert not registry.tool_names


async def test_legacy_config_defaults_remain_compatible(fake_mcp):
    legacy_cfg = SimpleNamespace(command="finance")
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({"finance": legacy_cfg}, registry, stack)
        assert registry.tool_names == ["mcp_finance_quote", "mcp_finance_trade"]


async def test_paginated_discovery_includes_later_allowed_tools(fake_mcp):
    fake_mcp.pages["finance"] = {
        None: page("trade", cursor="second"), "second": page("quote", cursor="last"),
        "last": page("fundamentals"),
    }
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({
            "finance": config(enabled_tools=["quote", "fundamentals"])
        }, registry, stack)
        assert fake_mcp.calls["finance"] == [None, "second", "last"]
        assert registry.tool_names == ["mcp_finance_quote", "mcp_finance_fundamentals"]


async def test_repeated_cursor_rolls_back_server_tools_and_continues(fake_mcp):
    fake_mcp.pages["broken"] = {
        None: page("partial", cursor="again"), "again": page("other", cursor="again"),
    }
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({
            "broken": config("broken"), "healthy": config("healthy")
        }, registry, stack)
        assert fake_mcp.calls["broken"] == [None, "again"]
        assert registry.tool_names == ["mcp_healthy_quote", "mcp_healthy_trade"]
        assert fake_mcp.closed == ["broken"]


@pytest.mark.parametrize("environment_value", [None, ""])
async def test_missing_environment_skips_only_affected_server_without_secrets(
    fake_mcp, monkeypatch, environment_value, mcp_logs
):
    if environment_value is None:
        monkeypatch.delenv("UNSET_MCP_TOKEN", raising=False)
    else:
        monkeypatch.setenv("UNSET_MCP_TOKEN", environment_value)
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({
            "missing": config(
                "missing", headers={"Authorization": "SECRET_TOKEN_VALUE-${UNSET_MCP_TOKEN}"}
            ),
            "healthy": config("healthy"),
        }, registry, stack)
        assert fake_mcp.opened == ["healthy"]
        assert registry.has("mcp_healthy_quote")
    output = "\n".join(mcp_logs)
    assert "UNSET_MCP_TOKEN" in output
    assert "SECRET_TOKEN_VALUE" not in output


async def test_environment_is_expanded_in_stdio_command_arguments_and_env(fake_mcp, monkeypatch):
    monkeypatch.setenv("MCP_BINARY", "finance")
    monkeypatch.setenv("MCP_TOKEN", "local-secret")
    cfg = config("${MCP_BINARY}", args=["--key=${MCP_TOKEN}"], env={"API_KEY": "${MCP_TOKEN}"})
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({"finance": cfg}, ToolRegistry(), stack)
        params = fake_mcp.params[0]
        assert params.command == "finance"
        assert params.args == ["--key=local-secret"]
        assert params.env == {"API_KEY": "local-secret"}
    assert cfg.command == "${MCP_BINARY}"
    assert cfg.env == {"API_KEY": "${MCP_TOKEN}"}


@pytest.mark.parametrize("suffix, transport_type", [("/mcp", "streamableHttp"), ("/sse/", "sse")])
async def test_environment_is_expanded_in_http_url_and_headers(fake_mcp, monkeypatch, suffix, transport_type):
    monkeypatch.setenv("MCP_HOST", "https://finance.example")
    monkeypatch.setenv("MCP_TOKEN", "local-secret")
    cfg = config("", url="${MCP_HOST}" + suffix, headers={"Authorization": "Bearer ${MCP_TOKEN}"})
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({"finance": cfg}, ToolRegistry(), stack)
        assert fake_mcp.opened == ["https://finance.example" + suffix]
        client_kwargs = fake_mcp.http_clients[0]
        assert client_kwargs["headers"]["Authorization"] == "Bearer local-secret"
        if transport_type == "sse":
            assert client_kwargs["headers"]["X-SDK"] == "sdk"
        else:
            assert client_kwargs["timeout"] is None


async def test_transport_worker_failure_does_not_cancel_healthy_server(fake_mcp, mcp_logs):
    fake_mcp.failures["broken"] = "worker"
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers({
            "first": config("first"), "broken": config("broken"), "last": config("last")
        }, registry, stack)
        assert fake_mcp.closed == ["broken"]
        assert registry.tool_names == [
            "mcp_first_quote", "mcp_first_trade", "mcp_last_quote", "mcp_last_trade"
        ]
        assert await registry.execute("mcp_first_quote", {}) == "quote:{}"
    assert fake_mcp.closed == ["broken", "last", "first"]
    output = "\n".join(mcp_logs)
    assert "failed to connect" in output
    assert "SECRET_TOKEN_VALUE" not in output


@pytest.mark.parametrize("stage", ["transport", "initialize", "discovery"])
async def test_startup_budget_covers_all_stages_and_cleans_up(fake_mcp, stage):
    fake_mcp.hangs["slow"] = stage
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await asyncio.wait_for(connect_mcp_servers({
            "slow": config("slow", startup_timeout=0.02), "healthy": config("healthy")
        }, registry, stack), timeout=1)
        assert fake_mcp.closed == ["slow"]
        assert registry.tool_names == ["mcp_healthy_quote", "mcp_healthy_trade"]


async def test_caller_cancellation_propagates_and_stack_still_cleans_up(fake_mcp):
    fake_mcp.hangs["slow"] = "initialize"
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        task = asyncio.create_task(connect_mcp_servers({
            "first": config("first"), "slow": config("slow")
        }, registry, stack))
        while "slow" not in fake_mcp.sessions:
            await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert fake_mcp.closed == ["slow"]
    assert fake_mcp.closed == ["slow", "first"]
    assert not registry.tool_names


async def test_connection_can_be_closed_from_a_different_task(fake_mcp):
    stack = AsyncExitStack()
    await stack.__aenter__()
    registry = ToolRegistry()
    await connect_mcp_servers({"finance": config()}, registry, stack)
    await asyncio.create_task(stack.aclose())
    assert fake_mcp.closed == ["finance"]
    assert not registry.tool_names


async def test_tool_timeout_does_not_hang_agent():
    class SlowSession:
        async def call_tool(self, name, arguments):
            await asyncio.Event().wait()

    wrapper = MCPToolWrapper(SlowSession(), "finance", tool("quote"), tool_timeout=0.01)
    assert await wrapper.execute(symbol="SPY") == "(MCP tool call timed out after 0.01s)"


async def test_default_finance_server_connects_with_active_config_and_closes(tmp_path):
    """Run the bundled subprocess through the production client without live APIs."""
    from marketbot.config.finance import prepare_mcp_servers
    from marketbot.config.schema import Config

    configured = Config()
    configured.agents.defaults.workspace = str(tmp_path)
    configured.tools.market.quote_source = "mock"
    registry = ToolRegistry()
    async with AsyncExitStack() as stack:
        await connect_mcp_servers(prepare_mcp_servers(configured), registry, stack)
        assert registry.has("mcp_finance_market_snapshot")
        assert registry.has("mcp_finance_market_source_plan")
        assert not registry.has("mcp_finance_market_signal")
        assert not registry.has("mcp_finance_market_brief")
        payload = json.loads(await registry.execute("mcp_finance_market_snapshot", {"symbols": ["SPY"]}))
        assert payload["source"] == "mock"
        assert payload["quotes"] == []
        assert "mock quote source is disabled" in payload["warnings"]
    assert not registry.tool_names

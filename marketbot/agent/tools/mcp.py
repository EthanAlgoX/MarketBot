"""MCP client: connects to MCP servers and wraps their tools as native marketbot tools."""

import asyncio
import os
import re
from contextlib import AsyncExitStack, suppress
from types import SimpleNamespace
from typing import Any

import httpx
from loguru import logger

from marketbot.agent.tools.base import Tool
from marketbot.agent.tools.registry import ToolRegistry

_ENV_REFERENCE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _resolve_server_config(cfg: Any) -> SimpleNamespace:
    """Expand explicit environment references without mutating persisted config."""
    missing: set[str] = set()

    def resolve(value: str) -> str:
        def replace(match: re.Match[str]) -> str:
            name = match.group(1)
            if not os.environ.get(name):
                missing.add(name)
                return match.group(0)
            return os.environ[name]

        return _ENV_REFERENCE.sub(replace, value)

    resolved = SimpleNamespace(
        type=getattr(cfg, "type", None),
        command=resolve(getattr(cfg, "command", "")),
        args=[resolve(arg) for arg in getattr(cfg, "args", [])],
        env={key: resolve(value) for key, value in (getattr(cfg, "env", {}) or {}).items()},
        url=resolve(getattr(cfg, "url", "")),
        headers={
            key: resolve(value) for key, value in (getattr(cfg, "headers", {}) or {}).items()
        },
        enabled_tools=getattr(cfg, "enabled_tools", ["*"]),
        startup_timeout=getattr(cfg, "startup_timeout", 20),
        tool_timeout=getattr(cfg, "tool_timeout", 30),
    )
    if missing:
        # Only variable names are safe to log; config values may contain credentials.
        raise ValueError("missing environment variables: " + ", ".join(sorted(missing)))
    return resolved


class _OwnedMCPConnection:
    """Keep AnyIO transport scopes in the task that originally entered them."""

    def __init__(self, owner: asyncio.Task, close_requested: asyncio.Event):
        self._owner = owner
        self._close_requested = close_requested

    async def aclose(self) -> None:
        self._close_requested.set()
        await asyncio.shield(self._owner)


class MCPToolWrapper(Tool):
    """Wraps a single MCP server tool as a marketbot Tool."""

    def __init__(self, session, server_name: str, tool_def, tool_timeout: int = 30):
        self._session = session
        self._original_name = tool_def.name
        self._name = f"mcp_{server_name}_{tool_def.name}"
        self._description = tool_def.description or tool_def.name
        self._parameters = tool_def.inputSchema or {"type": "object", "properties": {}}
        self._tool_timeout = tool_timeout

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def parameters(self) -> dict[str, Any]:
        return self._parameters

    async def execute(self, **kwargs: Any) -> str:
        from mcp import types
        try:
            result = await asyncio.wait_for(
                self._session.call_tool(self._original_name, arguments=kwargs),
                timeout=self._tool_timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("MCP tool '{}' timed out after {}s", self._name, self._tool_timeout)
            return f"(MCP tool call timed out after {self._tool_timeout}s)"
        parts = []
        for block in result.content:
            if isinstance(block, types.TextContent):
                parts.append(block.text)
            else:
                parts.append(str(block))
        return "\n".join(parts) or "(no output)"


async def connect_mcp_servers(
    mcp_servers: dict, registry: ToolRegistry, stack: AsyncExitStack
) -> None:
    """Connect enabled servers, isolating startup failures and transport cleanup."""
    for name, original_cfg in mcp_servers.items():
        if not getattr(original_cfg, "enabled", True):
            logger.debug("MCP server '{}': disabled, skipping", name)
            continue
        try:
            cfg = _resolve_server_config(original_cfg)
        except ValueError as exc:
            logger.warning("MCP server '{}': {}, skipping", name, exc)
            continue

        ready = asyncio.get_running_loop().create_future()
        close_requested = asyncio.Event()
        registered: list[MCPToolWrapper] = []

        async def own_connection(
            server_name=name,
            settings=cfg,
            readiness=ready,
            close_event=close_requested,
            wrappers=registered,
        ) -> None:
            try:
                async with AsyncExitStack() as server_stack:
                    session = await _open_mcp_session(server_name, settings, server_stack)
                    if session is None:
                        readiness.set_result(False)
                        return
                    tool_defs = await _discover_tools(session)
                    enabled_tools = set(settings.enabled_tools)
                    matched: set[str] = set()
                    for tool_def in tool_defs:
                        wrapper = MCPToolWrapper(
                            session, server_name, tool_def, tool_timeout=settings.tool_timeout
                        )
                        if (
                            "*" not in enabled_tools
                            and tool_def.name not in enabled_tools
                            and wrapper.name not in enabled_tools
                        ):
                            continue
                        registry.register(wrapper)
                        wrappers.append(wrapper)
                        matched.update({tool_def.name, wrapper.name} & enabled_tools)
                    if "*" not in enabled_tools and enabled_tools - matched:
                        logger.warning(
                            "MCP server '{}': enabledTools entries not found: {}",
                            server_name,
                            ", ".join(sorted(enabled_tools - matched)),
                        )
                    logger.info(
                        "MCP server '{}': connected, {} tools registered", server_name, len(wrappers)
                    )
                    readiness.set_result(True)
                    await close_event.wait()
            except BaseException as exc:
                if not readiness.done():
                    readiness.set_exception(exc)
                elif not close_event.is_set():
                    # Exceptions may contain URLs, tokens, or server response bodies.
                    logger.error(
                        "MCP server '{}': connection stopped ({})", server_name, type(exc).__name__
                    )
            finally:
                for wrapper in wrappers:
                    if registry.get(wrapper.name) is wrapper:
                        registry.unregister(wrapper.name)

        owner = asyncio.create_task(own_connection(), name=f"mcp:{name}")
        connection = _OwnedMCPConnection(owner, close_requested)
        try:
            connected = await asyncio.wait_for(asyncio.shield(ready), cfg.startup_timeout)
        except BaseException as exc:
            close_requested.set()
            owner.cancel()
            with suppress(BaseException):
                await asyncio.shield(owner)
            # Retrieve any error produced while cancellation was cleaning up,
            # including when genuine caller cancellation must propagate below.
            if ready.done() and not ready.cancelled():
                ready.exception()
            # A transport's AnyIO cancel scope can cancel its owner without the
            # caller being cancelled. Only genuine caller cancellation propagates.
            if isinstance(exc, asyncio.CancelledError) and asyncio.current_task().cancelling():
                raise
            if not isinstance(exc, (Exception, asyncio.CancelledError)):
                raise
            if isinstance(exc, asyncio.TimeoutError):
                logger.warning(
                    "MCP server '{}': startup timed out after {}s", name, cfg.startup_timeout
                )
            else:
                logger.error("MCP server '{}': failed to connect ({})", name, type(exc).__name__)
            continue
        if connected:
            stack.push_async_callback(connection.aclose)
        else:
            await connection.aclose()


async def _discover_tools(session: Any) -> list:
    """Discover all pages before exposing any tools from a server."""
    from mcp import types

    page = await session.list_tools()
    tool_defs = list(page.tools)
    seen_cursors: set[str] = set()
    while getattr(page, "nextCursor", None) is not None:
        cursor = page.nextCursor
        if cursor in seen_cursors:
            raise ValueError("MCP tools/list returned a repeated pagination cursor")
        seen_cursors.add(cursor)
        page = await session.list_tools(params=types.PaginatedRequestParams(cursor=cursor))
        tool_defs.extend(page.tools)
    return tool_defs


async def _open_mcp_session(name: str, cfg: Any, stack: AsyncExitStack) -> Any:
    """Open one server's transport and initialize its session in its owner task."""
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.sse import sse_client
    from mcp.client.stdio import stdio_client
    from mcp.client.streamable_http import streamable_http_client

    transport_type = cfg.type
    if not transport_type:
        if cfg.command:
            transport_type = "stdio"
        elif cfg.url:
            transport_type = "sse" if cfg.url.rstrip("/").endswith("/sse") else "streamableHttp"
        else:
            logger.warning("MCP server '{}': no command or url configured, skipping", name)
            return None

    if transport_type == "stdio":
        params = StdioServerParameters(command=cfg.command, args=cfg.args, env=cfg.env or None)
        read, write = await stack.enter_async_context(stdio_client(params))
    elif transport_type == "sse":
        def httpx_client_factory(
            headers: dict[str, str] | None = None,
            timeout: httpx.Timeout | None = None,
            auth: httpx.Auth | None = None,
        ) -> httpx.AsyncClient:
            merged_headers = {**(cfg.headers or {}), **(headers or {})}
            return httpx.AsyncClient(
                headers=merged_headers or None, follow_redirects=True, timeout=timeout, auth=auth
            )

        read, write = await stack.enter_async_context(
            sse_client(cfg.url, httpx_client_factory=httpx_client_factory)
        )
    elif transport_type == "streamableHttp":
        # Preserve the configured tool budget instead of httpx's default 5s timeout.
        http_client = await stack.enter_async_context(
            httpx.AsyncClient(headers=cfg.headers or None, follow_redirects=True, timeout=None)
        )
        read, write, _ = await stack.enter_async_context(
            streamable_http_client(cfg.url, http_client=http_client)
        )
    else:
        logger.warning("MCP server '{}': unknown transport type '{}'", name, transport_type)
        return None

    session = await stack.enter_async_context(ClientSession(read, write))
    await session.initialize()
    return session

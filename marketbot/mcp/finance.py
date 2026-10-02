"""Expose MarketBot's existing read-only finance tools over MCP stdio.

Run ``python -m marketbot.mcp.finance --workspace /path/to/workspace``.
The server starts without external service credentials; each finance tool retains
its native source selection, provenance, fallback behavior, and input schema.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from marketbot import __version__
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.config.loader import get_config_path, load_config
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market.plugin import create_market_tools

FINANCE_CONFIG_ENV = "MARKETBOT_FINANCE_CONFIG"


def _active_market_config(fallback: MarketToolsConfig) -> MarketToolsConfig:
    """Apply in-memory runtime settings without exposing them in diagnostics."""
    serialized = os.environ.get(FINANCE_CONFIG_ENV)
    if serialized is None:
        return fallback
    try:
        return MarketToolsConfig.model_validate_json(serialized)
    except ValueError as exc:
        raise ValueError(f"Invalid finance configuration in {FINANCE_CONFIG_ENV}") from exc


def load_market_config(config_path: Path | None = None) -> MarketToolsConfig:
    """Use active runtime settings when provided, otherwise the saved config.

    The runtime passes only its market settings through the environment, so an
    in-memory configuration works without writing credentials to a config file.
    Explicit invalid settings fail startup instead of silently enabling defaults.
    """
    if FINANCE_CONFIG_ENV in os.environ:
        return _active_market_config(MarketToolsConfig())

    path = config_path or get_config_path()
    if config_path is not None and not path.is_file():
        raise ValueError(f"Config file does not exist: {path}")
    return load_config(path, strict=True).tools.market


def load_finance_settings(
    config_path: Path | None = None,
    workspace: Path | None = None,
) -> tuple[Path, MarketToolsConfig]:
    """Resolve the optional client workspace without reading a config twice."""
    if workspace is not None or config_path is None:
        directory = workspace if workspace is not None else Path("~/.marketbot/workspace")
        return directory.expanduser().resolve(), load_market_config(config_path)

    if not config_path.is_file():
        raise ValueError(f"Config file does not exist: {config_path}")
    saved = load_config(config_path, strict=True)
    return saved.workspace_path.resolve(), _active_market_config(saved.tools.market)


def create_finance_server(
    workspace: Path,
    config: MarketToolsConfig | None = None,
) -> Server:
    """Build an MCP surface from the same tool instances as the native agent."""
    registry = ToolRegistry()
    for tool in create_market_tools(config, workspace, read_only=True):
        registry.register(tool)

    server = Server(
        "marketbot-finance",
        version=__version__,
        instructions=(
            "Use these finance research tools with their source timestamps and provenance. "
            "Disclose delayed, fallback, and mock data. This server exposes research only "
            "and does not place orders."
        ),
    )

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name=definition["function"]["name"],
                description=definition["function"]["description"],
                inputSchema=definition["function"]["parameters"],
                annotations=types.ToolAnnotations(
                    readOnlyHint=True,
                    destructiveHint=False,
                    openWorldHint=definition["function"]["name"] not in {
                        "market_source_plan", "market_event_extract", "portfolio_risk",
                        "evidence_get", "evidence_list", "logic_chain_visualizer",
                    },
                ),
            )
            for definition in registry.get_definitions()
        ]

    # ToolRegistry applies the native safe casts and returns structured validation
    # errors. SDK validation would bypass that behavior and produce plain errors.
    @server.call_tool(validate_input=False)
    async def call_tool(name: str, arguments: dict[str, Any] | None) -> types.CallToolResult:
        result = await registry.execute(name, arguments or {})
        try:
            decoded = json.loads(result)
        except (json.JSONDecodeError, TypeError):
            decoded = None
        payload = decoded if isinstance(decoded, dict) else None
        is_error = payload is not None and (
            payload.get("ok") is False or bool(payload.get("error"))
        )
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=result)],
            structuredContent=payload,
            isError=is_error,
        )

    return server


async def serve(workspace: Path, config: MarketToolsConfig) -> None:
    """Reserve stdout for protocol messages, including during source requests."""
    with redirect_stdout(sys.stderr):
        server = create_finance_server(workspace, config)
    async with stdio_server() as (read_stream, write_stream):
        # The transport has captured its stdout stream. Library progress messages
        # and other ordinary prints can now safely use stderr throughout the run.
        with redirect_stdout(sys.stderr):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )


def main() -> None:
    """CLI entrypoint for bundled finance MCP clients."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workspace",
        type=Path,
        help="Agent workspace directory (config workspace or ~/.marketbot/workspace by default)",
    )
    parser.add_argument("--config", type=Path, help="MarketBot configuration JSON file")
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
    try:
        with redirect_stdout(sys.stderr):
            workspace, config = load_finance_settings(
                args.config.expanduser() if args.config else None,
                args.workspace,
            )
        asyncio.run(serve(workspace, config))
    except (OSError, ValueError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()

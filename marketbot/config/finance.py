"""Finance defaults and runtime preparation, separate from the generic runner."""

from __future__ import annotations

import re
import shutil
import sys
from typing import Any

from marketbot.config.schema import Config, MCPServerConfig, default_finance_mcp_servers

_ENV_REFERENCE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
_BUNDLED_MODULE_ARGS = ["-m", "marketbot.mcp.finance"]


def ensure_finance_defaults(config: Config) -> list[str]:
    """Add missing MCP presets while preserving existing servers and opt-outs."""
    added = []
    for name, server in default_finance_mcp_servers().items():
        if name not in config.tools.mcp_servers:
            config.tools.mcp_servers[name] = server
            added.append(name)
    return added


def prepare_mcp_servers(config: Config) -> dict[str, MCPServerConfig]:
    """Give the bundled subprocess the active interpreter, workspace and data config."""
    servers = {
        name: server.model_copy(deep=True) for name, server in config.tools.mcp_servers.items()
    }
    for server in servers.values():
        if server.command == "python" and server.args[:2] == _BUNDLED_MODULE_ARGS:
            server.command = sys.executable
            if "--config" not in server.args:
                if "--workspace" not in server.args:
                    server.args.extend(["--workspace", str(config.workspace_path)])
                server.env.setdefault(
                    "MARKETBOT_FINANCE_CONFIG", config.tools.market.model_dump_json(by_alias=True)
                )
            server.enabled = server.enabled and config.tools.market.enabled
    return servers


def mcp_configuration_status(config: Config) -> list[dict[str, Any]]:
    """Describe configuration readiness without connecting or exposing credentials."""
    import os

    rows = []
    for name, server in prepare_mcp_servers(config).items():
        fields = [
            server.command,
            server.url,
            *server.args,
            *server.env.values(),
            *server.headers.values(),
        ]
        required_env = {ref for value in fields for ref in _ENV_REFERENCE.findall(value)}
        missing_env = sorted(ref for ref in required_env if not os.environ.get(ref))
        resolved_command = _ENV_REFERENCE.sub(
            lambda match: os.environ.get(match.group(1), ""), server.command
        )
        command_found = bool(shutil.which(resolved_command)) if server.command else None
        transport = server.type or (
            "stdio"
            if server.command
            else "sse"
            if server.url.rstrip("/").endswith("/sse")
            else "streamableHttp"
        )
        if not server.enabled:
            state = "disabled"
        elif missing_env:
            state = "missing_environment"
        elif command_found is False:
            state = "missing_command"
        elif (transport == "stdio" and not server.command) or (
            transport != "stdio" and not server.url
        ):
            state = "missing_endpoint"
        else:
            state = "configured"
        rows.append(
            {
                "name": name,
                "enabled": server.enabled,
                "transport": transport,
                "state": state,
                "commandFound": command_found,
                "missingEnv": missing_env,
                "enabledTools": list(server.enabled_tools),
            }
        )
    return rows

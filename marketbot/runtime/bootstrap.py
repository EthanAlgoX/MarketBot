"""Bootstrap helpers for runtime tool registration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from marketbot.agent.tools.cron import CronTool
from marketbot.agent.tools.filesystem import EditFileTool, ListDirTool, ReadFileTool, WriteFileTool
from marketbot.agent.tools.message import MessageTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.agent.tools.shell import ExecTool
from marketbot.agent.tools.spawn import SpawnTool
from marketbot.agent.tools.web import WebFetchTool, WebSearchTool

if TYPE_CHECKING:
    from marketbot.agent.subagent import SubagentManager
    from marketbot.bus.queue import MessageBus
    from marketbot.config.schema import ExecToolConfig, MarketToolsConfig
    from marketbot.cron.service import CronService


@dataclass(slots=True)
class ToolBootstrapContext:
    """Runtime dependencies needed during tool registration."""

    workspace: Path
    bus: "MessageBus"
    subagents: "SubagentManager"
    exec_config: "ExecToolConfig"
    restrict_to_workspace: bool
    brave_api_key: str | None = None
    web_proxy: str | None = None
    cron_service: "CronService | None" = None
    market_config: "MarketToolsConfig | None" = None


class DomainPlugin(Protocol):
    """Pluggable domain registration contract."""

    def register(self, registry: ToolRegistry, ctx: ToolBootstrapContext) -> None:
        """Register domain tools into the shared registry."""


def register_core_tools(registry: ToolRegistry, ctx: ToolBootstrapContext) -> None:
    """Register runtime/core tools that are always available."""
    allowed_dir = ctx.workspace if ctx.restrict_to_workspace else None
    for cls in (ReadFileTool, WriteFileTool, EditFileTool, ListDirTool):
        registry.register(cls(workspace=ctx.workspace, allowed_dir=allowed_dir))

    registry.register(
        ExecTool(
            working_dir=str(ctx.workspace),
            timeout=ctx.exec_config.timeout,
            restrict_to_workspace=ctx.restrict_to_workspace,
            path_append=ctx.exec_config.path_append,
        )
    )
    registry.register(WebSearchTool(api_key=ctx.brave_api_key, proxy=ctx.web_proxy))
    registry.register(WebFetchTool(proxy=ctx.web_proxy))
    registry.register(MessageTool(send_callback=ctx.bus.publish_outbound))
    registry.register(SpawnTool(manager=ctx.subagents))
    if ctx.cron_service:
        registry.register(CronTool(ctx.cron_service))


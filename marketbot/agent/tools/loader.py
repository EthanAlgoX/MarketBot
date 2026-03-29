"""Tool loader for plugin-based tool registration."""

from __future__ import annotations

import inspect
from pathlib import Path
from typing import TYPE_CHECKING, Any, Type

from loguru import logger

from marketbot.agent.tools.base import Tool

if TYPE_CHECKING:
    from marketbot.agent.tools.registry import ToolRegistry


class ToolLoader:
    """
    Plugin-based tool loader.

    Allows registering tools by category and auto-discovery.
    """

    SYSTEM_TOOLS: list[Type[Tool]] = []
    MARKET_TOOLS: list[Type[Tool]] = []
    CUSTOM_TOOLS: list[Type[Tool]] = []

    @classmethod
    def register_system(cls, tool_class: Type[Tool]) -> None:
        """Register a system tool class."""
        cls.SYSTEM_TOOLS.append(tool_class)
        logger.debug("Registered system tool: {}", tool_class.__name__)

    @classmethod
    def register_market(cls, tool_class: Type[Tool]) -> None:
        """Register a market tool class."""
        cls.MARKET_TOOLS.append(tool_class)
        logger.debug("Registered market tool: {}", tool_class.__name__)

    @classmethod
    def register_custom(cls, tool_class: Type[Tool]) -> None:
        """Register a custom tool class."""
        cls.CUSTOM_TOOLS.append(tool_class)
        logger.debug("Registered custom tool: {}", tool_class.__name__)

    @classmethod
    def load_all(cls, registry: ToolRegistry, config: dict[str, Any]) -> None:
        """Load all registered tools into the registry."""
        workspace = config.get("workspace")
        allowed_dir = config.get("allowed_dir")
        market_config = config.get("market_config")
        brave_api_key = config.get("brave_api_key")
        web_proxy = config.get("web_proxy")
        cron_service = config.get("cron_service")

        for tool_class in cls.SYSTEM_TOOLS:
            try:
                tool = tool_class(workspace=workspace, allowed_dir=allowed_dir)
                registry.register(tool)
            except Exception:
                logger.exception("Failed to load system tool: {}", tool_class.__name__)

        for tool_class in cls.CUSTOM_TOOLS:
            try:
                tool = tool_class(workspace=workspace)
                registry.register(tool)
            except Exception:
                logger.exception("Failed to load custom tool: {}", tool_class.__name__)

        if market_config:
            for tool_class in cls.MARKET_TOOLS:
                try:
                    kwargs: dict[str, Any] = {"config": market_config}
                    signature = inspect.signature(tool_class.__init__)
                    if "workspace" in signature.parameters:
                        kwargs["workspace"] = workspace
                    tool = tool_class(**kwargs)
                    registry.register(tool)
                except Exception:
                    logger.exception("Failed to load market tool: {}", tool_class.__name__)

    @classmethod
    def clear(cls) -> None:
        """Clear all registered tools (mainly for testing)."""
        cls.SYSTEM_TOOLS.clear()
        cls.MARKET_TOOLS.clear()
        cls.CUSTOM_TOOLS.clear()


def register_tools():
    """Decorator/function to register built-in tools."""
    from marketbot.agent.tools.filesystem import (
        EditFileTool,
        ListDirTool,
        ReadFileTool,
        WriteFileTool,
    )
    from marketbot.agent.tools.shell import ExecTool
    from marketbot.agent.tools.web import WebFetchTool, WebSearchTool
    from marketbot.agent.tools.message import MessageTool
    from marketbot.agent.tools.spawn import SpawnTool
    from marketbot.agent.tools.cron import CronTool

    ToolLoader.register_system(ReadFileTool)
    ToolLoader.register_system(WriteFileTool)
    ToolLoader.register_system(EditFileTool)
    ToolLoader.register_system(ListDirTool)
    ToolLoader.register_system(ExecTool)
    ToolLoader.register_system(WebSearchTool)
    ToolLoader.register_system(WebFetchTool)
    ToolLoader.register_system(MessageTool)
    ToolLoader.register_system(SpawnTool)
    ToolLoader.register_system(CronTool)

    from marketbot.agent.tools.market import (
        IntelSearchTool,
        LogicChainVisualizerTool,
        MarketBriefTool,
        MarketChipDistributionTool,
        MarketEventExtractTool,
        MarketFundamentalsTool,
        MarketMacroTool,
        MarketNewsTool,
        MarketSignalTool,
        MarketSnapshotTool,
        MarketSocialSentimentTool,
        MarketSourcePlanTool,
        ThesisTrackerTool,
    )

    ToolLoader.register_market(MarketSnapshotTool)
    ToolLoader.register_market(MarketEventExtractTool)
    ToolLoader.register_market(MarketSourcePlanTool)
    ToolLoader.register_market(MarketSignalTool)
    ToolLoader.register_market(MarketChipDistributionTool)
    ToolLoader.register_market(MarketFundamentalsTool)
    ToolLoader.register_market(MarketNewsTool)
    ToolLoader.register_market(MarketSocialSentimentTool)
    ToolLoader.register_market(IntelSearchTool)
    ToolLoader.register_market(ThesisTrackerTool)
    ToolLoader.register_market(LogicChainVisualizerTool)
    ToolLoader.register_market(MarketMacroTool)
    ToolLoader.register_market(MarketBriefTool)

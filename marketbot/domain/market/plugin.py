"""Plugin registration for finance-first market tools."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

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
)
from marketbot.agent.tools.registry import ToolRegistry

if TYPE_CHECKING:
    from marketbot.agent.tools.base import Tool
    from marketbot.config.schema import MarketToolsConfig
    from marketbot.runtime.bootstrap import ToolBootstrapContext


def create_market_tools(
    config: MarketToolsConfig | None,
    workspace: Path,
    *,
    read_only: bool = False,
    language: str = "en",
) -> list[Tool]:
    """Share the native finance tool implementations with the bundled MCP server.

    The read-only surface omits signal rollout recording and brief artifact writes.
    Data sources, schemas, and validation remain owned by the existing tools.
    """
    if config is not None and not config.enabled:
        return []

    from marketbot.agent.tools.evidence import EvidenceGetTool, EvidenceListTool, EvidenceRecordTool
    from marketbot.agent.tools.portfolio import PortfolioRiskTool
    from marketbot.agent.tools.thesis import ThesisTrackerTool
    from marketbot.agent.tools.watch import MarketWatchTool

    tools = [
        MarketSnapshotTool(config=config, workspace=workspace),
        MarketEventExtractTool(config=config),
        MarketSourcePlanTool(),
        PortfolioRiskTool(),
        EvidenceGetTool(workspace),
        EvidenceListTool(workspace),
        LogicChainVisualizerTool(),
    ]
    if not read_only:
        tools.append(MarketSignalTool(config=config))
    tools.extend([
        MarketChipDistributionTool(config=config),
        MarketFundamentalsTool(config=config),
        MarketNewsTool(config=config, workspace=workspace),
        MarketSocialSentimentTool(config=config),
        MarketMacroTool(config=config, workspace=workspace),
    ])
    if not read_only:
        tools.append(MarketBriefTool(config=config, workspace=workspace, language=language))
        tools.extend([IntelSearchTool(config=config, workspace=workspace), EvidenceRecordTool(workspace), ThesisTrackerTool(config=config, workspace=workspace), MarketWatchTool(workspace)])
    return tools


class MarketDomainPlugin:
    """Register market domain tools independently from the core runtime."""

    def register(self, registry: ToolRegistry, ctx: ToolBootstrapContext) -> None:
        from marketbot.agent.tools.finance_evidence import FinanceEvidenceTool

        for tool in create_market_tools(ctx.market_config, ctx.workspace, language=ctx.language):
            if (tool.name.startswith("market_") and tool.name not in {"market_source_plan", "market_watch"}) or tool.name == "portfolio_risk":
                tool = FinanceEvidenceTool(tool, ctx.workspace)
            registry.register(tool)

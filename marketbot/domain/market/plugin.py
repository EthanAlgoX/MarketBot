"""Plugin registration for finance-first market tools."""

from __future__ import annotations

from marketbot.agent.tools.market import (
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
from marketbot.runtime.bootstrap import ToolBootstrapContext


class MarketDomainPlugin:
    """Register market domain tools independently from the core runtime."""

    def register(self, registry: ToolRegistry, ctx: ToolBootstrapContext) -> None:
        config = ctx.market_config
        if config is not None and not config.enabled:
            return

        registry.register(MarketSnapshotTool(config=config, workspace=ctx.workspace))
        registry.register(MarketEventExtractTool())
        registry.register(MarketSourcePlanTool())
        registry.register(MarketSignalTool(config=config))
        registry.register(MarketChipDistributionTool(config=config))
        registry.register(MarketFundamentalsTool(config=config))
        registry.register(MarketNewsTool(config=config, workspace=ctx.workspace))
        registry.register(MarketSocialSentimentTool(config=config))
        registry.register(MarketMacroTool(config=config, workspace=ctx.workspace))
        registry.register(MarketBriefTool(config=config, workspace=ctx.workspace))


"""Market domain services and plugins."""

from marketbot.domain.market.profile import build_market_runtime_profile

__all__ = ["MarketDomainPlugin", "build_market_runtime_profile"]


def __getattr__(name: str):
    """Keep pure domain stores importable without bootstrapping agent tools."""
    if name == "MarketDomainPlugin":
        from marketbot.domain.market.plugin import MarketDomainPlugin

        return MarketDomainPlugin
    raise AttributeError(name)

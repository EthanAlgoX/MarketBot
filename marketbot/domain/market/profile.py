"""Runtime capability profile for market-domain tools."""

from __future__ import annotations

from typing import Any


ALL_MARKETS = ["a-share", "hong-kong", "us", "global", "mixed"]


_SOURCE_MARKETS = {
    "mock": {"a-share", "hong-kong", "us", "global", "mixed"},
    "google": {"a-share", "hong-kong", "us", "global", "mixed"},
    "reuters": {"us", "global", "mixed"},
    "bloomberg": {"us", "global", "mixed"},
    "cls": {"a-share", "hong-kong", "mixed"},
    "bocha": {"a-share", "hong-kong", "mixed"},
    "brave": {"us", "global", "mixed"},
    "tavily": {"a-share", "hong-kong", "us", "global", "mixed"},
    "serpapi": {"a-share", "hong-kong", "us", "global", "mixed"},
}

_FRESHNESS_COMPATIBILITY = {
    "reference": {"reference", "end-of-day", "market-live", "intraday-live", "news-live", "event-live"},
    "end-of-day": {"end-of-day", "market-live", "intraday-live"},
    "market-live": {"market-live", "intraday-live"},
    "intraday-live": {"intraday-live"},
    "news-live": {"news-live", "event-live"},
    "event-live": {"news-live", "event-live"},
}


def build_market_runtime_profile(config: Any | None = None) -> dict[str, dict[str, list[str]]]:
    """Build a runtime capability profile from market tool configuration."""
    quote_source = getattr(config, "quote_source", "yahoo") or "yahoo"
    macro_source = getattr(config, "macro_source", "fred") or "fred"
    news_sources = [str(item).lower() for item in (getattr(config, "news_sources", None) or ["google"])]

    profile = {
        "tool_markets": {
            "market_snapshot": sorted(_quote_markets(quote_source)),
            "market_news": sorted(_news_markets(config, news_sources)),
            "market_macro": ["global", "mixed"],
            "market_source_plan": list(ALL_MARKETS),
            "market_signal": [],
            "market_brief": [],
            "market_event_extract": [],
            "market_social_sentiment": list(ALL_MARKETS),
            "market_fundamentals": list(ALL_MARKETS),
            "market_chip_distribution": ["a-share"],
        },
        "tool_freshness": {
            "market_snapshot": ["market-live", "intraday-live"],
            "market_news": sorted(_news_freshness(news_sources)),
            "market_macro": ["reference"] if macro_source == "manual" else ["end-of-day"],
            "market_source_plan": ["reference"],
            "market_signal": ["market-live", "intraday-live"],
            "market_brief": ["market-live", "intraday-live"],
            "market_event_extract": ["event-live", "news-live"],
            "market_social_sentiment": ["news-live"],
            "market_fundamentals": ["end-of-day"],
            "market_chip_distribution": ["end-of-day"],
        },
    }
    return profile


def freshness_satisfies(required: str | None, available: list[str] | set[str] | None) -> bool:
    """Return True when available freshness can satisfy the required freshness label."""
    if not required:
        return True
    accepted = _FRESHNESS_COMPATIBILITY.get(required, {required})
    available_set = {str(item).strip() for item in (available or []) if str(item).strip()}
    return bool(accepted & available_set)


def _quote_markets(source: str) -> set[str]:
    if source == "eastmoney":
        return {"a-share"}
    if source == "tickflow":
        return {"a-share"}
    if source in {"yahoo", "yfinance", "tradingview"}:
        return {"us", "hong-kong", "global", "mixed"}
    if source == "auto":
        return set(ALL_MARKETS)
    if source == "mock":
        return set(ALL_MARKETS)
    return {"global"}


def _news_markets(config: Any | None, sources: list[str]) -> set[str]:
    explicit = [source for source in sources if source != "auto"]
    if explicit:
        markets: set[str] = set()
        for source in explicit:
            if _source_enabled(config, source):
                markets.update(_SOURCE_MARKETS.get(source, set()))
        return markets or {"global"}

    # Auto-routing: treat support as available if at least one enabled provider exists per market lane.
    markets: set[str] = set()
    if any(_source_enabled(config, source) for source in ("bocha", "tavily", "serpapi", "google")):
        markets.update({"a-share", "hong-kong"})
    if any(_source_enabled(config, source) for source in ("brave", "tavily", "serpapi", "google")):
        markets.update({"us", "global"})
    if len(markets) > 1:
        markets.add("mixed")
    return markets or {"global"}


def _news_freshness(sources: list[str]) -> set[str]:
    if "mock" in sources:
        return {"reference"}
    if any(source in {"google", "reuters", "bloomberg", "cls", "bocha", "brave", "tavily", "serpapi"} for source in sources):
        return {"news-live", "event-live"}
    if "auto" in sources:
        return {"news-live", "event-live"}
    return {"reference"}


def _source_enabled(config: Any | None, source: str) -> bool:
    if source in {"mock", "google", "reuters", "bloomberg", "cls"}:
        return True
    api_key_attr = {
        "bocha": "bocha_api_key",
        "tavily": "tavily_api_key",
        "brave": "brave_api_key",
        "serpapi": "serpapi_api_key",
    }.get(source)
    if not api_key_attr:
        return False
    return bool(getattr(config, api_key_attr, "") or "")

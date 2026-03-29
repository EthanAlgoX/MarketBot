"""Market analysis tools for snapshot, event extraction, and signal generation."""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode
from xml.etree import ElementTree

import httpx
from loguru import logger

from marketbot.agent.tools.base import Tool
from marketbot.domain.intel.search import IntelSearchService
from marketbot.domain.market.sentiment import SentimentEngine
from marketbot.domain.market.thesis import ThesisStore
from marketbot.domain.market.services import (
    MarketMacroService,
    MarketNewsService,
    MarketSnapshotService,
    eastmoney_secid,
    is_a_share_symbol,
    is_hk_symbol,
    is_us_symbol,
    normalize_a_share_symbol,
    preferred_a_share_symbol,
    to_tickflow_symbol,
)
from marketbot.market_routing import classify_market_request
from marketbot.rl.policy import HeuristicMarketSignalPolicy
from marketbot.rl.recorder import MarketSignalRolloutRecorder
from marketbot.rl.types import MarketSignalFeatures

if TYPE_CHECKING:
    from marketbot.config.schema import MarketToolsConfig


def _clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value to [lower, upper]."""
    return max(lower, min(upper, value))


def _utc_now_iso() -> str:
    """ISO timestamp in UTC."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _weighted_price_band(points: list[tuple[float, float]], lower_q: float, upper_q: float) -> tuple[float, float]:
    """Return weighted quantile price band for normalized (price, weight) pairs."""
    if not points:
        return 0.0, 0.0
    ordered = sorted(points, key=lambda item: item[0])
    total = sum(weight for _, weight in ordered) or 1.0
    lower_target = total * lower_q
    upper_target = total * upper_q
    cumulative = 0.0
    lower_price = ordered[0][0]
    upper_price = ordered[-1][0]
    for price, weight in ordered:
        cumulative += weight
        if cumulative >= lower_target:
            lower_price = price
            break
    cumulative = 0.0
    for price, weight in ordered:
        cumulative += weight
        if cumulative >= upper_target:
            upper_price = price
            break
    return float(lower_price), float(upper_price)


def _band_concentration(low: float, high: float, avg_cost: float) -> float:
    """Approximate concentration from band width relative to average cost."""
    if avg_cost <= 0:
        return 0.0
    width_ratio = max(0.0, (high - low) / avg_cost)
    return _clamp(1.0 - width_ratio, 0.0, 1.0)


class MarketSnapshotTool(Tool):
    """Fetch a lightweight market snapshot for a set of symbols."""

    name = "market_snapshot"
    description = (
        "Get latest market snapshot for symbols (price, change, volume, flow hints). "
        "Useful for fast market-state checks."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {
                "type": "array",
                "description": "Ticker symbols, e.g. ['NVDA', 'SPY', 'BTC-USD']",
                "items": {"type": "string"},
            },
            "includeMacro": {
                "type": "boolean",
                "description": "Include macro summary metadata",
                "default": False,
            },
        },
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._max_symbols = int(config.snapshot_max_symbols) if config else 12
        self._source = config.quote_source if config else "yahoo"
        self._defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]
        self._service = MarketSnapshotService(config=config, workspace=workspace)

    @staticmethod
    def _normalize_symbols(symbols: list[str]) -> list[str]:
        cleaned: list[str] = []
        for s in symbols:
            symbol = (s or "").strip().upper()
            if not symbol:
                continue
            if not re.fullmatch(r"[A-Z0-9.\-_=^]{1,20}", symbol):
                continue
            if symbol not in cleaned:
                cleaned.append(symbol)
        return cleaned

    async def _fetch_yahoo(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_yahoo(symbols)

    async def _fetch_yfinance(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        rows, warnings = await self._fetch_yahoo(symbols)
        return [{**row, "provider": "yfinance"} for row in rows], warnings

    async def _fetch_tradingview(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        rows, warnings = await self._fetch_yahoo(symbols)
        return [{**row, "provider": "tradingview"} for row in rows], warnings

    async def _fetch_eastmoney(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_eastmoney(symbols)

    async def _fetch_tickflow(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_tickflow(symbols)

    async def _fetch_tencent_hk(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_tencent_hk(symbols)

    async def _fetch_tencent_cn(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_tencent_cn(symbols)

    async def _fetch_tencent_us(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_tencent_us(symbols)

    async def _fetch_auto(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_auto(symbols)

    async def execute(
        self, symbols: list[str] | None = None, includeMacro: bool = False, **kwargs: Any
    ) -> str:
        requested = symbols or self._defaults
        normalized = self._normalize_symbols(requested)[: self._max_symbols]
        if not normalized:
            return json.dumps({"error": "no valid symbols provided"}, ensure_ascii=False)

        self._service.reset_health()
        use_cn_tencent = any(is_a_share_symbol(symbol) for symbol in normalized)
        use_hk_tencent = any(is_hk_symbol(symbol) for symbol in normalized)
        use_us_tencent = any(is_us_symbol(symbol) for symbol in normalized)
        if self._source == "yahoo" and use_cn_tencent:
            effective_source = "tencent_cn"
        elif self._source == "yahoo" and use_hk_tencent:
            effective_source = "tencent_hk"
        elif self._source == "yahoo" and use_us_tencent:
            effective_source = "tencent_us"
        else:
            effective_source = self._source

        if effective_source == "mock":
            rows = []
            warnings = ["mock quote source is disabled"]
            self._service.record_health(
                "mock",
                fallback=True,
                warnings=warnings,
                reason="Mock quote source is disabled; no synthetic quotes returned.",
                provider_chain=["mock"],
            )
        elif effective_source == "eastmoney":
            rows, warnings = await self._fetch_eastmoney(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "tickflow":
            rows, warnings = await self._fetch_tickflow(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "tencent_cn":
            rows, warnings = await self._fetch_tencent_cn(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "tencent_hk":
            rows, warnings = await self._fetch_tencent_hk(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "tencent_us":
            rows, warnings = await self._fetch_tencent_us(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "auto":
            rows, warnings = await self._fetch_auto(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "yfinance":
            rows, warnings = await self._fetch_yfinance(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        elif effective_source == "tradingview":
            rows, warnings = await self._fetch_tradingview(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")
        else:
            rows, warnings = await self._fetch_yahoo(normalized)
            if not rows:
                warnings.append("quote source returned no usable quotes")

        result: dict[str, Any] = {
            "asOf": _utc_now_iso(),
            "source": effective_source,
            "symbols": normalized,
            "quotes": rows,
            "warnings": warnings,
            "sourceHealth": self._service.health_snapshot(),
            "routeTrace": self._service.route_trace(),
        }
        if includeMacro:
            result["macro"] = {
                "mode": "risk-on" if sum((row.get("changePct") or 0) for row in rows) >= 0 else "risk-off",
                "source": self._config.macro_source if self._config else "fred",
            }
        return json.dumps(result, ensure_ascii=False)


class MarketEventExtractTool(Tool):
    """Extract market event type, sentiment, and likely impacted assets from text."""

    name = "market_event_extract"
    description = (
        "Extract market event type and likely impacted assets from a headline/body. "
        "Returns structured event and impact hints."
    )
    parameters = {
        "type": "object",
        "properties": {
            "headline": {"type": "string", "description": "News headline"},
            "body": {"type": "string", "description": "News content/body"},
            "symbols": {
                "type": "array",
                "description": "Optional related symbols",
                "items": {"type": "string"},
            },
        },
        "required": ["headline"],
    }

    _EVENT_RULES: list[tuple[str, list[str], list[dict[str, str]]]] = [
        (
            "earnings",
            ["earnings", "guidance", "财报", "业绩", "利润", "营收"],
            [
                {"asset": "equity", "direction": "up", "reason": "strong earnings support valuation"},
                {"asset": "peer_equity", "direction": "up", "reason": "read-across to sector peers"},
            ],
        ),
        (
            "rate_hike",
            ["rate hike", "hawkish", "加息", "紧缩"],
            [
                {"asset": "growth_stocks", "direction": "down", "reason": "higher discount rate"},
                {"asset": "usd", "direction": "up", "reason": "rate differential support"},
            ],
        ),
        (
            "rate_cut",
            ["rate cut", "dovish", "降息", "宽松"],
            [
                {"asset": "growth_stocks", "direction": "up", "reason": "lower discount rate"},
                {"asset": "gold", "direction": "up", "reason": "real yield pressure"},
            ],
        ),
        (
            "geopolitical_conflict",
            ["war", "strike", "sanction", "袭击", "战争", "制裁"],
            [
                {"asset": "oil", "direction": "up", "reason": "supply-risk premium"},
                {"asset": "gold", "direction": "up", "reason": "flight-to-safety"},
                {"asset": "broad_equity", "direction": "down", "reason": "risk-off sentiment"},
            ],
        ),
        (
            "product_launch",
            ["launch", "new chip", "发布", "新品", "芯片"],
            [
                {"asset": "issuer_equity", "direction": "up", "reason": "new growth catalyst"},
                {"asset": "supply_chain", "direction": "up", "reason": "expected demand pull"},
            ],
        ),
    ]

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        backend = config.sentiment_backend if config else "lexicon"
        model = config.sentiment_model if config else ""
        self._sentiment = SentimentEngine(backend=backend, model=model)

    async def execute(
        self, headline: str, body: str = "", symbols: list[str] | None = None, **kwargs: Any
    ) -> str:
        text = f"{headline}\n{body}".strip()
        lower = text.lower()

        event_type = "other"
        affected_assets: list[dict[str, str]] = []
        for candidate, keywords, assets in self._EVENT_RULES:
            if any(keyword in lower for keyword in keywords):
                event_type = candidate
                affected_assets = assets
                break

        sentiment_result = self._sentiment.analyze_text(text)
        sentiment = sentiment_result.score
        sentiment_label = sentiment_result.label

        detected_symbols = []
        for token in re.findall(r"\b[A-Z]{2,6}(?:-[A-Z]{2,6})?\b", headline):
            if token not in detected_symbols:
                detected_symbols.append(token)
        for token in symbols or []:
            symbol = token.strip().upper()
            if symbol and symbol not in detected_symbols:
                detected_symbols.append(symbol)

        confidence = 0.45
        if event_type != "other":
            confidence += 0.25
        if abs(sentiment) >= 0.40:
            confidence += 0.15
        if detected_symbols:
            confidence += 0.10

        result = {
            "asOf": _utc_now_iso(),
            "headline": headline,
            "eventType": event_type,
            "sentimentScore": round(sentiment, 4),
            "sentimentLabel": sentiment_label,
            "sentimentBackend": sentiment_result.backend,
            "sentimentReason": sentiment_result.reason,
            "detectedSymbols": detected_symbols,
            "affectedAssets": affected_assets,
            "confidence": round(_clamp(confidence, 0.0, 1.0), 4),
        }
        return json.dumps(result, ensure_ascii=False)


class MarketSourcePlanTool(Tool):
    """Recommend provider routing and fallback chains for market-data tasks."""

    name = "market_source_plan"
    description = (
        "Recommend the best market-data and news providers for symbols/tasks across "
        "A-share, Hong Kong, and US markets, including fallback chains and integration gaps."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {
                "type": "array",
                "description": "Tickers or codes to plan for, e.g. ['600519', 'AAPL', '0700.HK']",
                "items": {"type": "string"},
            },
            "tasks": {
                "type": "array",
                "description": "Requested task types such as quote, history, chips, fundamentals, news, breadth",
                "items": {"type": "string"},
            },
            "headline": {"type": "string", "description": "Optional headline or context text"},
            "includeCurrentTools": {
                "type": "boolean",
                "description": "Include current marketbot tool mappings and future connector gaps",
                "default": True,
            },
        },
    }

    _TASK_ALIASES = {
        "quote": "quote",
        "quotes": "quote",
        "realtime": "quote",
        "real-time": "quote",
        "history": "history",
        "ohlcv": "history",
        "daily": "history",
        "chips": "chips",
        "chip": "chips",
        "fundamentals": "fundamentals",
        "fundamental": "fundamentals",
        "profile": "fundamentals",
        "news": "news",
        "intel": "news",
        "event": "news",
        "events": "news",
        "breadth": "breadth",
        "sector": "breadth",
        "indices": "breadth",
    }

    @classmethod
    def _normalize_tasks(cls, tasks: list[str] | None) -> list[str]:
        normalized: list[str] = []
        for raw in tasks or []:
            value = cls._TASK_ALIASES.get(str(raw or "").strip().lower())
            if value and value not in normalized:
                normalized.append(value)
        return normalized or ["quote", "news"]

    @staticmethod
    def _market_for_symbols(symbols: list[str]) -> str:
        clean = [str(symbol or "").strip().upper() for symbol in symbols if str(symbol or "").strip()]
        if any(is_a_share_symbol(symbol) for symbol in clean):
            return "a-share"
        if any(symbol.startswith("HK") or symbol.endswith(".HK") or (symbol.isdigit() and len(symbol) == 5) for symbol in clean):
            return "hong-kong"
        if any(re.fullmatch(r"[A-Z]{1,5}(?:\.[A-Z]{1,2})?", symbol) for symbol in clean):
            return "us"
        return "mixed"

    @staticmethod
    def _quote_chain(market: str) -> tuple[list[str], str]:
        if market == "a-share":
            return ["tickflow", "tushare", "efinance", "akshare", "pytdx", "baostock"], "Prefer TickFlow for realtime A-share quotes when API-backed stability matters; otherwise fall back to the existing China data stack."
        if market == "hong-kong":
            return ["akshare", "yfinance"], "Akshare gives the strongest free HK path; use Yahoo as fallback."
        if market == "us":
            return ["yfinance"], "US symbols and indices should go straight to Yahoo-style routing for consistency."
        return ["tickflow-or-auto", "mock"], "Use TickFlow for mainland realtime quotes when configured; otherwise keep auto-routing across China and global sources."

    @staticmethod
    def _news_chain(market: str) -> tuple[list[str], str]:
        if market == "a-share":
            return ["bocha", "tavily", "serpapi"], "Chinese-market news should prefer Bocha, then Tavily, then SerpAPI."
        if market == "us":
            return ["brave", "tavily", "serpapi"], "US and global English news should prefer Brave."
        if market == "hong-kong":
            return ["bocha", "brave", "tavily", "serpapi"], "Hong Kong names often need both Chinese and English search fallback."
        return ["bocha-or-brave", "tavily", "serpapi"], "Mixed watchlists need split routing by language and market."

    @staticmethod
    def _task_plan(task: str, market: str) -> tuple[list[str], str, list[str], list[str]]:
        if task == "quote":
            providers, why = MarketSourcePlanTool._quote_chain(market)
            current_tools = ["market_snapshot (current)"]
            future = ["a_share_quote connector"] if market in {"a-share", "mixed"} else []
            return providers, why, current_tools, future
        if task == "history":
            providers, why = MarketSourcePlanTool._quote_chain(market)
            current_tools = ["market_snapshot (partial only; no OHLCV history yet)"]
            return providers, why, current_tools, ["ohlcv_history connector"]
        if task == "chips":
            return ["eastmoney-kline-local-cyq", "akshare"], "Chip distribution works best for A-share names with turnover-aware local estimation.", ["market_chip_distribution (current)"], []
        if task == "fundamentals":
            return ["tickflow", "eastmoney", "yahoo"], "Use TickFlow first for A-share profile and share-cap data when configured, then Eastmoney for mainland basics and Yahoo quote fields for global symbols.", ["market_fundamentals (current)"], []
        if task == "breadth":
            providers = ["efinance", "akshare", "tushare"] if market in {"a-share", "mixed"} else ["yfinance"]
            why = "China breadth and sector ranking are better served by Eastmoney-family or Tushare data."
            return providers, why, [], ["china_market_breadth connector"]
        providers, why = MarketSourcePlanTool._news_chain(market)
        return providers, why, ["market_news (current cross-market search)"], []

    @staticmethod
    def _skill_hints(task: str) -> list[str]:
        """Map routing tasks to the most relevant skill hints."""
        if task in {"quote", "history", "breadth"}:
            return ["stock-data-sourcing", "stock-info-explorer"]
        if task == "chips":
            return ["stock-data-sourcing", "market-report"]
        if task == "fundamentals":
            return ["stock-data-sourcing", "market-report", "risk-checklist"]
        return ["stock-data-sourcing", "catalyst-tracker", "news-intelligence"]

    async def execute(
        self,
        symbols: list[str] | None = None,
        tasks: list[str] | None = None,
        headline: str = "",
        includeCurrentTools: bool = True,
        **kwargs: Any,
    ) -> str:
        clean_symbols = MarketSnapshotTool._normalize_symbols(symbols or [])
        route = classify_market_request(symbols=clean_symbols, headline=headline)
        market = self._market_for_symbols(clean_symbols) if clean_symbols else str(route.get("primary", "mixed"))
        normalized_tasks = self._normalize_tasks(tasks)

        plans: list[dict[str, Any]] = []
        for task in normalized_tasks:
            providers, why, current_tools, future = self._task_plan(task, market)
            entry: dict[str, Any] = {
                "task": task,
                "providers": providers,
                "why": why,
                "freshness": "Prefer <=3 day news windows; disclose lag when using fallback or delayed sources.",
                "fallbacks": providers[1:],
                "recommendedSkills": self._skill_hints(task),
                "routingTelemetry": {
                    "skill": "stock-data-sourcing",
                    "tool": self.name,
                    "primaryProvider": providers[0] if providers else None,
                },
            }
            if includeCurrentTools:
                entry["currentMarketbotTools"] = current_tools
                entry["futureConnectors"] = future
            plans.append(entry)

        result = {
            "asOf": _utc_now_iso(),
            "symbols": clean_symbols,
            "market": market,
            "marketRoute": route,
            "tasks": plans,
            "recommendedSkills": ["stock-data-sourcing"],
            "routingTelemetry": {
                "skill": "stock-data-sourcing",
                "tool": self.name,
                "taskCount": len(plans),
            },
            "summary": (
                f"Use {' / '.join(plans[0]['providers']) if plans else 'market tools'} "
                f"for {market} routing; separate current marketbot tools from future connectors."
            ),
        }
        return json.dumps(result, ensure_ascii=False)


class MarketSignalTool(Tool):
    """Generate a risk-bounded market signal card from normalized factors."""

    name = "market_signal"
    description = (
        "Generate trading recommendation from momentum/sentiment/macro factors. "
        "Returns action, confidence, risk controls, and a signal card."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "Ticker symbol, e.g. NVDA"},
            "priceChangePct": {"type": "number", "description": "Recent % change (e.g. 1.8)"},
            "newsSentiment": {"type": "number", "description": "News sentiment in [-1,1]"},
            "socialSentiment": {"type": "number", "description": "Social sentiment in [-1,1]"},
            "macroRisk": {"type": "number", "description": "Macro risk score in [0,1]"},
            "evidence": {
                "type": "array",
                "description": "Supporting evidence bullet points",
                "items": {"type": "string"},
            },
        },
        "required": ["symbol"],
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        policy_cfg = getattr(config, "policy", None)
        self._policy_mode = getattr(policy_cfg, "mode", "heuristic") or "heuristic"
        rollout_log_path = getattr(policy_cfg, "rollout_log_path", "rl/market_signal.jsonl")
        self._recorder = MarketSignalRolloutRecorder(workspace=workspace, relative_path=rollout_log_path)

    def _risk_cfg(self) -> tuple[float, float, float]:
        if not self._config:
            return 0.58, 0.10, 0.03
        risk = self._config.risk
        return risk.min_confidence, risk.max_position_pct, risk.stop_loss_pct

    def _weights(self) -> tuple[float, float, float, float]:
        if not self._config:
            return 0.35, 0.30, 0.20, 0.15
        w = self._config.weights
        total = w.price_momentum + w.news_sentiment + w.social_sentiment + w.macro_regime
        if total <= 0:
            return 0.35, 0.30, 0.20, 0.15
        return (
            w.price_momentum / total,
            w.news_sentiment / total,
            w.social_sentiment / total,
            w.macro_regime / total,
        )

    def _policy(self) -> HeuristicMarketSignalPolicy:
        min_conf, max_pos, stop_loss = self._risk_cfg()
        return HeuristicMarketSignalPolicy(
            min_confidence=min_conf,
            max_position_pct=max_pos,
            stop_loss_pct=stop_loss,
            weights=self._weights(),
            mode=self._policy_mode,
        )

    async def execute(
        self,
        symbol: str,
        priceChangePct: float | None = None,
        newsSentiment: float | None = None,
        socialSentiment: float | None = None,
        macroRisk: float | None = None,
        evidence: list[str] | None = None,
        **kwargs: Any,
    ) -> str:
        symbol = symbol.strip().upper()
        if not symbol:
            return json.dumps({"error": "symbol is required"}, ensure_ascii=False)
        min_conf, max_pos, _ = self._risk_cfg()
        features = MarketSignalFeatures(
            symbol=symbol,
            price_change_pct=float(priceChangePct or 0.0),
            news_sentiment=float(newsSentiment or 0.0),
            social_sentiment=float(socialSentiment or 0.0),
            macro_risk=float(macroRisk or 0.0),
            evidence=list(evidence or []),
        )
        decision = self._policy().decide(features)
        structured_action = decision.action.to_dict()
        action = structured_action["action"]
        confidence = float(structured_action["confidence"])
        position_pct = float(structured_action["position_pct"])
        stop_loss = float(structured_action["stop_loss_pct"])
        risk_level = decision.risk_level
        rationale = list(decision.rationale)
        evidence_count = len(features.evidence)

        card = (
            f"### Signal Card | {symbol}\n"
            f"- Action: **{action.upper()}**\n"
            f"- Confidence: **{confidence:.2f}**\n"
            f"- Risk Level: **{risk_level.upper()}**\n"
            f"- Suggested Position: **{position_pct * 100:.2f}%**\n"
            f"- Stop Loss: **{stop_loss * 100:.2f}%**\n"
            f"- Rationale: {', '.join(rationale)}\n"
            f"- Evidence Count: {evidence_count}"
        )

        result = {
            "asOf": _utc_now_iso(),
            "symbol": symbol,
            "action": action,
            "score": decision.score,
            "confidence": round(confidence, 4),
            "riskLevel": risk_level,
            "positionPct": position_pct,
            "stopLossPct": stop_loss,
            "rationale": rationale,
            "evidence": features.evidence,
            "structuredAction": structured_action,
            "signalCard": card,
            "policy": {
                "requestedMode": decision.policy_mode,
                "effectiveMode": str(decision.diagnostics.get("effectiveMode", "heuristic")),
                "name": decision.policy_name,
                "diagnostics": decision.diagnostics,
            },
            "constraints": {
                "minConfidence": min_conf,
                "maxPositionPct": max_pos,
            },
        }
        recorded_path = self._recorder.record(features=features, decision=decision, rendered_result=result)
        if recorded_path is not None:
            result["rolloutLog"] = str(recorded_path)
        return json.dumps(result, ensure_ascii=False)


class MarketChipDistributionTool(Tool):
    """Estimate A-share chip distribution from Eastmoney daily kline + turnover data."""

    name = "market_chip_distribution"
    description = (
        "Estimate A-share chip distribution using Eastmoney daily kline history and turnover. "
        "Returns profit ratio, average cost, and 70/90 cost bands."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "A-share symbol, e.g. 600519 or SZ000001"},
            "lookbackDays": {
                "type": "integer",
                "description": "Number of daily bars to use for estimation",
                "minimum": 20,
                "maximum": 180,
                "default": 90,
            },
        },
        "required": ["symbol"],
    }

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._ut = "fa5fd1943c7b386f172d6893dbfba10b"

    async def _fetch_kline(self, symbol: str, lookback_days: int) -> tuple[list[str], str | None]:
        secid = eastmoney_secid(symbol)
        if not secid:
            return [], "unsupported symbol for chip distribution"
        params = {
            "secid": secid,
            "ut": self._ut,
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            "klt": "101",
            "fqt": "1",
            "end": "20500101",
            "lmt": str(lookback_days),
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
                response = await client.get(
                    "https://push2his.eastmoney.com/api/qt/stock/kline/get",
                    params=params,
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            return [], str(e)
        return list(payload.get("data", {}).get("klines", []) or []), None

    @staticmethod
    def _parse_bar(row: str) -> dict[str, float | str] | None:
        parts = [part.strip() for part in str(row).split(",")]
        if len(parts) < 11:
            return None
        try:
            volume = float(parts[5] or 0.0)
            amount = float(parts[6] or 0.0)
            turnover_pct = float(parts[10] or 0.0)
            return {
                "date": parts[0],
                "open": float(parts[1] or 0.0),
                "close": float(parts[2] or 0.0),
                "high": float(parts[3] or 0.0),
                "low": float(parts[4] or 0.0),
                "volume": volume,
                "amount": amount,
                "turnoverPct": turnover_pct,
            }
        except ValueError:
            return None

    @staticmethod
    def _estimate_distribution(bars: list[dict[str, float | str]]) -> dict[str, Any]:
        points: list[tuple[float, float]] = []
        if not bars:
            return {
                "currentPrice": None,
                "profitRatio": 0.0,
                "avgCost": None,
                "cost90Low": None,
                "cost90High": None,
                "concentration90": 0.0,
                "cost70Low": None,
                "cost70High": None,
                "concentration70": 0.0,
            }

        first_close = float(bars[0]["close"])
        points.append((first_close, 1.0))

        for bar in bars[1:]:
            turnover = _clamp(float(bar["turnoverPct"]) / 100.0, 0.0, 0.95)
            if turnover <= 0:
                continue
            typical = float(bar["amount"]) / float(bar["volume"]) if float(bar["volume"]) > 0 and float(bar["amount"]) > 0 else (
                float(bar["open"]) + float(bar["high"]) + float(bar["low"]) + float(bar["close"])
            ) / 4.0
            points = [(price, weight * (1.0 - turnover)) for price, weight in points if weight * (1.0 - turnover) > 1e-6]
            points.append((typical, turnover))

        total = sum(weight for _, weight in points) or 1.0
        normalized = [(price, weight / total) for price, weight in points]
        current_price = float(bars[-1]["close"])
        avg_cost = sum(price * weight for price, weight in normalized)
        profit_ratio = sum(weight for price, weight in normalized if price <= current_price)
        cost90_low, cost90_high = _weighted_price_band(normalized, 0.05, 0.95)
        cost70_low, cost70_high = _weighted_price_band(normalized, 0.15, 0.85)
        return {
            "currentPrice": round(current_price, 4),
            "profitRatio": round(_clamp(profit_ratio, 0.0, 1.0), 4),
            "avgCost": round(avg_cost, 4),
            "cost90Low": round(cost90_low, 4),
            "cost90High": round(cost90_high, 4),
            "concentration90": round(_band_concentration(cost90_low, cost90_high, avg_cost), 4),
            "cost70Low": round(cost70_low, 4),
            "cost70High": round(cost70_high, 4),
            "concentration70": round(_band_concentration(cost70_low, cost70_high, avg_cost), 4),
        }

    async def execute(self, symbol: str, lookbackDays: int = 90, **kwargs: Any) -> str:
        clean_symbol = str(symbol or "").strip().upper()
        if not is_a_share_symbol(clean_symbol):
            return json.dumps(
                {
                    "error": "chip distribution currently supports A-share symbols only",
                    "symbol": clean_symbol,
                },
                ensure_ascii=False,
            )

        lookback = int(_clamp(float(lookbackDays), 20.0, 180.0))
        klines, err = await self._fetch_kline(clean_symbol, lookback)
        if err:
            return json.dumps({"error": err, "symbol": clean_symbol}, ensure_ascii=False)

        bars = [bar for row in klines if (bar := self._parse_bar(row))]
        if len(bars) < 20:
            return json.dumps({"error": "insufficient kline history for chip estimation", "symbol": clean_symbol}, ensure_ascii=False)

        stats = self._estimate_distribution(bars)
        result = {
            "asOf": _utc_now_iso(),
            "symbol": normalize_a_share_symbol(clean_symbol),
            "source": "eastmoney-kline-local-cyq",
            "method": "turnover_decay_v1",
            "lookbackDays": lookback,
            "barsUsed": len(bars),
            **stats,
            "warnings": [
                "Chip distribution is an approximation derived from daily kline and turnover, not broker-level positions."
            ],
        }
        return json.dumps(result, ensure_ascii=False)


class MarketFundamentalsTool(Tool):
    """Fetch lightweight valuation and profile fields for A-share and global symbols."""

    name = "market_fundamentals"
    description = (
        "Get lightweight fundamentals and valuation fields such as market cap, PE, PB, "
        "shares outstanding, and long name. Uses Eastmoney for A-share and Yahoo quote for global symbols."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {
                "type": "array",
                "description": "Tickers to inspect",
                "items": {"type": "string"},
            }
        },
        "required": ["symbols"],
    }

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._ut = "fa5fd1943c7b386f172d6893dbfba10b"
        self._tickflow_api_key = ((getattr(config, "tickflow_api_key", "") if config else "") or os.environ.get("TICKFLOW_API_KEY", "")).strip()

    @staticmethod
    def _scaled_hundred(value: Any) -> float | None:
        if value in (None, "", "-"):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if abs(number) >= 100:
            return round(number / 100.0, 4)
        return round(number, 4)

    async def _fetch_eastmoney(self, symbol: str) -> tuple[dict[str, Any] | None, str | None]:
        secid = eastmoney_secid(symbol)
        if not secid:
            return None, "unsupported symbol for eastmoney fundamentals"
        params = {
            "secid": secid,
            "ut": self._ut,
            "invt": "2",
            "fltt": "1",
            "fields": "f57,f58,f84,f85,f116,f117,f162,f167",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
                response = await client.get(
                    "https://push2.eastmoney.com/api/qt/stock/get",
                    params=params,
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            return None, str(e)

        data = payload.get("data") or {}
        if not data:
            return None, "empty eastmoney fundamentals payload"
        return {
            "symbol": str(data.get("f57") or normalize_a_share_symbol(symbol)).upper(),
            "name": data.get("f58"),
            "marketCap": data.get("f116"),
            "floatMarketCap": data.get("f117"),
            "sharesOutstanding": data.get("f84"),
            "floatShares": data.get("f85"),
            "trailingPE": self._scaled_hundred(data.get("f162")),
            "priceToBook": self._scaled_hundred(data.get("f167")),
            "currency": "CNY",
            "provider": "eastmoney",
        }, None

    async def _fetch_yahoo(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(
                    "https://query1.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": ",".join(symbols)},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            return [], [str(e)]

        results = payload.get("quoteResponse", {}).get("result", []) or []
        rows: list[dict[str, Any]] = []
        by_symbol = {str(row.get("symbol", "")).upper(): row for row in results if isinstance(row, dict)}
        for symbol in symbols:
            raw = by_symbol.get(symbol)
            if not raw:
                warnings.append(f"{symbol}: missing yahoo fundamentals")
                continue
            rows.append(
                {
                    "symbol": symbol,
                    "name": raw.get("longName") or raw.get("shortName") or symbol,
                    "marketCap": raw.get("marketCap"),
                    "floatMarketCap": raw.get("marketCap"),
                    "sharesOutstanding": raw.get("sharesOutstanding"),
                    "floatShares": raw.get("sharesOutstanding"),
                    "trailingPE": raw.get("trailingPE"),
                    "priceToBook": raw.get("priceToBook"),
                    "currency": raw.get("currency"),
                    "provider": "yahoo",
                }
            )
        return rows, warnings

    async def _fetch_yfinance(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        rows, warnings = await self._fetch_yahoo(symbols)
        return [{**row, "provider": "yfinance"} for row in rows], warnings

    async def _fetch_tickflow(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        normalized_pairs: list[tuple[str, str]] = []
        for symbol in symbols:
            normalized = to_tickflow_symbol(symbol)
            if not normalized:
                warnings.append(f"{symbol}: unsupported by tickflow fundamentals")
                continue
            normalized_pairs.append((symbol, normalized))

        if not normalized_pairs:
            return [], warnings
        if not self._tickflow_api_key:
            return [], warnings + ["tickflow fundamentals require TICKFLOW_API_KEY"]

        def _fetch_sync() -> tuple[list[dict[str, Any]], list[str]]:
            try:
                from tickflow import TickFlow
            except Exception as e:  # pragma: no cover - optional dependency state
                return [], warnings + [f"tickflow import failed: {e}"]

            client = TickFlow(api_key=self._tickflow_api_key, timeout=self._timeout)
            try:
                instruments = client.instruments.batch([item[1] for item in normalized_pairs])
                quotes = client.quotes.get(symbols=[item[1] for item in normalized_pairs])
            except Exception as e:
                return [], warnings + [f"tickflow fundamentals fetch failed: {e}"]
            finally:
                client.close()

            instrument_by_symbol = {
                str(item.get("symbol", "")).upper(): item
                for item in instruments
                if isinstance(item, dict) and str(item.get("symbol", "")).strip()
            }
            quote_by_symbol = {
                str(item.get("symbol", "")).upper(): item
                for item in quotes
                if isinstance(item, dict) and str(item.get("symbol", "")).strip()
            }

            rows: list[dict[str, Any]] = []
            local_warnings = list(warnings)
            for original, normalized in normalized_pairs:
                inst = instrument_by_symbol.get(normalized.upper())
                quote = quote_by_symbol.get(normalized.upper())
                if not inst:
                    local_warnings.append(f"{normalized}: missing tickflow instrument")
                    continue
                if not quote:
                    local_warnings.append(f"{normalized}: missing tickflow quote")
                    continue

                ext = inst.get("ext") if isinstance(inst.get("ext"), dict) else {}
                total_shares = ext.get("total_shares")
                float_shares = ext.get("float_shares")
                last_price = quote.get("last_price")
                market_cap = None
                float_market_cap = None
                try:
                    if total_shares is not None and last_price is not None:
                        market_cap = float(total_shares) * float(last_price)
                    if float_shares is not None and last_price is not None:
                        float_market_cap = float(float_shares) * float(last_price)
                except (TypeError, ValueError):
                    market_cap = None
                    float_market_cap = None

                rows.append(
                    {
                        "symbol": preferred_a_share_symbol(original),
                        "name": inst.get("name") or quote.get("name") or original,
                        "marketCap": market_cap,
                        "floatMarketCap": float_market_cap,
                        "sharesOutstanding": total_shares,
                        "floatShares": float_shares,
                        "trailingPE": None,
                        "priceToBook": None,
                        "currency": "CNY",
                        "provider": "tickflow",
                    }
                )
            return rows, local_warnings

        return await asyncio.to_thread(_fetch_sync)

    async def execute(self, symbols: list[str], **kwargs: Any) -> str:
        clean_symbols = MarketSnapshotTool._normalize_symbols(symbols)
        if not clean_symbols:
            return json.dumps({"error": "no valid symbols"}, ensure_ascii=False)

        a_share_symbols = [symbol for symbol in clean_symbols if is_a_share_symbol(symbol)]
        global_symbols = [symbol for symbol in clean_symbols if symbol not in a_share_symbols]
        rows: list[dict[str, Any]] = []
        warnings: list[str] = []

        if getattr(self._config, "quote_source", "yahoo") == "tickflow":
            tickflow_rows, tickflow_warnings = await self._fetch_tickflow(a_share_symbols)
            rows.extend(tickflow_rows)
            warnings.extend(tickflow_warnings)
        else:
            for symbol in a_share_symbols:
                item, err = await self._fetch_eastmoney(symbol)
                if err:
                    warnings.append(f"{symbol}: {err}")
                    continue
                if item:
                    rows.append(item)

        if global_symbols:
            if getattr(self._config, "quote_source", "yahoo") == "yfinance":
                global_rows, global_warnings = await self._fetch_yfinance(global_symbols)
            else:
                global_rows, global_warnings = await self._fetch_yahoo(global_symbols)
            rows.extend(global_rows)
            warnings.extend(global_warnings)

        if not rows:
            return json.dumps({"error": "no fundamentals available", "warnings": warnings}, ensure_ascii=False)

        return json.dumps(
            {
                "asOf": _utc_now_iso(),
                "items": rows,
                "warnings": warnings,
            },
            ensure_ascii=False,
        )


class MarketNewsTool(Tool):
    """Fetch market-related headlines for symbols."""

    name = "market_news"
    description = (
        "Fetch recent market headlines for symbols and return structured items "
        "(title/source/time/link)."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {
                "type": "array",
                "description": "Ticker symbols to query news for",
                "items": {"type": "string"},
            },
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 6},
        },
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]
        self._sources = [s.lower() for s in ((config.news_sources if config else None) or ["google"])]
        self._news_max_age_days = int(config.news_max_age_days) if config else 3
        self._api_keys = {
            "bocha": (config.bocha_api_key if config else "") or "",
            "tavily": (config.tavily_api_key if config else "") or "",
            "brave": (config.brave_api_key if config else "") or "",
            "serpapi": (config.serpapi_api_key if config else "") or "",
        }
        self._service = MarketNewsService(config=config, workspace=workspace)

    @staticmethod
    def _mock_items(symbol: str, limit: int) -> list[dict[str, Any]]:
        return MarketNewsService.mock_items(symbol, limit)

    @staticmethod
    def _symbol_market(symbol: str) -> str:
        return MarketNewsService.symbol_market(symbol)

    def _search_days(self) -> int:
        return self._service.search_days()

    def _build_query(self, symbol: str, source_hint: str | None = None) -> str:
        return self._service.build_query(symbol, source_hint=source_hint)

    def _resolve_sources_for_symbol(self, symbol: str) -> list[str]:
        return self._service.resolve_sources_for_symbol(symbol)

    def _source_enabled(self, source: str) -> bool:
        return self._service.source_enabled(source)

    @staticmethod
    def _freshness_bucket(days: int) -> tuple[str, str, str]:
        return MarketNewsService.freshness_bucket(days)

    async def _fetch_google_rss(
        self, symbol: str, limit: int, source_hint: str | None = None
    ) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_google_rss(symbol, limit, source_hint=source_hint)

    async def _fetch_tavily(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_tavily(symbol, query, limit, days)

    async def _fetch_bocha(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_bocha(symbol, query, limit, days)

    async def _fetch_brave(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_brave(symbol, query, limit, days)

    async def _fetch_serpapi(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_serpapi(symbol, query, limit, days)

    async def _fetch_provider_news(
        self, source: str, symbol: str, limit: int, days: int
    ) -> tuple[list[dict[str, Any]], list[str]]:
        return await self._service.fetch_provider_news(source, symbol, limit, days)

    async def execute(self, symbols: list[str] | None = None, limit: int = 6, **kwargs: Any) -> str:
        symbols_in = symbols or self._defaults
        clean_symbols = MarketSnapshotTool._normalize_symbols(symbols_in)
        if not clean_symbols:
            return json.dumps({"error": "no valid symbols"}, ensure_ascii=False)

        self._service.reset_health()
        limit = int(_clamp(float(limit), 1.0, 20.0))
        all_items: list[dict[str, Any]] = []
        warnings: list[str] = []
        provider_by_symbol: dict[str, str] = {}
        search_days = self._search_days()

        for symbol in clean_symbols:
            resolved_sources = self._resolve_sources_for_symbol(symbol)
            symbol_items: list[dict[str, Any]] = []
            for source in resolved_sources:
                if not self._source_enabled(source):
                    warnings.append(f"{symbol}: source {source} unavailable")
                    continue
                items, item_warnings = await self._fetch_provider_news(source, symbol, limit, search_days)
                warnings.extend(item_warnings)
                if items:
                    symbol_items = items
                    provider_by_symbol[symbol] = source
                    break

            if not symbol_items:
                provider_by_symbol[symbol] = "unavailable"
                warnings.append(f"{symbol}: news source returned no usable items")

            all_items.extend(symbol_items)

        deduped: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in all_items:
            key = f"{item.get('symbol')}::{item.get('title')}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)

        return json.dumps(
            {
                "asOf": _utc_now_iso(),
                "sources": self._sources,
                "searchDays": search_days,
                "providerBySymbol": provider_by_symbol,
                "items": deduped[: max(1, len(clean_symbols) * limit)],
                "warnings": warnings,
                "sourceHealth": self._service.health_snapshot(),
                "routeTrace": self._service.route_trace(),
            },
            ensure_ascii=False,
        )


class MarketSocialSentimentTool(Tool):
    """Aggregate social sentiment for symbols from reddit/mock feeds."""

    name = "market_social_sentiment"
    description = (
        "Aggregate social sentiment from community posts for symbols. "
        "Returns per-symbol sentiment, confidence, and sampled posts."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {"type": "array", "items": {"type": "string"}},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
        },
    }

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]
        self._sources = [s.lower() for s in ((config.social_sources if config else None) or ["reddit"])]
        self._lookback_hours = int(config.social_lookback_hours) if config else 24
        self._post_limit = int(config.social_post_limit) if config else 30
        backend = config.sentiment_backend if config else "lexicon"
        model = config.sentiment_model if config else ""
        self._sentiment = SentimentEngine(backend=backend, model=model)

    @staticmethod
    def _resolve_sources_for_symbol(symbol: str, configured_sources: list[str]) -> list[str]:
        market = MarketNewsService.symbol_market(symbol)
        if "mock" in configured_sources:
            return ["mock"]
        if market in {"a-share", "hong-kong"}:
            return ["mock"]
        if "reddit" in configured_sources:
            return ["reddit"]
        return ["mock"]

    @staticmethod
    def _mock_summary(symbol: str, limit: int) -> dict[str, Any]:
        seed = sum(ord(c) for c in symbol)
        sentiment = _clamp(((seed % 21) - 10) / 10.0, -1.0, 1.0)
        confidence = _clamp(0.45 + (abs(sentiment) * 0.25), 0.1, 0.95)
        mentions = max(6, min(limit, 20))
        posts = [
            {
                "source": "mock",
                "title": f"{symbol} community tone sample #{i + 1}",
                "score": int(50 + (seed % 80) + i),
                "comments": int(8 + (seed % 20)),
                "sentiment": round(sentiment, 4),
                "publishedAt": _utc_now_iso(),
                "url": f"https://example.com/social/{symbol}/{i + 1}",
            }
            for i in range(min(3, mentions))
        ]
        return {
            "symbol": symbol,
            "sentiment": round(sentiment, 4),
            "confidence": round(confidence, 4),
            "mentions": mentions,
            "posts": posts,
        }

    async def _fetch_reddit(self, symbol: str, limit: int) -> tuple[dict[str, Any], str | None]:
        params = {
            "q": f"{symbol} stock OR {symbol} earnings OR {symbol} market",
            "sort": "new",
            "limit": str(limit),
            "t": "day",
            "restrict_sr": "false",
        }
        url = f"https://www.reddit.com/search.json?{urlencode(params)}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": "marketbot/0.1 (+https://github.com/HKUDS/marketbot)"},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            logger.error("market_social_sentiment reddit fetch failed for {}: {}", symbol, e)
            return {"symbol": symbol, "sentiment": 0.0, "confidence": 0.1, "mentions": 0, "posts": []}, str(e)

        children = payload.get("data", {}).get("children", [])
        cutoff_ts = datetime.now(UTC).timestamp() - (self._lookback_hours * 3600)

        weighted_sum = 0.0
        weight_total = 0.0
        posts: list[dict[str, Any]] = []

        for child in children:
            data = child.get("data", {}) if isinstance(child, dict) else {}
            created_utc = float(data.get("created_utc") or 0)
            if created_utc and created_utc < cutoff_ts:
                continue

            title = str(data.get("title") or "").strip()
            if not title:
                continue
            body = str(data.get("selftext") or "")
            text = f"{title}\n{body}".strip()
            sentiment_result = self._sentiment.analyze_text(text)
            sentiment = sentiment_result.score

            score = int(data.get("score") or 0)
            comments = int(data.get("num_comments") or 0)
            weight = max(0.1, math.log1p(max(score, 0) + max(comments, 0)))

            weighted_sum += sentiment * weight
            weight_total += weight

            published = (
                datetime.fromtimestamp(created_utc, tz=UTC).isoformat().replace("+00:00", "Z")
                if created_utc
                else _utc_now_iso()
            )
            permalink = str(data.get("permalink") or "")
            posts.append(
                {
                    "source": "reddit",
                    "title": title,
                    "subreddit": data.get("subreddit"),
                    "score": score,
                    "comments": comments,
                    "sentiment": round(sentiment, 4),
                    "sentimentBackend": sentiment_result.backend,
                    "publishedAt": published,
                    "url": f"https://www.reddit.com{permalink}" if permalink else "",
                }
            )

        mentions = len(posts)
        avg_sentiment = (weighted_sum / weight_total) if weight_total > 0 else 0.0
        confidence = _clamp((weight_total / 16.0), 0.1, 0.95)

        return {
            "symbol": symbol,
            "sentiment": round(_clamp(avg_sentiment, -1.0, 1.0), 4),
            "confidence": round(confidence, 4),
            "mentions": mentions,
            "posts": posts[: min(8, mentions)],
        }, None

    async def execute(self, symbols: list[str] | None = None, limit: int = 20, **kwargs: Any) -> str:
        symbols_in = symbols or self._defaults
        clean_symbols = MarketSnapshotTool._normalize_symbols(symbols_in)
        if not clean_symbols:
            return json.dumps({"error": "no valid symbols"}, ensure_ascii=False)

        limit = int(_clamp(float(limit), 1.0, float(self._post_limit)))
        summaries: list[dict[str, Any]] = []
        warnings: list[str] = []

        for symbol in clean_symbols:
            resolved_sources = self._resolve_sources_for_symbol(symbol, self._sources)

            if "mock" in resolved_sources:
                summaries.append(self._mock_summary(symbol, limit))
                continue

            if "reddit" in resolved_sources:
                summary, err = await self._fetch_reddit(symbol, limit)
                if err:
                    summary = self._mock_summary(symbol, limit)
                    warnings.append(f"{symbol}: {err}")
                    warnings.append(f"{symbol}: social source fallback: mock")
                summaries.append(summary)
                continue

            summaries.append(self._mock_summary(symbol, limit))
            warnings.append(f"{symbol}: unsupported social source, fallback to mock")

        total_mentions = sum(int(item.get("mentions", 0)) for item in summaries)
        overall_sentiment = 0.0
        if summaries:
            overall_sentiment = sum(float(item.get("sentiment", 0.0)) for item in summaries) / len(summaries)

        result = {
            "asOf": _utc_now_iso(),
            "sources": self._sources,
            "lookbackHours": self._lookback_hours,
            "sentimentBackend": self._sentiment.backend,
            "perSymbol": summaries,
            "overallSentiment": round(_clamp(overall_sentiment, -1.0, 1.0), 4),
            "totalMentions": total_mentions,
            "warnings": warnings,
        }
        return json.dumps(result, ensure_ascii=False)


class IntelSearchTool(Tool):
    """Search collected intel items from the workspace store."""

    name = "intel_search"
    description = (
        "Search collected intel items from the local workspace store using "
        "lightweight BM25 ranking. Useful for prior-news recall and thesis updates."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query over collected intel"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 5},
            "days": {"type": "integer", "minimum": 1, "maximum": 365, "default": 30},
            "scope": {"type": "string", "description": "Intel scope, usually workspace", "default": "workspace"},
            "scopeKey": {"type": "string", "description": "Intel scope key", "default": ""},
        },
        "required": ["query"],
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._workspace = Path(workspace) if workspace else None
        self._enabled = bool(config.intel_search_enabled) if config else True
        self._default_days = int(config.intel_search_default_days) if config else 30
        self._default_limit = int(config.intel_search_default_limit) if config else 5
        self._service = IntelSearchService(self._workspace) if self._workspace else None

    async def execute(
        self,
        query: str,
        limit: int | None = None,
        days: int | None = None,
        scope: str = "workspace",
        scopeKey: str = "",
        **kwargs: Any,
    ) -> str:
        clean_query = str(query or "").strip()
        if not clean_query:
            return json.dumps({"error": "query is required"}, ensure_ascii=False)
        if not self._enabled:
            return json.dumps({"error": "intel search is disabled in config"}, ensure_ascii=False)
        if self._service is None:
            return json.dumps({"error": "workspace is required for intel search"}, ensure_ascii=False)

        effective_limit = int(_clamp(float(limit or self._default_limit), 1.0, 50.0))
        effective_days = int(_clamp(float(days or self._default_days), 1.0, 365.0))
        hits = self._service.search(
            clean_query,
            limit=effective_limit,
            days=effective_days,
            scope=str(scope or "workspace"),
            scope_key=str(scopeKey or ""),
        )
        payload = {
            "asOf": _utc_now_iso(),
            "query": clean_query,
            "limit": effective_limit,
            "days": effective_days,
            "scope": str(scope or "workspace"),
            "scopeKey": str(scopeKey or ""),
            "hits": [hit.to_dict() for hit in hits],
            "hitCount": len(hits),
        }
        return json.dumps(payload, ensure_ascii=False)


class ThesisTrackerTool(Tool):
    """Create, inspect, and update tracked theses."""

    name = "thesis_tracker"
    description = (
        "Create, inspect, list, and update tracked market theses in the local "
        "workspace store. Useful for monitoring whether a thesis is strengthening, "
        "weakening, unchanged, or falsified."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "get", "list", "update"],
                "description": "Operation to perform",
            },
            "thesisId": {"type": "string"},
            "symbol": {"type": "string"},
            "thesis": {"type": "string"},
            "confidence": {"type": "number"},
            "confidenceDelta": {"type": "number"},
            "status": {"type": "string"},
            "note": {"type": "string"},
            "evidence": {"type": "string"},
            "verdict": {
                "type": "string",
                "enum": ["strengthened", "weakened", "unchanged", "falsified"],
            },
            "tags": {"type": "array", "items": {"type": "string"}},
            "drivers": {"type": "array", "items": {"type": "string"}},
            "risks": {"type": "array", "items": {"type": "string"}},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
        },
        "required": ["action"],
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._workspace = Path(workspace) if workspace else None
        self._store = ThesisStore(self._workspace) if self._workspace else None
        backend = config.sentiment_backend if config else "lexicon"
        model = config.sentiment_model if config else ""
        self._sentiment = SentimentEngine(backend=backend, model=model)

    async def execute(
        self,
        action: str,
        thesisId: str | None = None,
        symbol: str | None = None,
        thesis: str | None = None,
        confidence: float | None = None,
        confidenceDelta: float | None = None,
        status: str | None = None,
        note: str = "",
        evidence: str = "",
        verdict: str | None = None,
        tags: list[str] | None = None,
        drivers: list[str] | None = None,
        risks: list[str] | None = None,
        limit: int = 20,
        **kwargs: Any,
    ) -> str:
        if self._store is None:
            return json.dumps({"error": "workspace is required for thesis tracking"}, ensure_ascii=False)

        op = str(action or "").strip().lower()
        if op == "list":
            records = self._store.list_theses()[: max(1, limit)]
            return json.dumps(
                {
                    "asOf": _utc_now_iso(),
                    "action": "list",
                    "theses": [record.to_dict() for record in records],
                    "count": len(records),
                },
                ensure_ascii=False,
            )

        if op == "get":
            clean_id = str(thesisId or "").strip()
            if not clean_id:
                return json.dumps({"error": "thesisId is required for get"}, ensure_ascii=False)
            record = self._store.get_thesis(clean_id)
            if record is None:
                return json.dumps({"error": "thesis not found", "thesisId": clean_id}, ensure_ascii=False)
            return json.dumps({"asOf": _utc_now_iso(), "action": "get", "thesis": record.to_dict()}, ensure_ascii=False)

        if op == "create":
            clean_symbol = str(symbol or "").strip().upper()
            clean_thesis = str(thesis or "").strip()
            if not clean_symbol or not clean_thesis:
                return json.dumps({"error": "symbol and thesis are required for create"}, ensure_ascii=False)
            record = self._store.create_thesis(
                symbol=clean_symbol,
                thesis=clean_thesis,
                confidence=0.5 if confidence is None else float(confidence),
                tags=tags,
                drivers=drivers,
                risks=risks,
                note=note,
            )
            return json.dumps({"asOf": _utc_now_iso(), "action": "create", "thesis": record.to_dict()}, ensure_ascii=False)

        if op == "update":
            clean_id = str(thesisId or "").strip()
            if not clean_id:
                return json.dumps({"error": "thesisId is required for update"}, ensure_ascii=False)
            existing = self._store.get_thesis(clean_id)
            if existing is None:
                return json.dumps({"error": "thesis not found", "thesisId": clean_id}, ensure_ascii=False)
            verdict_value = verdict
            derived_sentiment = None
            if evidence.strip():
                sentiment_result = self._sentiment.analyze_text(evidence)
                derived_sentiment = sentiment_result.to_dict()
                if not verdict_value:
                    verdict_value = self._store.derive_verdict(sentiment_result.score)
            if not verdict_value:
                verdict_value = "unchanged"
            next_status = status or self._store.verdict_status(verdict_value, existing.status)
            record = self._store.update_thesis(
                clean_id,
                status=next_status,
                confidence=confidence,
                confidence_delta=confidenceDelta,
                note=note,
                verdict=verdict_value,
                evidence=evidence,
                tags=tags,
                drivers=drivers,
                risks=risks,
            )
            if record is None:
                return json.dumps({"error": "thesis not found", "thesisId": clean_id}, ensure_ascii=False)
            return json.dumps(
                {
                    "asOf": _utc_now_iso(),
                    "action": "update",
                    "verdict": verdict_value,
                    "derivedSentiment": derived_sentiment,
                    "thesis": record.to_dict(),
                },
                ensure_ascii=False,
            )

        return json.dumps({"error": f"unsupported action: {op}"}, ensure_ascii=False)


class LogicChainVisualizerTool(Tool):
    """Render a lightweight market logic chain as Mermaid."""

    name = "logic_chain_visualizer"
    description = (
        "Generate a Markdown + Mermaid logic chain for market narratives, "
        "transmission paths, and event-impact explanations."
    )
    parameters = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Title of the logic chain"},
            "nodes": {"type": "array", "items": {"type": "string"}},
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "from": {"type": "string"},
                        "to": {"type": "string"},
                        "label": {"type": "string"},
                    },
                    "required": ["from", "to"],
                },
            },
            "steps": {"type": "array", "items": {"type": "string"}},
            "direction": {"type": "string", "enum": ["TD", "LR"], "default": "TD"},
        },
        "required": ["title"],
    }

    @staticmethod
    def _node_id(index: int) -> str:
        return f"N{index + 1}"

    @staticmethod
    def _escape_label(text: str) -> str:
        return str(text or "").replace('"', "'").strip()

    async def execute(
        self,
        title: str,
        nodes: list[str] | None = None,
        edges: list[dict[str, Any]] | None = None,
        steps: list[str] | None = None,
        direction: str = "TD",
        **kwargs: Any,
    ) -> str:
        clean_title = str(title or "").strip()
        if not clean_title:
            return json.dumps({"error": "title is required"}, ensure_ascii=False)

        ordered_nodes = [str(item).strip() for item in (nodes or steps or []) if str(item).strip()]
        if len(ordered_nodes) < 2 and edges:
            discovered: list[str] = []
            for edge in edges:
                for key in ("from", "to"):
                    value = str((edge or {}).get(key) or "").strip()
                    if value and value not in discovered:
                        discovered.append(value)
            ordered_nodes = discovered

        if len(ordered_nodes) < 2:
            return json.dumps({"error": "at least two nodes or steps are required"}, ensure_ascii=False)

        node_ids = {label: self._node_id(index) for index, label in enumerate(ordered_nodes)}
        mermaid_lines = [f"graph {direction or 'TD'}"]
        for label in ordered_nodes:
            mermaid_lines.append(f'  {node_ids[label]}["{self._escape_label(label)}"]')

        clean_edges = [dict(edge) for edge in (edges or []) if isinstance(edge, dict)]
        if clean_edges:
            for edge in clean_edges:
                source = str(edge.get("from") or "").strip()
                target = str(edge.get("to") or "").strip()
                if source not in node_ids or target not in node_ids:
                    continue
                label = str(edge.get("label") or "").strip()
                connector = f' -->|"{self._escape_label(label)}"| ' if label else " --> "
                mermaid_lines.append(f"  {node_ids[source]}{connector}{node_ids[target]}")
        else:
            for current, nxt in zip(ordered_nodes, ordered_nodes[1:], strict=False):
                mermaid_lines.append(f"  {node_ids[current]} --> {node_ids[nxt]}")

        markdown_lines = [
            f"# Logic Chain: {clean_title}",
            "",
            "## Steps",
        ]
        markdown_lines.extend(f"- {label}" for label in ordered_nodes)
        markdown_lines.extend(["", "## Diagram", "", "```mermaid", *mermaid_lines, "```"])

        payload = {
            "asOf": _utc_now_iso(),
            "title": clean_title,
            "direction": direction or "TD",
            "nodes": ordered_nodes,
            "edges": clean_edges if clean_edges else [
                {"from": current, "to": nxt}
                for current, nxt in zip(ordered_nodes, ordered_nodes[1:], strict=False)
            ],
            "mermaid": "\n".join(mermaid_lines),
            "markdown": "\n".join(markdown_lines),
        }
        return json.dumps(payload, ensure_ascii=False)


class MarketMacroTool(Tool):
    """Load macro indicators and estimate a macro risk score."""

    name = "market_macro"
    description = (
        "Get macro indicators (rates, inflation, labor, yields) and compute "
        "a macro risk score in [0,1]."
    )
    parameters = {
        "type": "object",
        "properties": {
            "indicators": {
                "type": "array",
                "description": "Indicator ids (fedFunds,cpi,unemployment,us10y,dxy)",
                "items": {"type": "string"},
            },
        },
    }

    _SERIES_MAP = MarketMacroService.SERIES_MAP

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._source = config.macro_source if config else "fred"
        self._fred_api_key = (config.fred_api_key if config else "") or ""
        self._service = MarketMacroService(config=config, workspace=workspace)

    @staticmethod
    def _manual_fallback(indicators: list[str]) -> dict[str, Any]:
        return MarketMacroService.manual_fallback(indicators)

    async def _fetch_fred_series(self, series_id: str) -> tuple[float | None, float | None, str | None]:
        return await self._service.fetch_fred_series(series_id)

    async def execute(self, indicators: list[str] | None = None, **kwargs: Any) -> str:
        selected = indicators or ["fedFunds", "cpi", "unemployment", "us10y", "dxy"]
        clean = [k for k in selected if k in self._SERIES_MAP]
        if not clean:
            return json.dumps({"error": "no supported indicators requested"}, ensure_ascii=False)

        self._service.reset_health()
        if self._source == "manual":
            self._service.record_health(
                "manual",
                reason="Manual macro fallback mode is active.",
                provider_chain=["manual"],
            )
            payload = self._manual_fallback(clean)
            payload["sourceHealth"] = self._service.health_snapshot()
            payload["routeTrace"] = self._service.route_trace()
            return json.dumps(payload, ensure_ascii=False)

        rows: list[dict[str, Any]] = []
        warnings: list[str] = []
        by_name: dict[str, float] = {}

        for name in clean:
            series_id = self._SERIES_MAP[name]
            latest, delta, err = await self._fetch_fred_series(series_id)
            if err:
                warnings.append(f"{name}: {err}")
            if latest is not None:
                by_name[name] = latest
            rows.append(
                {
                    "name": name,
                    "seriesId": series_id,
                    "value": latest,
                    "delta": round(delta, 4) if isinstance(delta, float) else None,
                    "source": "fred",
                }
            )

        if not by_name:
            payload = self._manual_fallback(clean)
            fallback_warnings = list(warnings)
            fallback_warnings.extend(str(item) for item in payload.get("warnings", []) if str(item).strip())
            payload["warnings"] = fallback_warnings
            self._service.reset_health()
            self._service.record_health(
                "manual",
                warnings=fallback_warnings,
                fallback=True,
                reason="FRED data unavailable; using manual macro fallback.",
                provider_chain=["fred", "manual"],
            )
            payload["sourceHealth"] = self._service.health_snapshot()
            payload["routeTrace"] = self._service.route_trace()
            return json.dumps(payload, ensure_ascii=False)

        fed = by_name.get("fedFunds", 4.5)
        cpi = by_name.get("cpi", 3.0)
        us10y = by_name.get("us10y", 4.2)

        macro_risk = _clamp(((fed / 6.0) + max((cpi - 2.0) / 4.0, 0) + (us10y / 6.0)) / 3.0, 0.0, 1.0)
        regime = "risk-off" if macro_risk >= 0.60 else "neutral" if macro_risk >= 0.40 else "risk-on"

        result = {
            "asOf": _utc_now_iso(),
            "source": "fred",
            "indicators": rows,
            "macroRisk": round(macro_risk, 4),
            "regime": regime,
            "warnings": warnings,
            "sourceHealth": self._service.health_snapshot(),
            "routeTrace": self._service.route_trace(),
        }
        return json.dumps(result, ensure_ascii=False)


class MarketBriefTool(Tool):
    """Compose a market brief from snapshot, events, macro, and signal outputs."""

    name = "market_brief"
    description = (
        "Generate an end-to-end market brief: key moves, event impact, "
        "signal recommendations, and scenario playbook."
    )
    parameters = {
        "type": "object",
        "properties": {
            "symbols": {"type": "array", "items": {"type": "string"}},
            "headline": {"type": "string", "description": "Optional key headline to analyze"},
            "body": {"type": "string", "description": "Optional detail body for the headline"},
            "includeNews": {"type": "boolean", "default": True},
            "includeMacro": {"type": "boolean", "default": True},
            "includeSocial": {"type": "boolean", "default": True},
            "includeChips": {"type": "boolean", "default": True},
            "includeFundamentals": {"type": "boolean", "default": True},
            "includeIntelContext": {"type": "boolean", "default": True},
            "includeLogicChain": {"type": "boolean", "default": True},
            "thesisMode": {"type": "string", "enum": ["off", "create", "update"], "default": "off"},
            "thesisId": {"type": "string"},
            "thesisText": {"type": "string"},
        },
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._snapshot = MarketSnapshotTool(config=config, workspace=workspace)
        self._event = MarketEventExtractTool(config=config)
        self._signal = MarketSignalTool(config=config, workspace=workspace)
        self._chips = MarketChipDistributionTool(config=config)
        self._fundamentals = MarketFundamentalsTool(config=config)
        self._news = MarketNewsTool(config=config, workspace=workspace)
        self._social = MarketSocialSentimentTool(config=config)
        self._intel_search = IntelSearchTool(config=config, workspace=workspace)
        self._logic_chain = LogicChainVisualizerTool()
        self._thesis_tracker = ThesisTrackerTool(config=config, workspace=workspace)
        self._macro = MarketMacroTool(config=config, workspace=workspace)

    @staticmethod
    def _scenario_recommendations(action_rows: list[dict[str, Any]], macro_risk: float) -> dict[str, list[str]]:
        buys = [row["symbol"] for row in action_rows if row["action"] == "buy" and row["confidence"] >= 0.65]
        sells = [row["symbol"] for row in action_rows if row["action"] in {"sell", "reduce"}]

        aggressive = [f"Prioritize long setup: {', '.join(buys)}"] if buys else ["No high-confidence long setup"]
        neutral = ["Follow watchlist signals and stagger entries", "Keep position sizing under configured cap"]
        defensive = (
            [f"Reduce exposure on: {', '.join(sells)}", "Increase cash/hedge ratio"]
            if sells or macro_risk >= 0.60
            else ["No forced de-risking trigger", "Maintain stop-loss discipline"]
        )
        return {
            "aggressive": aggressive,
            "neutral": neutral,
            "defensive": defensive,
        }

    @staticmethod
    def _component_reliability(component: str, payload: dict[str, Any], enabled: bool) -> dict[str, Any]:
        """Normalize service observability fields for brief-level reporting."""
        if not enabled:
            return {
                "component": component,
                "enabled": False,
                "warnings": [],
                "sourceHealth": {},
                "routeTrace": [],
                "status": "disabled",
            }

        source_health = payload.get("sourceHealth") if isinstance(payload.get("sourceHealth"), dict) else {}
        route_trace = payload.get("routeTrace") if isinstance(payload.get("routeTrace"), list) else []
        warnings = [str(item) for item in payload.get("warnings", []) if str(item).strip()]
        statuses = [str(state.get("status", "unknown")) for state in source_health.values() if isinstance(state, dict)]
        overall_status = "ok"
        if any(status == "error" for status in statuses):
            overall_status = "error"
        elif any(status == "fallback" for status in statuses):
            overall_status = "fallback"
        elif any(status == "degraded" for status in statuses):
            overall_status = "degraded"
        elif any(status == "cached" for status in statuses):
            overall_status = "cached"

        return {
            "component": component,
            "enabled": True,
            "warnings": warnings,
            "sourceHealth": source_health,
            "routeTrace": route_trace,
            "status": overall_status,
        }

    @classmethod
    def _build_data_reliability(
        cls,
        snapshot: dict[str, Any],
        news: dict[str, Any],
        macro: dict[str, Any],
        *,
        include_news: bool,
        include_macro: bool,
    ) -> dict[str, Any]:
        """Collect component-level reliability details for the final brief."""
        components = {
            "snapshot": cls._component_reliability("snapshot", snapshot, enabled=True),
            "news": cls._component_reliability("news", news, enabled=include_news),
            "macro": cls._component_reliability("macro", macro, enabled=include_macro),
        }
        issues: list[str] = []
        for component, details in components.items():
            if not details["enabled"]:
                continue
            if details["status"] in {"fallback", "degraded", "error"}:
                issues.append(f"{component}:{details['status']}")
        overall_status = "ok"
        if any(details["status"] == "error" for details in components.values()):
            overall_status = "error"
        elif any(details["status"] == "fallback" for details in components.values()):
            overall_status = "fallback"
        elif any(details["status"] == "degraded" for details in components.values()):
            overall_status = "degraded"
        elif any(details["status"] == "cached" for details in components.values()):
            overall_status = "cached"

        return {
            "overallStatus": overall_status,
            "issues": issues,
            "components": components,
        }

    @staticmethod
    def _reliability_markdown_lines(data_reliability: dict[str, Any]) -> list[str]:
        """Render a compact reliability section for the markdown brief."""
        lines = [
            "",
            "### Data Reliability",
            f"- Overall: {data_reliability.get('overallStatus', 'unknown')}",
        ]
        for name, component in data_reliability.get("components", {}).items():
            if not component.get("enabled"):
                lines.append(f"- {name}: disabled")
                continue
            source_health = component.get("sourceHealth", {})
            source_bits = [
                f"{source}={state.get('status', 'unknown')}"
                for source, state in source_health.items()
                if isinstance(state, dict)
            ]
            selected_reason = ""
            for trace in component.get("routeTrace", []):
                if isinstance(trace, dict) and trace.get("selected") and trace.get("reason"):
                    selected_reason = str(trace["reason"])
                    break
            detail = ", ".join(source_bits) if source_bits else component.get("status", "unknown")
            warnings = component.get("warnings", [])
            suffix = f" | warnings={len(warnings)}" if warnings else ""
            lines.append(f"- {name}: {detail}{suffix}")
            if selected_reason:
                lines.append(f"  - reason: {selected_reason}")
        return lines

    @staticmethod
    def _news_availability_markdown_lines(news: dict[str, Any]) -> list[str]:
        """Render explicit per-symbol news availability notes when live items are missing."""
        provider_by_symbol = news.get("providerBySymbol") if isinstance(news.get("providerBySymbol"), dict) else {}
        if not provider_by_symbol:
            return []

        unavailable = [str(symbol).upper() for symbol, provider in provider_by_symbol.items() if str(provider) == "unavailable"]
        if not unavailable:
            return []

        lines = [
            "",
            "### News Availability",
            "- Live news items were unavailable for some symbols. No mock news was used.",
        ]
        for symbol in unavailable:
            lines.append(f"- {symbol}: live news unavailable")
        return lines

    @staticmethod
    def _logic_chain_steps(
        *,
        headline: str,
        event: dict[str, Any] | None,
        quotes: list[dict[str, Any]],
        macro: dict[str, Any],
    ) -> list[str]:
        """Build a compact causal chain from current brief inputs."""
        clean_headline = str(headline or "").strip()
        event_type = str((event or {}).get("eventType") or "market catalyst").replace("_", " ")
        impacted = [str(row.get("symbol", "")).upper() for row in quotes if str(row.get("symbol", "")).strip()]
        impact_label = ", ".join(impacted[:3]) if impacted else "target assets"
        regime = str(macro.get("regime") or "market regime")
        steps = [
            clean_headline or f"{event_type.title()} emerges",
            f"{event_type.title()} changes expectations",
            f"Positioning and sentiment shift in {impact_label}",
            f"Market reprices under {regime}",
        ]
        deduped: list[str] = []
        for step in steps:
            clean = str(step).strip()
            if clean and clean not in deduped:
                deduped.append(clean)
        return deduped

    async def execute(
        self,
        symbols: list[str] | None = None,
        headline: str = "",
        body: str = "",
        includeNews: bool = True,
        includeMacro: bool = True,
        includeSocial: bool = True,
        includeChips: bool = True,
        includeFundamentals: bool = True,
        includeIntelContext: bool = True,
        includeLogicChain: bool = True,
        thesisMode: str = "off",
        thesisId: str = "",
        thesisText: str = "",
        **kwargs: Any,
    ) -> str:
        snapshot = json.loads(await self._snapshot.execute(symbols=symbols, includeMacro=includeMacro))
        quotes = snapshot.get("quotes", [])

        macro = {"macroRisk": 0.5, "regime": "unknown", "warnings": []}
        if includeMacro:
            macro = json.loads(await self._macro.execute())

        event = None
        if headline.strip():
            event = json.loads(await self._event.execute(headline=headline, body=body, symbols=symbols))

        news = {"items": [], "warnings": []}
        if includeNews:
            news = json.loads(await self._news.execute(symbols=symbols, limit=4))

        intel_context = {"hits": [], "hitCount": 0}
        if includeIntelContext:
            query_parts = [str(item).upper() for item in (symbols or []) if str(item).strip()]
            if headline.strip():
                query_parts.append(headline.strip())
            query = " ".join(query_parts).strip()
            if query:
                intel_context = json.loads(await self._intel_search.execute(query=query, limit=3))

        social = {"perSymbol": [], "overallSentiment": 0.0, "warnings": []}
        if includeSocial:
            social = json.loads(await self._social.execute(symbols=symbols, limit=20))
        social_by_symbol = {
            str(item.get("symbol", "")).upper(): float(item.get("sentiment", 0.0))
            for item in social.get("perSymbol", [])
            if isinstance(item, dict)
        }
        chips_by_symbol: dict[str, dict[str, Any]] = {}
        chip_warnings: list[str] = []
        if includeChips:
            for row in quotes:
                symbol = str(row.get("symbol", "")).upper()
                if not is_a_share_symbol(symbol):
                    continue
                chip_payload = json.loads(await self._chips.execute(symbol=symbol))
                if chip_payload.get("error"):
                    chip_warnings.append(f"{symbol}: {chip_payload['error']}")
                    continue
                chips_by_symbol[symbol] = chip_payload
        fundamentals = {"items": [], "warnings": []}
        fundamentals_by_symbol: dict[str, dict[str, Any]] = {}
        if includeFundamentals and quotes:
            fundamentals = json.loads(
                await self._fundamentals.execute(
                    symbols=[str(row.get("symbol", "")).upper() for row in quotes if str(row.get("symbol", "")).strip()]
                )
            )
            for item in fundamentals.get("items", []):
                if isinstance(item, dict) and item.get("symbol"):
                    fundamentals_by_symbol[str(item["symbol"]).upper()] = item

        event_sentiment = float((event or {}).get("sentimentScore", 0.0))
        macro_risk = float(macro.get("macroRisk", 0.5))
        social_overall = float(social.get("overallSentiment", 0.0))

        actions: list[dict[str, Any]] = []
        for row in quotes:
            symbol = str(row.get("symbol", "")).upper()
            evidence = [f"flow={row.get('flowHint', 'neutral')}", f"momentum={row.get('momentum', 'flat')}"]
            if event:
                evidence.append(f"event={event.get('eventType')}")
            if includeSocial:
                evidence.append(f"social={social_by_symbol.get(symbol, 0.0):.2f}")
            chip = chips_by_symbol.get(symbol)
            if chip:
                evidence.append(f"chipProfit={float(chip.get('profitRatio', 0.0)):.2f}")
                evidence.append(f"avgCost={float(chip.get('avgCost', 0.0)):.2f}")
            fundamentals_row = fundamentals_by_symbol.get(symbol)
            if fundamentals_row:
                if fundamentals_row.get("trailingPE") is not None:
                    evidence.append(f"pe={float(fundamentals_row['trailingPE']):.2f}")
                if fundamentals_row.get("priceToBook") is not None:
                    evidence.append(f"pb={float(fundamentals_row['priceToBook']):.2f}")
            sig = json.loads(
                await self._signal.execute(
                    symbol=symbol,
                    priceChangePct=float(row.get("changePct") or 0.0),
                    newsSentiment=event_sentiment,
                    socialSentiment=social_by_symbol.get(symbol, social_overall),
                    macroRisk=macro_risk,
                    evidence=evidence,
                )
            )
            actions.append(
                {
                    "symbol": symbol,
                    "action": sig.get("action"),
                    "confidence": sig.get("confidence"),
                    "score": sig.get("score"),
                    "signalCard": sig.get("signalCard"),
                }
            )

        score_avg = sum(float(item.get("score", 0.0)) for item in actions) / max(len(actions), 1)
        composite = (score_avg * 0.75) + (social_overall * 0.25)
        sentiment_index = round(_clamp((composite + 1.0) / 2.0, 0.0, 1.0), 4)
        sentiment_state = "bullish" if sentiment_index >= 0.60 else "bearish" if sentiment_index <= 0.40 else "neutral"
        scenarios = self._scenario_recommendations(actions, macro_risk)
        market_route = classify_market_request(
            symbols=[str(row.get("symbol", "")).upper() for row in quotes],
            headline=headline,
            body=body,
        )
        data_reliability = self._build_data_reliability(
            snapshot,
            news,
            macro,
            include_news=includeNews,
            include_macro=includeMacro,
        )
        logic_chain = None
        if includeLogicChain and headline.strip():
            logic_chain = json.loads(
                await self._logic_chain.execute(
                    title=headline.strip(),
                    steps=self._logic_chain_steps(headline=headline, event=event, quotes=quotes, macro=macro),
                )
            )
        thesis_tracking = None
        thesis_mode = str(thesisMode or "off").strip().lower()
        if thesis_mode in {"create", "update"}:
            primary_symbol = str(quotes[0].get("symbol", "")).upper() if quotes else ""
            evidence_parts: list[str] = []
            if headline.strip():
                evidence_parts.append(headline.strip())
            if body.strip():
                evidence_parts.append(body.strip())
            if event:
                evidence_parts.append(
                    f"event={event.get('eventType')} sentiment={event.get('sentimentLabel')}:{float(event.get('sentimentScore', 0.0)):.2f}"
                )
            if actions:
                top_action = actions[0]
                evidence_parts.append(
                    f"signal={top_action.get('action')} confidence={float(top_action.get('confidence', 0.0)):.2f} score={float(top_action.get('score', 0.0)):.2f}"
                )
            if int(intel_context.get("hitCount", 0)) > 0:
                evidence_parts.append(f"prior_intel_hits={int(intel_context.get('hitCount', 0))}")
            evidence_text = " | ".join(part for part in evidence_parts if part)
            if thesis_mode == "create" and primary_symbol and str(thesisText or "").strip():
                thesis_tracking = json.loads(
                    await self._thesis_tracker.execute(
                        action="create",
                        symbol=primary_symbol,
                        thesis=str(thesisText or "").strip(),
                        confidence=max(0.35, min(0.95, sentiment_index)),
                        note=f"created from market_brief: {headline.strip() or primary_symbol}",
                    )
                )
            elif thesis_mode == "update" and str(thesisId or "").strip():
                thesis_tracking = json.loads(
                    await self._thesis_tracker.execute(
                        action="update",
                        thesisId=str(thesisId or "").strip(),
                        evidence=evidence_text,
                        note=f"updated from market_brief: {headline.strip() or primary_symbol}",
                    )
                )

        lines = [
            "## Market Brief",
            f"- As Of: {_utc_now_iso()}",
            f"- Market Focus: {market_route.get('primary', 'general')}",
            f"- Market Sentiment Index: {sentiment_index:.2f} ({sentiment_state})",
            f"- Macro Regime: {macro.get('regime', 'unknown')} (risk={macro_risk:.2f})",
            f"- Social Sentiment: {social_overall:.2f}",
            "",
            "### Signals",
        ]
        for row in actions:
            lines.append(
                f"- {row['symbol']}: {str(row['action']).upper()} | confidence={float(row['confidence']):.2f} | score={float(row['score']):.2f}"
            )
            chip = chips_by_symbol.get(row["symbol"])
            if chip:
                lines.append(
                    f"  - Chips: profit={float(chip.get('profitRatio', 0.0)):.2f} | avgCost={float(chip.get('avgCost', 0.0)):.2f} | 90% band={float(chip.get('cost90Low', 0.0)):.2f}-{float(chip.get('cost90High', 0.0)):.2f}"
                )
            fundamentals_row = fundamentals_by_symbol.get(row["symbol"])
            if fundamentals_row:
                pe = fundamentals_row.get("trailingPE")
                pb = fundamentals_row.get("priceToBook")
                market_cap = fundamentals_row.get("marketCap")
                lines.append(
                    f"  - Fundamentals: PE={float(pe):.2f} | PB={float(pb):.2f} | MktCap={float(market_cap):.0f}"
                    if pe is not None and pb is not None and market_cap is not None
                    else f"  - Fundamentals: {fundamentals_row.get('provider', 'unknown')} profile loaded"
                )
        lines += [
            "",
            "### Scenario Playbook",
            f"- Aggressive: {'; '.join(scenarios['aggressive'])}",
            f"- Neutral: {'; '.join(scenarios['neutral'])}",
            f"- Defensive: {'; '.join(scenarios['defensive'])}",
        ]

        if event:
            lines += [
                "",
                "### Event Impact",
                f"- Event: {event.get('eventType')}",
                f"- Sentiment: {event.get('sentimentLabel')} ({float(event.get('sentimentScore', 0.0)):.2f})",
            ]
        if int(intel_context.get("hitCount", 0)) > 0:
            lines += ["", "### Prior Intel Context"]
            for hit in intel_context.get("hits", [])[:3]:
                if not isinstance(hit, dict):
                    continue
                lines.append(
                    f"- {hit.get('title', 'untitled')} | source={hit.get('sourceName', 'unknown')} | score={float(hit.get('score', 0.0)):.2f}"
                )
        if logic_chain and logic_chain.get("markdown"):
            lines += ["", "### Logic Chain Appendix", str(logic_chain["markdown"])]
        if thesis_tracking and thesis_tracking.get("thesis"):
            tracked = thesis_tracking.get("thesis", {})
            lines += [
                "",
                "### Thesis Tracking",
                f"- Mode: {thesis_mode}",
                f"- Thesis ID: {tracked.get('id', '')}",
                f"- Status: {tracked.get('status', '')}",
                f"- Confidence: {float(tracked.get('confidence', 0.0)):.2f}",
            ]
            if thesis_tracking.get("verdict"):
                lines.append(f"- Verdict: {thesis_tracking.get('verdict')}")
        lines += self._reliability_markdown_lines(data_reliability)
        lines += self._news_availability_markdown_lines(news)

        result = {
            "asOf": _utc_now_iso(),
            "snapshot": snapshot,
            "event": event,
            "news": news,
            "social": social,
            "intelContext": intel_context,
            "logicChain": logic_chain,
            "thesisTracking": thesis_tracking,
            "chips": {"perSymbol": chips_by_symbol, "warnings": chip_warnings},
            "fundamentals": fundamentals,
            "macro": macro,
            "marketRoute": market_route,
            "signals": actions,
            "marketSentimentIndex": sentiment_index,
            "marketState": sentiment_state,
            "scenarios": scenarios,
            "dataReliability": data_reliability,
            "briefMarkdown": "\n".join(lines),
        }
        return json.dumps(result, ensure_ascii=False)

"""Market analysis tools for snapshot, event extraction, and signal generation."""

from __future__ import annotations

import json
import math
import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode
from xml.etree import ElementTree

import httpx
from loguru import logger

from marketbot.agent.tools.base import Tool
from marketbot.market_routing import classify_market_request

if TYPE_CHECKING:
    from marketbot.config.schema import MarketToolsConfig


def _clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value to [lower, upper]."""
    return max(lower, min(upper, value))


def _utc_now_iso() -> str:
    """ISO timestamp in UTC."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


_POSITIVE_SENTIMENT_TERMS = {
    "beat",
    "strong",
    "surge",
    "bullish",
    "upgrade",
    "record",
    "breakout",
    "rally",
    "growth",
}
_NEGATIVE_SENTIMENT_TERMS = {
    "miss",
    "weak",
    "bearish",
    "downgrade",
    "drop",
    "selloff",
    "lawsuit",
    "recession",
    "risk",
}


def _lexicon_sentiment(text: str) -> float:
    """Simple lexicon sentiment score in [-1, 1]."""
    lower = text.lower()
    pos = sum(1 for term in _POSITIVE_SENTIMENT_TERMS if term in lower)
    neg = sum(1 for term in _NEGATIVE_SENTIMENT_TERMS if term in lower)
    return _clamp((pos - neg) / 4.0, -1.0, 1.0)


def _is_a_share_symbol(symbol: str) -> bool:
    """Return True for mainland China stock / ETF tickers accepted by Eastmoney."""
    text = str(symbol or "").strip().upper()
    if not text:
        return False
    if text.startswith(("SH", "SZ")) and len(text) == 8 and text[2:].isdigit():
        return True
    return len(text) == 6 and text.isdigit()


def _normalize_a_share_symbol(symbol: str) -> str:
    """Normalize mainland China symbol to a 6-digit code."""
    text = str(symbol or "").strip().upper()
    if text.startswith(("SH", "SZ")) and len(text) == 8 and text[2:].isdigit():
        return text[2:]
    return text


def _eastmoney_secid(symbol: str) -> str | None:
    """Convert A-share / ETF ticker into Eastmoney secid format."""
    code = _normalize_a_share_symbol(symbol)
    if len(code) != 6 or not code.isdigit():
        return None
    if code.startswith(("600", "601", "603", "605", "688", "689", "510", "511", "512", "513", "515", "518", "520", "560", "580")):
        market = "1"
    else:
        market = "0"
    return f"{market}.{code}"


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

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._max_symbols = int(config.snapshot_max_symbols) if config else 12
        self._source = config.quote_source if config else "yahoo"
        self._defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]

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

    @staticmethod
    def _mock_quote(symbol: str) -> dict[str, Any]:
        # Deterministic mock based on symbol hash for stable tests/demos.
        seed = sum(ord(c) for c in symbol)
        price = round(50 + (seed % 500) * 0.7, 2)
        change_pct = round(((seed % 17) - 8) * 0.35, 2)
        volume = int(1_000_000 + (seed % 2_000_000))
        avg_volume = int(1_200_000 + (seed % 1_500_000))
        flow_ratio = volume / max(avg_volume, 1)
        flow_hint = "inflow" if flow_ratio >= 1.25 else "outflow" if flow_ratio <= 0.80 else "neutral"
        momentum = "up" if change_pct >= 1.0 else "down" if change_pct <= -1.0 else "flat"
        return {
            "symbol": symbol,
            "price": price,
            "changePct": change_pct,
            "volume": volume,
            "avgVolume": avg_volume,
            "flowRatio": round(flow_ratio, 3),
            "flowHint": flow_hint,
            "momentum": momentum,
            "currency": "USD",
            "marketState": "REGULAR",
        }

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
            logger.error("market_snapshot yahoo fetch failed: {}", e)
            return [], [f"quote fetch failed: {e}"]

        raw_rows = payload.get("quoteResponse", {}).get("result", [])
        by_symbol = {
            str(row.get("symbol", "")).upper(): row for row in raw_rows if isinstance(row, dict)
        }

        rows: list[dict[str, Any]] = []
        for symbol in symbols:
            raw = by_symbol.get(symbol)
            if not raw:
                warnings.append(f"missing quote for {symbol}")
                continue

            volume = int(raw.get("regularMarketVolume") or 0)
            avg_volume = int(raw.get("averageDailyVolume3Month") or 0)
            flow_ratio = (volume / avg_volume) if avg_volume > 0 else 0.0
            flow_hint = "inflow" if flow_ratio >= 1.25 else "outflow" if flow_ratio <= 0.80 else "neutral"
            change_pct = float(raw.get("regularMarketChangePercent") or 0.0)
            momentum = "up" if change_pct >= 1.0 else "down" if change_pct <= -1.0 else "flat"

            rows.append(
                {
                    "symbol": symbol,
                    "price": raw.get("regularMarketPrice"),
                    "changePct": round(change_pct, 4),
                    "volume": volume,
                    "avgVolume": avg_volume,
                    "flowRatio": round(flow_ratio, 3),
                    "flowHint": flow_hint,
                    "momentum": momentum,
                    "currency": raw.get("currency"),
                    "marketState": raw.get("marketState"),
                }
            )
        return rows, warnings

    async def _fetch_eastmoney(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        secid_pairs: list[tuple[str, str]] = []
        unsupported: list[str] = []

        for symbol in symbols:
            secid = _eastmoney_secid(symbol)
            if not secid:
                unsupported.append(symbol)
                continue
            secid_pairs.append((_normalize_a_share_symbol(symbol), secid))

        for symbol in unsupported:
            warnings.append(f"{symbol}: unsupported by eastmoney quote source")

        if not secid_pairs:
            return [], warnings

        params = {
            "fltt": "2",
            "invt": "2",
            "fields": "f12,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18",
            "secids": ",".join(secid for _, secid in secid_pairs),
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get("https://push2.eastmoney.com/api/qt/ulist.np/get", params=params)
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            logger.error("market_snapshot eastmoney fetch failed: {}", e)
            return [], warnings + [f"eastmoney quote fetch failed: {e}"]

        rows_raw = payload.get("data", {}).get("diff", []) or []
        by_code = {
            str(row.get("f12", "")).upper(): row
            for row in rows_raw
            if isinstance(row, dict) and str(row.get("f12", "")).strip()
        }

        rows: list[dict[str, Any]] = []
        for code, _secid in secid_pairs:
            raw = by_code.get(code)
            if not raw:
                warnings.append(f"missing eastmoney quote for {code}")
                continue

            change_pct = float(raw.get("f3") or 0.0)
            volume = int(float(raw.get("f5") or 0.0))
            momentum = "up" if change_pct >= 1.0 else "down" if change_pct <= -1.0 else "flat"
            rows.append(
                {
                    "symbol": code,
                    "name": raw.get("f14"),
                    "price": raw.get("f2"),
                    "changePct": round(change_pct, 4),
                    "changeAmount": raw.get("f4"),
                    "volume": volume,
                    "avgVolume": None,
                    "amount": raw.get("f6"),
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": momentum,
                    "currency": "CNY",
                    "marketState": "REGULAR",
                    "open": raw.get("f17"),
                    "high": raw.get("f15"),
                    "low": raw.get("f16"),
                    "preClose": raw.get("f18"),
                }
            )
        return rows, warnings

    async def _fetch_auto(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        cn_symbols = [symbol for symbol in symbols if _is_a_share_symbol(symbol)]
        global_symbols = [symbol for symbol in symbols if symbol not in cn_symbols]

        rows: list[dict[str, Any]] = []
        warnings: list[str] = []

        if cn_symbols:
            em_rows, em_warnings = await self._fetch_eastmoney(cn_symbols)
            rows.extend(em_rows)
            warnings.extend(em_warnings)
        if global_symbols:
            yahoo_rows, yahoo_warnings = await self._fetch_yahoo(global_symbols)
            rows.extend(yahoo_rows)
            warnings.extend(yahoo_warnings)

        return rows, warnings

    async def execute(
        self, symbols: list[str] | None = None, includeMacro: bool = False, **kwargs: Any
    ) -> str:
        requested = symbols or self._defaults
        normalized = self._normalize_symbols(requested)[: self._max_symbols]
        if not normalized:
            return json.dumps({"error": "no valid symbols provided"}, ensure_ascii=False)

        if self._source == "mock":
            rows = [self._mock_quote(symbol) for symbol in normalized]
            warnings: list[str] = []
        elif self._source == "eastmoney":
            rows, warnings = await self._fetch_eastmoney(normalized)
            if not rows:
                rows = [self._mock_quote(symbol) for symbol in normalized]
                warnings.append("quote source fallback: mock")
        elif self._source == "auto":
            rows, warnings = await self._fetch_auto(normalized)
            if not rows:
                rows = [self._mock_quote(symbol) for symbol in normalized]
                warnings.append("quote source fallback: mock")
        else:
            rows, warnings = await self._fetch_yahoo(normalized)
            if not rows:
                rows = [self._mock_quote(symbol) for symbol in normalized]
                warnings.append("quote source fallback: mock")

        result: dict[str, Any] = {
            "asOf": _utc_now_iso(),
            "source": self._source,
            "symbols": normalized,
            "quotes": rows,
            "warnings": warnings,
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

    _POSITIVE_TERMS = [
        "beat",
        "strong",
        "surge",
        "upgrade",
        "record",
        "超预期",
        "增长",
        "上调",
        "突破",
    ]
    _NEGATIVE_TERMS = [
        "miss",
        "weak",
        "downgrade",
        "lawsuit",
        "plunge",
        "爆雷",
        "下调",
        "下滑",
        "风险",
    ]

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

        pos_hits = sum(1 for term in self._POSITIVE_TERMS if term in lower)
        neg_hits = sum(1 for term in self._NEGATIVE_TERMS if term in lower)
        sentiment = _clamp((pos_hits - neg_hits) / 4.0, -1.0, 1.0)
        sentiment_label = "positive" if sentiment > 0.15 else "negative" if sentiment < -0.15 else "neutral"

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
        if any(_is_a_share_symbol(symbol) for symbol in clean):
            return "a-share"
        if any(symbol.startswith("HK") or symbol.endswith(".HK") or (symbol.isdigit() and len(symbol) == 5) for symbol in clean):
            return "hong-kong"
        if any(re.fullmatch(r"[A-Z]{1,5}(?:\.[A-Z]{1,2})?", symbol) for symbol in clean):
            return "us"
        return "mixed"

    @staticmethod
    def _quote_chain(market: str) -> tuple[list[str], str]:
        if market == "a-share":
            return ["tushare", "efinance", "akshare", "pytdx", "baostock"], "Prefer Tushare when token-backed stability matters; otherwise use efinance first."
        if market == "hong-kong":
            return ["akshare", "yfinance"], "Akshare gives the strongest free HK path; use Yahoo as fallback."
        if market == "us":
            return ["yfinance"], "US symbols and indices should go straight to Yahoo-style routing for consistency."
        return ["eastmoney-or-yahoo-auto", "mock"], "Use auto-routing across Eastmoney for CN symbols and Yahoo for global symbols."

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
            return ["akshare"], "Chip distribution is strongest on A-share specific providers.", [], ["a_share_chip_distribution connector"]
        if task == "fundamentals":
            return ["efinance", "yfinance"], "Company base info and board mapping are strongest on efinance for China names.", [], ["fundamentals/profile connector"]
        if task == "breadth":
            providers = ["efinance", "akshare", "tushare"] if market in {"a-share", "mixed"} else ["yfinance"]
            why = "China breadth and sector ranking are better served by Eastmoney-family or Tushare data."
            return providers, why, [], ["china_market_breadth connector"]
        providers, why = MarketSourcePlanTool._news_chain(market)
        return providers, why, ["market_news (current)"], ["cross_market_news_search connector"]

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

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config

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

    @staticmethod
    def _action_from_score(score: float) -> str:
        if score >= 0.35:
            return "buy"
        if score <= -0.35:
            return "sell"
        if score <= -0.15:
            return "reduce"
        return "watch"

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

        min_conf, max_pos, stop_loss = self._risk_cfg()
        wm, wn, ws, wr = self._weights()

        momentum = _clamp((priceChangePct or 0.0) / 5.0, -1.0, 1.0)
        news = _clamp(newsSentiment or 0.0, -1.0, 1.0)
        social = _clamp(socialSentiment or 0.0, -1.0, 1.0)
        macro_penalty = _clamp(macroRisk or 0.0, 0.0, 1.0)

        score = (wm * momentum) + (wn * news) + (ws * social) - (wr * macro_penalty)
        score = _clamp(score, -1.0, 1.0)
        action = self._action_from_score(score)

        evidence_count = len(evidence or [])
        confidence = 0.45 + abs(score) * 0.40 + min(evidence_count, 4) * 0.03
        confidence = _clamp(confidence, 0.05, 0.95)

        if confidence < min_conf:
            action = "watch"

        position_pct = 0.0 if action == "watch" else round(max_pos * confidence, 4)
        risk_level = "high" if macro_penalty >= 0.65 else "medium" if macro_penalty >= 0.35 else "low"

        rationale = [
            f"momentum={momentum:.2f}",
            f"news={news:.2f}",
            f"social={social:.2f}",
            f"macroRisk={macro_penalty:.2f}",
        ]

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
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "riskLevel": risk_level,
            "positionPct": position_pct,
            "stopLossPct": stop_loss,
            "rationale": rationale,
            "evidence": evidence or [],
            "signalCard": card,
            "constraints": {
                "minConfidence": min_conf,
                "maxPositionPct": max_pos,
            },
        }
        return json.dumps(result, ensure_ascii=False)


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

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]
        self._sources = [s.lower() for s in ((config.news_sources if config else None) or ["google"])]

    @staticmethod
    def _mock_items(symbol: str, limit: int) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for i in range(limit):
            direction = "up" if i % 2 == 0 else "down"
            items.append(
                {
                    "symbol": symbol,
                    "title": f"{symbol} market sentiment shifts {direction} [{i + 1}]",
                    "source": "mock",
                    "publishedAt": _utc_now_iso(),
                    "url": f"https://example.com/mock/{symbol}/{i}",
                }
            )
        return items

    async def _fetch_google_rss(self, symbol: str, limit: int) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        query = f"{symbol} stock market"
        params = {
            "q": query,
            "hl": "en-US",
            "gl": "US",
            "ceid": "US:en",
        }
        url = f"https://news.google.com/rss/search?{urlencode(params)}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                xml_text = response.text
        except Exception as e:
            logger.error("market_news fetch failed for {}: {}", symbol, e)
            return [], [f"{symbol}: {e}"]

        try:
            root = ElementTree.fromstring(xml_text)
        except Exception as e:
            return [], [f"{symbol}: invalid rss payload ({e})"]

        items: list[dict[str, Any]] = []
        for item in root.findall(".//item")[:limit]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            source_node = item.find("source")
            source_name = (source_node.text or "").strip() if source_node is not None else "google-news"

            if not title:
                continue
            items.append(
                {
                    "symbol": symbol,
                    "title": title,
                    "source": source_name or "google-news",
                    "publishedAt": pub_date or _utc_now_iso(),
                    "url": link,
                }
            )
        return items, warnings

    async def execute(self, symbols: list[str] | None = None, limit: int = 6, **kwargs: Any) -> str:
        symbols_in = symbols or self._defaults
        clean_symbols = MarketSnapshotTool._normalize_symbols(symbols_in)
        if not clean_symbols:
            return json.dumps({"error": "no valid symbols"}, ensure_ascii=False)

        limit = int(_clamp(float(limit), 1.0, 20.0))
        all_items: list[dict[str, Any]] = []
        warnings: list[str] = []

        for symbol in clean_symbols:
            if "mock" in self._sources:
                all_items.extend(self._mock_items(symbol, limit))
                continue
            items, item_warnings = await self._fetch_google_rss(symbol, limit)
            all_items.extend(items)
            warnings.extend(item_warnings)

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
                "items": deduped[: max(1, len(clean_symbols) * limit)],
                "warnings": warnings,
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
            sentiment = _lexicon_sentiment(text)

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
            if "mock" in self._sources:
                summaries.append(self._mock_summary(symbol, limit))
                continue

            if "reddit" in self._sources:
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
            "perSymbol": summaries,
            "overallSentiment": round(_clamp(overall_sentiment, -1.0, 1.0), 4),
            "totalMentions": total_mentions,
            "warnings": warnings,
        }
        return json.dumps(result, ensure_ascii=False)


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

    _SERIES_MAP = {
        "fedFunds": "FEDFUNDS",
        "cpi": "CPIAUCSL",
        "unemployment": "UNRATE",
        "us10y": "DGS10",
        "dxy": "DTWEXBGS",
    }

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._timeout = float(config.request_timeout_s) if config else 12.0
        self._source = config.macro_source if config else "fred"
        self._fred_api_key = (config.fred_api_key if config else "") or ""

    @staticmethod
    def _manual_fallback(indicators: list[str]) -> dict[str, Any]:
        now = _utc_now_iso()
        rows = [{"name": k, "value": None, "delta": None, "source": "manual"} for k in indicators]
        return {
            "asOf": now,
            "source": "manual",
            "indicators": rows,
            "macroRisk": 0.5,
            "regime": "unknown",
            "warnings": ["macro source is manual; provide FRED api key for live values"],
        }

    async def _fetch_fred_series(self, series_id: str) -> tuple[float | None, float | None, str | None]:
        if not self._fred_api_key:
            return None, None, "missing FRED api key"

        params = {
            "series_id": series_id,
            "api_key": self._fred_api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": "2",
        }
        url = f"https://api.stlouisfed.org/fred/series/observations?{urlencode(params)}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            return None, None, str(e)

        observations = payload.get("observations", [])
        values: list[float] = []
        for row in observations:
            raw = str(row.get("value", "."))
            if raw == ".":
                continue
            try:
                values.append(float(raw))
            except ValueError:
                continue

        if not values:
            return None, None, "no observations"

        latest = values[0]
        previous = values[1] if len(values) > 1 else values[0]
        return latest, (latest - previous), None

    async def execute(self, indicators: list[str] | None = None, **kwargs: Any) -> str:
        selected = indicators or ["fedFunds", "cpi", "unemployment", "us10y", "dxy"]
        clean = [k for k in selected if k in self._SERIES_MAP]
        if not clean:
            return json.dumps({"error": "no supported indicators requested"}, ensure_ascii=False)

        if self._source == "manual":
            return json.dumps(self._manual_fallback(clean), ensure_ascii=False)

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
            return json.dumps(self._manual_fallback(clean), ensure_ascii=False)

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
        },
    }

    def __init__(self, config: MarketToolsConfig | None = None):
        self._config = config
        self._snapshot = MarketSnapshotTool(config=config)
        self._event = MarketEventExtractTool()
        self._signal = MarketSignalTool(config=config)
        self._news = MarketNewsTool(config=config)
        self._social = MarketSocialSentimentTool(config=config)
        self._macro = MarketMacroTool(config=config)

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

    async def execute(
        self,
        symbols: list[str] | None = None,
        headline: str = "",
        body: str = "",
        includeNews: bool = True,
        includeMacro: bool = True,
        includeSocial: bool = True,
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

        social = {"perSymbol": [], "overallSentiment": 0.0, "warnings": []}
        if includeSocial:
            social = json.loads(await self._social.execute(symbols=symbols, limit=20))
        social_by_symbol = {
            str(item.get("symbol", "")).upper(): float(item.get("sentiment", 0.0))
            for item in social.get("perSymbol", [])
            if isinstance(item, dict)
        }

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

        result = {
            "asOf": _utc_now_iso(),
            "snapshot": snapshot,
            "event": event,
            "news": news,
            "social": social,
            "macro": macro,
            "marketRoute": market_route,
            "signals": actions,
            "marketSentimentIndex": sentiment_index,
            "marketState": sentiment_state,
            "scenarios": scenarios,
            "briefMarkdown": "\n".join(lines),
        }
        return json.dumps(result, ensure_ascii=False)

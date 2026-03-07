"""Market analysis tools for snapshot, event extraction, and signal generation."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import httpx
from loguru import logger

from marketbot.agent.tools.base import Tool

if TYPE_CHECKING:
    from marketbot.config.schema import MarketToolsConfig


def _clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value to [lower, upper]."""
    return max(lower, min(upper, value))


def _utc_now_iso() -> str:
    """ISO timestamp in UTC."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


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
        else:
            rows, warnings = await self._fetch_yahoo(normalized)

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

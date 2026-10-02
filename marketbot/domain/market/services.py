"""Market domain services used by market tools and skills."""

from __future__ import annotations

import asyncio
import math
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from xml.etree import ElementTree

import httpx
from loguru import logger

from marketbot.cache.market_cache import MarketCache
from marketbot.domain.market.provenance import source_timestamp


def clamp(value: float, lower: float, upper: float) -> float:
    """Clamp a numeric value into a closed interval."""
    return max(lower, min(upper, value))


def utc_now_iso() -> str:
    """Current UTC timestamp in ISO-8601 format."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def is_a_share_symbol(symbol: str) -> bool:
    """Return True for mainland China tickers supported by Eastmoney."""
    text = str(symbol or "").strip().upper()
    if not text:
        return False
    if re.fullmatch(r"\d{6}\.(SH|SZ|BJ)", text):
        return True
    if text.startswith(("SH", "SZ")) and len(text) == 8 and text[2:].isdigit():
        return True
    return len(text) == 6 and text.isdigit()


def normalize_a_share_symbol(symbol: str) -> str:
    """Normalize mainland tickers to a 6-digit code."""
    text = str(symbol or "").strip().upper()
    if re.fullmatch(r"\d{6}\.(SH|SZ|BJ)", text):
        return text.split(".", 1)[0]
    if text.startswith(("SH", "SZ")) and len(text) == 8 and text[2:].isdigit():
        return text[2:]
    return text


def is_hk_symbol(symbol: str) -> bool:
    """Return True for Hong Kong tickers supported by Eastmoney."""
    text = str(symbol or "").strip().upper()
    if not text:
        return False
    if text.startswith("HK") and 1 <= len(text[2:]) <= 5 and text[2:].isdigit():
        return True
    if text.endswith(".HK"):
        code = text[:-3]
        return 1 <= len(code) <= 5 and code.isdigit()
    return 1 <= len(text) <= 5 and text.isdigit()


def normalize_hk_symbol(symbol: str) -> str:
    """Normalize Hong Kong tickers to a 5-digit code."""
    text = str(symbol or "").strip().upper()
    if text.startswith("HK") and 1 <= len(text[2:]) <= 5 and text[2:].isdigit():
        return text[2:].zfill(5)
    if text.endswith(".HK"):
        code = text[:-3]
        if 1 <= len(code) <= 5 and code.isdigit():
            return code.zfill(5)
    if 1 <= len(text) <= 5 and text.isdigit():
        return text.zfill(5)
    return text


def is_us_symbol(symbol: str) -> bool:
    """Return True for plain US stock / ETF tickers that Tencent US quotes can serve."""
    text = str(symbol or "").strip().upper()
    return bool(re.fullmatch(r"[A-Z]{1,6}(?:\.[A-Z])?", text))


def eastmoney_secid(symbol: str) -> str | None:
    """Convert mainland ticker into Eastmoney secid format."""
    code = normalize_a_share_symbol(symbol)
    if len(code) != 6 or not code.isdigit():
        return None
    if code.startswith(
        ("600", "601", "603", "605", "688", "689", "510", "511", "512", "513", "515", "518", "520", "560", "580")
    ):
        market = "1"
    else:
        market = "0"
    return f"{market}.{code}"


def to_tickflow_symbol(symbol: str) -> str | None:
    """Normalize mainland tickers into TickFlow's CODE.EXCHANGE format."""
    text = str(symbol or "").strip().upper()
    if not text:
        return None
    if re.fullmatch(r"\d{6}\.(SH|SZ|BJ)", text):
        return text
    if text.startswith(("SH", "SZ", "BJ")) and len(text) == 8 and text[2:].isdigit():
        return f"{text[2:]}.{text[:2]}"
    if len(text) == 6 and text.isdigit():
        if text.startswith("6"):
            return f"{text}.SH"
        if text.startswith(("0", "1", "2", "3")):
            return f"{text}.SZ"
        if text.startswith(("4", "8", "9")):
            return f"{text}.BJ"
    return None


def preferred_a_share_symbol(symbol: str) -> str:
    """Preserve suffix form when provided, otherwise return normalized 6-digit code."""
    normalized = to_tickflow_symbol(symbol)
    if normalized:
        text = str(symbol or "").strip().upper()
        if "." in text:
            return normalized
    return normalize_a_share_symbol(symbol)


class MarketDomainService:
    """Common cache and health utilities for market-facing services."""

    def __init__(self, config: Any | None = None, workspace: Path | None = None):
        self._config = config
        self._workspace = workspace
        ttl_seconds = int(getattr(config, "cache_ttl_s", 60) or 60)
        self._cache = MarketCache(workspace, ttl_seconds=ttl_seconds) if workspace else None
        self._source_health: dict[str, dict[str, Any]] = {}
        self._route_trace: list[dict[str, Any]] = []

    def health_snapshot(self) -> dict[str, dict[str, Any]]:
        """Return the latest source health state for this service."""
        return {name: dict(state) for name, state in self._source_health.items()}

    def route_trace(self) -> list[dict[str, Any]]:
        """Return an ordered trace of provider routing decisions."""
        return [dict(item) for item in self._route_trace]

    def reset_health(self) -> None:
        """Clear prior health state before a fresh execution."""
        self._source_health.clear()
        self._route_trace.clear()

    def record_health(
        self,
        source: str,
        *,
        warnings: list[str] | None = None,
        error: str | None = None,
        cached: bool = False,
        fallback: bool = False,
        reason: str | None = None,
        provider_chain: list[str] | None = None,
        selected: bool = True,
    ) -> None:
        """Record source status for downstream observability."""
        warning_count = len(warnings or [])
        if error:
            status = "error"
        elif fallback:
            status = "fallback"
        elif warning_count:
            status = "degraded"
        elif cached:
            status = "cached"
        else:
            status = "ok"
        self._source_health[source] = {
            "status": status,
            "cached": cached,
            "warningCount": warning_count,
            "lastError": error,
            "reason": reason,
            "providerChain": list(provider_chain or []),
            "selected": selected,
        }
        self._route_trace.append(
            {
                "source": source,
                "status": status,
                "cached": cached,
                "selected": selected,
                "reason": reason,
                "warningCount": warning_count,
                "lastError": error,
            }
        )

    def _cache_key(self, prefix: str, *args: Any) -> tuple[Any, ...]:
        """Normalize cache args into a stable tuple."""
        normalized: list[Any] = [prefix]
        for arg in args:
            if isinstance(arg, list):
                normalized.append(tuple(arg))
            else:
                normalized.append(arg)
        return tuple(normalized)

    async def cached_call(
        self,
        source: str,
        prefix: str,
        args: tuple[Any, ...],
        fetcher,
    ) -> tuple[Any, bool]:
        """Fetch with optional workspace cache."""
        if not self._cache:
            return await fetcher(), False

        cache_key = self._cache_key(prefix, *args)
        cached = self._cache.get(*cache_key)
        if cached is not None:
            self.record_health(source, cached=True)
            return cached, True

        value = await fetcher()
        self._cache.set(value, *cache_key)
        return value, False


class MarketSnapshotService(MarketDomainService):
    """Domain service for quote snapshots."""

    def __init__(self, config: Any | None = None, workspace: Path | None = None):
        super().__init__(config=config, workspace=workspace)
        self.timeout = float(config.request_timeout_s) if config else 12.0
        self.source = config.quote_source if config else "yahoo"
        self.tickflow_api_key = ((getattr(config, "tickflow_api_key", "") if config else "") or os.environ.get("TICKFLOW_API_KEY", "")).strip()

    async def _fetch_tickflow_uncached(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        normalized_pairs: list[tuple[str, str]] = []

        for symbol in symbols:
            normalized = to_tickflow_symbol(symbol)
            if not normalized:
                warnings.append(f"{symbol}: unsupported by tickflow quote source")
                continue
            normalized_pairs.append((symbol, normalized))

        if not normalized_pairs:
            return [], warnings

        if not self.tickflow_api_key:
            return [], warnings + ["tickflow quote source requires TICKFLOW_API_KEY for realtime quotes"]

        def _fetch_sync() -> tuple[list[dict[str, Any]], list[str]]:
            try:
                from tickflow import TickFlow
            except Exception as e:  # pragma: no cover - depends on optional package state
                return [], warnings + [f"tickflow import failed: {type(e).__name__}"]

            client = TickFlow(api_key=self.tickflow_api_key, timeout=self.timeout)
            try:
                payload = client.quotes.get(symbols=[item[1] for item in normalized_pairs])
            except Exception as e:
                return [], warnings + [f"tickflow quote fetch failed: {type(e).__name__}"]
            finally:
                client.close()

            by_symbol = {
                str(row.get("symbol", "")).upper(): row
                for row in payload
                if isinstance(row, dict) and str(row.get("symbol", "")).strip()
            }

            rows: list[dict[str, Any]] = []
            local_warnings = list(warnings)
            for original, normalized in normalized_pairs:
                raw = by_symbol.get(normalized.upper())
                if not raw:
                    local_warnings.append(f"missing tickflow quote for {normalized}")
                    continue

                prev_close = raw.get("prev_close")
                last_price = raw.get("last_price")
                ext = raw.get("ext") if isinstance(raw.get("ext"), dict) else {}
                change_pct = ext.get("change_pct")
                if change_pct is None and prev_close not in (None, 0) and last_price is not None:
                    try:
                        change_pct = ((float(last_price) - float(prev_close)) / float(prev_close)) * 100.0
                    except (TypeError, ValueError, ZeroDivisionError):
                        change_pct = 0.0
                try:
                    change_pct = float(change_pct or 0.0)
                except (TypeError, ValueError):
                    change_pct = 0.0

                momentum = "up" if change_pct >= 1.0 else "down" if change_pct <= -1.0 else "flat"
                rows.append(
                    {
                        "symbol": preferred_a_share_symbol(original),
                        "name": raw.get("name"),
                        "price": last_price,
                        "changePct": round(change_pct, 4),
                        "changeAmount": None if prev_close in (None, "") or last_price is None else round(float(last_price) - float(prev_close), 4),
                        "volume": int(raw.get("volume") or 0),
                        "avgVolume": None,
                        "amount": raw.get("amount"),
                        "flowRatio": None,
                        "flowHint": "neutral",
                        "momentum": momentum,
                        "currency": "CNY",
                        "marketState": raw.get("session") or "REGULAR",
                        "open": raw.get("open"),
                        "high": raw.get("high"),
                        "low": raw.get("low"),
                        "preClose": prev_close,
                        "provider": "tickflow",
                        "observedAt": None,
                        "retrievedAt": utc_now_iso(),
                        "priceType": "as-of",
                    }
                )
            return rows, local_warnings

        return await asyncio.to_thread(_fetch_sync)

    async def fetch_tickflow(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "tickflow",
            "market_snapshot_tickflow",
            (symbols,),
            lambda: self._fetch_tickflow_uncached(symbols),
        )
        rows, warnings = result
        self.record_health(
            "tickflow",
            warnings=warnings,
            cached=cached,
            reason="TickFlow realtime quote routing for mainland tickers.",
            provider_chain=["tickflow"],
        )
        return rows, warnings

    async def _fetch_yahoo_uncached(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    "https://query1.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": ",".join(symbols)},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as e:
            logger.error("market_snapshot yahoo fetch failed: {}", type(e).__name__)
            return [], [f"quote fetch failed: {type(e).__name__}"]

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
                    "provider": "yahoo",
                    "observedAt": source_timestamp(raw.get("regularMarketTime")),
                    "retrievedAt": utc_now_iso(),
                    "priceType": "as-of",
                }
            )
        return rows, warnings

    async def fetch_yahoo(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "yahoo",
            "market_snapshot_yahoo",
            (symbols,),
            lambda: self._fetch_yahoo_uncached(symbols),
        )
        rows, warnings = result
        self.record_health(
            "yahoo",
            warnings=warnings,
            cached=cached,
            reason="Direct Yahoo quote routing for global symbols.",
            provider_chain=["yahoo"],
        )
        return rows, warnings

    async def _fetch_eastmoney_uncached(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        secid_pairs: list[tuple[str, str]] = []
        unsupported: list[str] = []

        for symbol in symbols:
            secid = eastmoney_secid(symbol)
            if not secid:
                unsupported.append(symbol)
                continue
            secid_pairs.append((normalize_a_share_symbol(symbol), secid))

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
            payload = await asyncio.to_thread(
                self._get_json_sync,
                "https://push2.eastmoney.com/api/qt/ulist.np/get",
                params=params,
            )
        except Exception as e:
            logger.error("market_snapshot eastmoney fetch failed: {}", type(e).__name__)
            return [], warnings + [f"eastmoney quote fetch failed: {type(e).__name__}"]

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
            is_hk = len(code) == 5 and code.isdigit()
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
                    "currency": "HKD" if is_hk else "CNY",
                    "marketState": "UNKNOWN",
                    "provider": "eastmoney",
                    "observedAt": None,
                    "retrievedAt": utc_now_iso(),
                    "priceType": "as-of",
                    "open": raw.get("f17"),
                    "high": raw.get("f15"),
                    "low": raw.get("f16"),
                    "preClose": raw.get("f18"),
                }
            )
        return rows, warnings

    async def fetch_eastmoney(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "eastmoney",
            "market_snapshot_eastmoney",
            (symbols,),
            lambda: self._fetch_eastmoney_uncached(symbols),
        )
        rows, warnings = result
        self.record_health(
            "eastmoney",
            warnings=warnings,
            cached=cached,
            reason="Eastmoney quote routing for mainland tickers.",
            provider_chain=["eastmoney"],
        )
        return rows, warnings

    async def _fetch_tencent_quotes_uncached(
        self,
        *,
        symbols: list[str],
        market: str,
    ) -> tuple[list[dict[str, Any]], list[str]]:
        warnings: list[str] = []
        if market == "hk":
            codes = [normalize_hk_symbol(symbol) for symbol in symbols if is_hk_symbol(symbol)]
            query = ",".join(f"hk{code}" for code in codes)
        elif market == "cn":
            codes = []
            for symbol in symbols:
                code = normalize_a_share_symbol(symbol)
                if len(code) == 6 and code.isdigit():
                    prefix = "sh" if eastmoney_secid(code) and eastmoney_secid(code).startswith("1.") else "sz"
                    codes.append(f"{prefix}{code}")
            query = ",".join(codes)
        elif market == "us":
            codes = [str(symbol or "").strip().upper() for symbol in symbols if is_us_symbol(symbol)]
            query = ",".join(f"us{code}" for code in codes)
        else:
            return [], [f"unsupported tencent market {market}"]

        if not query:
            return [], warnings

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(f"https://qt.gtimg.cn/q={query}")
                response.raise_for_status()
                text = response.text
        except Exception as e:
            logger.error("market_snapshot tencent {} fetch failed: {}", market, type(e).__name__)
            return [], [f"tencent {market} quote fetch failed: {type(e).__name__}"]

        rows: list[dict[str, Any]] = []
        for line in [item.strip() for item in text.split(";") if item.strip()]:
            if '="' not in line:
                continue
            prefix, payload = line.split('="', 1)
            raw = payload.rstrip('"')
            parts = raw.split("~")
            if len(parts) < 38:
                continue
            raw_symbol = parts[2].strip().upper()
            if not raw_symbol:
                continue
            symbol = raw_symbol
            if market == "us":
                matches = [code for code in codes if raw_symbol == code or raw_symbol.startswith(code + ".")]
                if matches:
                    symbol = max(matches, key=len)
            try:
                price = float(parts[3]) if parts[3] else None
                pre_close = float(parts[4]) if parts[4] else None
                open_price = float(parts[5]) if parts[5] else None
                volume = int(float(parts[6] or 0.0))
                change_amount = float(parts[31]) if parts[31] else None
                change_pct = float(parts[32]) if parts[32] else 0.0
                high = float(parts[33]) if parts[33] else None
                low = float(parts[34]) if parts[34] else None
                amount = float(parts[37]) if parts[37] else None
            except ValueError:
                warnings.append(f"invalid tencent {market} quote payload for {symbol}")
                continue

            momentum = "up" if change_pct >= 1.0 else "down" if change_pct <= -1.0 else "flat"
            rows.append(
                {
                    "symbol": symbol,
                    "name": parts[1].strip() or None,
                    "price": price,
                    "changePct": round(change_pct, 4),
                    "changeAmount": change_amount,
                    "volume": volume,
                    "avgVolume": None,
                    "amount": amount,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": momentum,
                    "currency": "HKD" if market == "hk" else "CNY" if market == "cn" else "USD",
                    "marketState": "UNKNOWN",
                    "provider": f"tencent_{market}",
                    "sourceTime": parts[30],
                    "observedAt": source_timestamp(parts[30], zone="Asia/Hong_Kong" if market == "hk" else "Asia/Shanghai" if market == "cn" else None),
                    "retrievedAt": utc_now_iso(),
                    "priceType": "as-of",
                    "open": open_price,
                    "high": high,
                    "low": low,
                    "preClose": pre_close,
                }
            )

        returned = {str(row.get("symbol", "")).upper() for row in rows}
        missing = []
        if market == "hk":
            missing = [code for code in [normalize_hk_symbol(symbol) for symbol in symbols if is_hk_symbol(symbol)] if code not in returned]
        elif market == "cn":
            missing = [normalize_a_share_symbol(symbol) for symbol in symbols if is_a_share_symbol(symbol) and normalize_a_share_symbol(symbol) not in returned]
        elif market == "us":
            missing = [str(symbol or "").strip().upper() for symbol in symbols if is_us_symbol(symbol) and str(symbol or "").strip().upper() not in returned]
        warnings.extend([f"missing tencent {market} quote for {code}" for code in missing])
        return rows, warnings

    async def fetch_tencent_hk(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "tencent_hk",
            "market_snapshot_tencent_hk",
            (symbols,),
            lambda: self._fetch_tencent_quotes_uncached(symbols=symbols, market="hk"),
        )
        rows, warnings = result
        self.record_health(
            "tencent_hk",
            warnings=warnings,
            cached=cached,
            reason="Tencent quote routing for Hong Kong tickers.",
            provider_chain=["tencent_hk"],
        )
        return rows, warnings

    async def fetch_tencent_cn(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "tencent_cn",
            "market_snapshot_tencent_cn",
            (symbols,),
            lambda: self._fetch_tencent_quotes_uncached(symbols=symbols, market="cn"),
        )
        rows, warnings = result
        self.record_health(
            "tencent_cn",
            warnings=warnings,
            cached=cached,
            reason="Tencent quote routing for mainland tickers.",
            provider_chain=["tencent_cn"],
        )
        return rows, warnings

    async def fetch_tencent_us(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        result, cached = await self.cached_call(
            "tencent_us",
            "market_snapshot_tencent_us",
            (symbols,),
            lambda: self._fetch_tencent_quotes_uncached(symbols=symbols, market="us"),
        )
        rows, warnings = result
        self.record_health(
            "tencent_us",
            warnings=warnings,
            cached=cached,
            reason="Tencent quote routing for US tickers.",
            provider_chain=["tencent_us"],
        )
        return rows, warnings

    async def fetch_auto(self, symbols: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        cn_symbols = [symbol for symbol in symbols if is_a_share_symbol(symbol)]
        hk_symbols = [symbol for symbol in symbols if is_hk_symbol(symbol)]
        us_symbols = [symbol for symbol in symbols if is_us_symbol(symbol) and symbol not in cn_symbols and symbol not in hk_symbols]
        global_symbols = [symbol for symbol in symbols if symbol not in cn_symbols and symbol not in hk_symbols and symbol not in us_symbols]

        rows: list[dict[str, Any]] = []
        warnings: list[str] = []

        if cn_symbols:
            cn_rows, cn_warnings = await self.fetch_tencent_cn(cn_symbols)
            rows.extend(cn_rows)
            warnings.extend(cn_warnings)

        if hk_symbols:
            hk_rows, hk_warnings = await self.fetch_tencent_hk(hk_symbols)
            rows.extend(hk_rows)
            warnings.extend(hk_warnings)

        if us_symbols:
            us_rows, us_warnings = await self.fetch_tencent_us(us_symbols)
            rows.extend(us_rows)
            warnings.extend(us_warnings)

        if global_symbols:
            global_rows, global_warnings = await self.fetch_yahoo(global_symbols)
            rows.extend(global_rows)
            warnings.extend(global_warnings)

        return rows, warnings


class MarketNewsService(MarketDomainService):
    """Domain service for market news retrieval and source routing."""

    def __init__(self, config: Any | None = None, workspace: Path | None = None):
        super().__init__(config=config, workspace=workspace)
        self.timeout = float(config.request_timeout_s) if config else 12.0
        self.defaults = (config.default_symbols if config else []) or ["SPY", "QQQ", "BTC-USD"]
        self.sources = [s.lower() for s in ((config.news_sources if config else None) or ["google"])]
        self.news_max_age_days = int(config.news_max_age_days) if config else 3
        self.api_keys = {
            "bocha": (config.bocha_api_key if config else "") or "",
            "tavily": (config.tavily_api_key if config else "") or "",
            "brave": (config.brave_api_key if config else "") or "",
            "serpapi": (config.serpapi_api_key if config else "") or "",
        }

    @staticmethod
    def mock_items(symbol: str, limit: int) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for i in range(limit):
            direction = "up" if i % 2 == 0 else "down"
            items.append(
                {
                    "symbol": symbol,
                    "title": f"{symbol} market sentiment shifts {direction} [{i + 1}]",
                    "source": "mock",
                    "publishedAt": utc_now_iso(),
                    "url": f"https://example.com/mock/{symbol}/{i}",
                }
            )
        return items

    @staticmethod
    def symbol_market(symbol: str) -> str:
        text = str(symbol or "").strip().upper()
        if is_a_share_symbol(text):
            return "a-share"
        if text.startswith("HK") or text.endswith(".HK") or (text.isdigit() and len(text) == 5):
            return "hong-kong"
        if re.fullmatch(r"[A-Z]{1,6}(?:-[A-Z]{2,6})?(?:\.[A-Z]{1,3})?", text):
            return "us"
        return "mixed"

    def search_days(self) -> int:
        weekday = datetime.now().weekday()
        if weekday == 0:
            return min(3, self.news_max_age_days)
        if weekday >= 5:
            return min(2, self.news_max_age_days)
        return min(1, self.news_max_age_days)

    def build_query(self, symbol: str, source_hint: str | None = None) -> str:
        market = self.symbol_market(symbol)
        if market == "a-share":
            base = f"{symbol} 股票 最新消息"
        elif market == "hong-kong":
            base = f"{symbol} 港股 最新消息"
        else:
            base = f"{symbol} stock latest news"
        return f"{base} {source_hint}".strip() if source_hint else base

    def resolve_sources_for_symbol(self, symbol: str) -> list[str]:
        explicit = [s for s in self.sources if s != "auto"]
        if "mock" in explicit:
            return ["mock"]
        if explicit:
            return explicit

        market = self.symbol_market(symbol)
        if market == "a-share":
            return ["bocha", "tavily", "serpapi", "google"]
        if market == "hong-kong":
            return ["bocha", "brave", "tavily", "serpapi", "google"]
        return ["brave", "tavily", "serpapi", "google"]

    def source_enabled(self, source: str) -> bool:
        if source in {"mock", "google", "reuters", "bloomberg", "cls"}:
            return True
        return bool(self.api_keys.get(source))

    @staticmethod
    def freshness_bucket(days: int) -> tuple[str, str, str]:
        if days <= 1:
            return "oneDay", "pd", "qdr:d"
        if days <= 7:
            return "oneWeek", "pw", "qdr:w"
        if days <= 30:
            return "oneMonth", "pm", "qdr:m"
        return "oneYear", "py", "qdr:y"

    async def fetch_google_rss(
        self, symbol: str, limit: int, source_hint: str | None = None
    ) -> tuple[list[dict[str, Any]], list[str]]:
        query = self.build_query(symbol, source_hint=source_hint)
        params = {"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"}
        url = f"https://news.google.com/rss/search?{urlencode(params)}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                xml_text = response.text
        except Exception as e:
            logger.error("market_news fetch failed for {}: {}", symbol, type(e).__name__)
            return [], [f"{symbol}: {type(e).__name__}"]

        try:
            root = ElementTree.fromstring(xml_text)
        except Exception as e:
            return [], [f"{symbol}: invalid rss payload ({type(e).__name__})"]

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
                    "provider": "google",
                    "publishedAt": source_timestamp(pub_date),
                    "sourcePublishedAt": pub_date or None,
                    "retrievedAt": utc_now_iso(),
                    "url": link,
                }
            )
        return items, []

    async def fetch_tavily(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        api_key = self.api_keys["tavily"]
        if not api_key:
            return [], [f"{symbol}: missing tavily api key"]
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "advanced",
            "max_results": limit,
            "include_answer": False,
            "include_raw_content": False,
            "days": days,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post("https://api.tavily.com/search", json=payload)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            return [], [f"{symbol}: tavily search failed ({type(e).__name__})"]

        items = [
            {
                "symbol": symbol,
                "title": row.get("title", ""),
                "source": row.get("url", ""),
                "provider": "tavily",
                "publishedAt": source_timestamp(row.get("published_date")),
                "sourcePublishedAt": row.get("published_date"),
                "retrievedAt": utc_now_iso(),
                "url": row.get("url", ""),
                "snippet": str(row.get("content", ""))[:500],
            }
            for row in data.get("results", [])[:limit]
            if row.get("title")
        ]
        return items, []

    async def fetch_bocha(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        api_key = self.api_keys["bocha"]
        if not api_key:
            return [], [f"{symbol}: missing bocha api key"]
        freshness, _, _ = self.freshness_bucket(days)
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"query": query, "freshness": freshness, "summary": True, "count": min(limit, 50)}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post("https://api.bocha.cn/v1/web-search", headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            return [], [f"{symbol}: bocha search failed ({type(e).__name__})"]

        value_list = data.get("data", {}).get("webPages", {}).get("value", [])
        items = [
            {
                "symbol": symbol,
                "title": row.get("name", ""),
                "source": row.get("siteName") or row.get("url", ""),
                "provider": "bocha",
                "publishedAt": source_timestamp(row.get("datePublished")),
                "sourcePublishedAt": row.get("datePublished"),
                "retrievedAt": utc_now_iso(),
                "url": row.get("url", ""),
                "snippet": str(row.get("summary") or row.get("snippet") or "")[:500],
            }
            for row in value_list[:limit]
            if row.get("name")
        ]
        return items, []

    async def fetch_brave(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        api_key = self.api_keys["brave"]
        if not api_key:
            return [], [f"{symbol}: missing brave api key"]
        _, freshness, _ = self.freshness_bucket(days)
        headers = {"X-Subscription-Token": api_key, "Accept": "application/json"}
        params = {
            "q": query,
            "count": min(limit, 20),
            "freshness": freshness,
            "search_lang": "en",
            "country": "US",
            "safesearch": "moderate",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers=headers,
                    params=params,
                )
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            return [], [f"{symbol}: brave search failed ({type(e).__name__})"]

        items = [
            {
                "symbol": symbol,
                "title": row.get("title", ""),
                "source": row.get("meta_url", {}).get("hostname") or row.get("url", ""),
                "provider": "brave",
                "publishedAt": source_timestamp(row.get("page_age")),
                "sourcePublishedAt": row.get("page_age") or row.get("age"),
                "retrievedAt": utc_now_iso(),
                "url": row.get("url", ""),
                "snippet": str(row.get("description", ""))[:500],
            }
            for row in data.get("web", {}).get("results", [])[:limit]
            if row.get("title")
        ]
        return items, []

    async def fetch_serpapi(self, symbol: str, query: str, limit: int, days: int) -> tuple[list[dict[str, Any]], list[str]]:
        api_key = self.api_keys["serpapi"]
        if not api_key:
            return [], [f"{symbol}: missing serpapi api key"]
        _, _, tbs = self.freshness_bucket(days)
        params = {
            "engine": "google",
            "q": query,
            "api_key": api_key,
            "tbs": tbs,
            "num": limit,
            "hl": "zh-cn" if self.symbol_market(symbol) in {"a-share", "hong-kong"} else "en",
            "gl": "cn" if self.symbol_market(symbol) in {"a-share", "hong-kong"} else "us",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get("https://serpapi.com/search.json", params=params)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            return [], [f"{symbol}: serpapi search failed ({type(e).__name__})"]

        items = [
            {
                "symbol": symbol,
                "title": row.get("title", ""),
                "source": row.get("source") or row.get("displayed_link") or row.get("link", ""),
                "provider": "serpapi",
                "publishedAt": source_timestamp(row.get("date")),
                "sourcePublishedAt": row.get("date"),
                "retrievedAt": utc_now_iso(),
                "url": row.get("link", ""),
                "snippet": str(row.get("snippet", ""))[:500],
            }
            for row in data.get("organic_results", [])[:limit]
            if row.get("title")
        ]
        return items, []

    async def fetch_provider_news(
        self, source: str, symbol: str, limit: int, days: int
    ) -> tuple[list[dict[str, Any]], list[str]]:
        query_hint = source if source in {"reuters", "bloomberg", "cls"} else None
        query = self.build_query(symbol, source_hint=query_hint)
        async def _fetch() -> tuple[list[dict[str, Any]], list[str]]:
            if source == "mock":
                return self.mock_items(symbol, limit), []
            if source in {"google", "reuters", "bloomberg", "cls"}:
                return await self.fetch_google_rss(symbol, limit, source_hint=query_hint)
            if source == "bocha":
                return await self.fetch_bocha(symbol, query, limit, days)
            if source == "tavily":
                return await self.fetch_tavily(symbol, query, limit, days)
            if source == "brave":
                return await self.fetch_brave(symbol, query, limit, days)
            if source == "serpapi":
                return await self.fetch_serpapi(symbol, query, limit, days)
            return [], [f"{symbol}: unsupported news source '{source}'"]

        result, cached = await self.cached_call(
            source,
            "market_news_provider",
            (source, symbol, limit, days),
            _fetch,
        )
        items, warnings = result
        self.record_health(
            source,
            warnings=warnings,
            cached=cached,
            reason=f"News routing for {symbol} via {source}.",
            provider_chain=self.resolve_sources_for_symbol(symbol),
        )
        return items, warnings


class MarketMacroService(MarketDomainService):
    """Domain service for macro indicator retrieval."""

    SERIES_MAP = {
        "fedFunds": "FEDFUNDS",
        "cpi": "CPIAUCSL",
        "unemployment": "UNRATE",
        "us10y": "DGS10",
        "dxy": "DTWEXBGS",
    }

    @staticmethod
    def series_definition(series_id: str) -> dict[str, Any]:
        """State the units requested from FRED, including the CPI transformation."""
        is_cpi = series_id == "CPIAUCSL"
        return {"units": "index" if series_id == "DTWEXBGS" else "percent",
                "transform": "pc1" if is_cpi else "lin",
                "transformation": "year-over-year percent change" if is_cpi else "source level",
                "deltaUnits": "index_points" if series_id == "DTWEXBGS" else "percentage_points"}

    def __init__(self, config: Any | None = None, workspace: Path | None = None):
        super().__init__(config=config, workspace=workspace)
        self.timeout = float(config.request_timeout_s) if config else 12.0
        self.source = config.macro_source if config else "fred"
        self.fred_api_key = (config.fred_api_key if config else "") or ""
        self._series_metadata: dict[str, dict[str, Any]] = {}

    def series_metadata(self, series_id: str) -> dict[str, Any]:
        """Observation periods are source dates, not fabricated publication instants."""
        return {**self.series_definition(series_id), "observationDate": None,
                "observedAt": None, "retrievedAt": None, **self._series_metadata.get(series_id, {})}

    @staticmethod
    def manual_fallback(indicators: list[str]) -> dict[str, Any]:
        now = utc_now_iso()
        rows = [{"name": k, "value": None, "delta": None, "source": "manual",
                 **MarketMacroService.series_definition(MarketMacroService.SERIES_MAP[k]),
                 "observationDate": None, "observedAt": None} for k in indicators]
        return {
            "asOf": now,
            "source": "manual",
            "indicators": rows,
            "macroRisk": 0.5,
            "regime": "unknown",
            "macroRiskDataStatus": "insufficient_data",
            "methodology": {"kind": "heuristic", "requiredIndicators": ["fedFunds", "cpi", "us10y"],
                            "missingIndicators": ["fedFunds", "cpi", "us10y"],
                            "note": "macroRisk=0.5 is a neutral compatibility default, not a measured risk estimate. No missing indicator values are invented."},
            "warnings": ["macro source is manual; provide FRED api key for reported indicator values"],
        }

    async def fetch_fred_series(self, series_id: str) -> tuple[float | None, float | None, str | None]:
        if not self.fred_api_key:
            self.record_health(
                "fred",
                error="missing FRED api key",
                reason="Macro source configured as FRED but no API key is available.",
                provider_chain=["fred"],
            )
            return None, None, "missing FRED api key"

        transform = self.series_definition(series_id)["transform"]

        async def _fetch() -> dict[str, Any]:
            result = {"value": None, "delta": None, "error": None, "observationDate": None, "retrievedAt": utc_now_iso()}
            params = {
                "series_id": series_id,
                "api_key": self.fred_api_key,
                "file_type": "json",
                "sort_order": "desc",
                "limit": "2",
                "units": transform,
            }
            url = f"https://api.stlouisfed.org/fred/series/observations?{urlencode(params)}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    payload = response.json()
            except Exception as e:
                return {**result, "error": type(e).__name__}

            if not isinstance(payload, dict) or not isinstance(payload.get("observations", []), list):
                return {**result, "error": "invalid FRED observations response"}
            if payload.get("units", transform) != transform:
                return {**result, "error": "FRED response transformation differs from the requested units"}

            observations = payload.get("observations", [])
            values: list[tuple[float, str | None]] = []
            invalid_values = False
            for row in observations:
                if not isinstance(row, dict):
                    invalid_values = True
                    continue
                raw = row.get("value", ".")
                if raw == "." or raw is None:
                    continue
                try:
                    number = float(raw)
                    if isinstance(raw, bool) or not math.isfinite(number):
                        raise ValueError
                except (ValueError, TypeError, OverflowError):
                    invalid_values = True
                    continue
                date = row.get("date")
                try:
                    valid_date = isinstance(date, str) and datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%d") == date
                except ValueError:
                    valid_date = False
                values.append((number, date if valid_date else None))

            if not values:
                return {**result, "error": "no finite observations" if invalid_values else "no observations"}

            latest, date = values[0]
            delta = latest - values[1][0] if len(values) > 1 else None
            if delta is not None and not math.isfinite(delta):
                delta = None
                invalid_values = True
            return {**result, "value": latest, "delta": delta, "observationDate": date,
                    "error": "invalid or nonfinite observations were excluded" if invalid_values else None}

        result, cached = await self.cached_call(
            "fred",
            "market_macro_fred_v2",
            (series_id, transform),
            _fetch,
        )
        latest, delta, err = result["value"], result["delta"], result["error"]
        self._series_metadata[series_id] = {"observationDate": result["observationDate"], "retrievedAt": result["retrievedAt"]}
        self.record_health(
            "fred",
            error=err,
            cached=cached,
            reason="Macro indicator retrieval through FRED.",
            provider_chain=["fred"],
        )
        return latest, delta, err

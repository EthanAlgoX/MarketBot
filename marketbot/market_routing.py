"""Shared helpers for coarse market-type routing."""

from __future__ import annotations

import re


def classify_market_request(
    *,
    text: str = "",
    symbols: list[str] | None = None,
    headline: str = "",
    body: str = "",
) -> dict[str, object]:
    """Classify a request into coarse market types for skill and report routing."""
    merged_text = " ".join(part for part in [text, headline, body] if part).strip()
    merged_lower = merged_text.lower()
    clean_symbols = [str(symbol or "").upper() for symbol in (symbols or []) if str(symbol or "").strip()]
    symbol_blob = " ".join(clean_symbols)

    ticker_like = bool(
        re.search(
            r"\b([A-Z]{2,6}(?:-[A-Z]{2,4})?|[A-Z]{1,5}\.[A-Z]{1,3}|BTC|ETH|SPY|QQQ|IWM|GLD|SLV|XAU|XAG)\b",
            f"{merged_text} {symbol_blob}",
        )
    )
    etf = any(
        token in merged_lower
        for token in (
            "etf",
            "index fund",
            "index etf",
            "指数基金",
            "指数etf",
            "交易型开放式指数基金",
            "场内基金",
        )
    ) or any(symbol in {"SPY", "QQQ", "IWM", "GLD", "SLV"} for symbol in clean_symbols)
    equity = any(
        token in merged_lower
        for token in (
            "stock",
            "stocks",
            "equity",
            "equities",
            "share",
            "shares",
            "earnings",
            "guidance",
            "股票",
            "个股",
            "a股",
            "港股",
            "美股",
            "财报",
            "业绩",
            "指数",
            "板块",
        )
    ) or any(symbol in {"AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "SPY", "QQQ", "IWM", "GLD", "SLV"} for symbol in clean_symbols)
    crypto = any(
        token in merged_lower
        for token in (
            "crypto",
            "bitcoin",
            "ethereum",
            "solana",
            "altcoin",
            "token",
            "onchain",
            "funding rate",
            "加密",
            "比特币",
            "以太坊",
        )
    ) or bool(re.search(r"\b(BTC|ETH|SOL|XRP|DOGE|ADA)(?:-[A-Z]{2,4})?\b", merged_text)) or any(
        re.match(r"^(BTC|ETH|SOL|XRP|DOGE|ADA)(?:-[A-Z]{2,4})?$", symbol) for symbol in clean_symbols
    )
    metals = any(
        token in merged_lower for token in ("gold", "silver", "xau", "xag", "precious metals", "bullion", "黄金", "白银", "贵金属")
    ) or any(symbol in {"XAU", "XAG", "GLD", "SLV"} for symbol in clean_symbols)
    macro = any(
        token in merged_lower
        for token in (
            "macro",
            "fomc",
            "fed",
            "cpi",
            "nfp",
            "pmi",
            "gdp",
            "yield",
            "treasury",
            "dxy",
            "宏观",
            "美联储",
            "非农",
            "通胀",
            "收益率",
            "国债",
            "美元指数",
        )
    )
    asset_like = ticker_like or any(
        token in merged_lower for token in ("asset", "ticker", "symbol", "forex", "futures", "commodity")
    ) or equity or etf or crypto or metals

    if metals and macro:
        primary = "metals-macro"
    elif equity:
        primary = "equity"
    elif crypto:
        primary = "crypto"
    elif metals:
        primary = "metals"
    elif macro:
        primary = "macro"
    elif asset_like:
        primary = "multi-asset"
    else:
        primary = "general"

    return {
        "asset_like": asset_like,
        "equity": equity,
        "etf": etf,
        "crypto": crypto,
        "metals": metals,
        "macro": macro,
        "primary": primary,
        "symbols": clean_symbols,
    }

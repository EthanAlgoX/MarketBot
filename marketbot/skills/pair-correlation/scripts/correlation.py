#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pandas",
#   "yfinance",
# ]
# ///

from __future__ import annotations

import argparse
import json

import pandas as pd
import yfinance as yf


def load_close_prices(symbols: list[str], period: str, interval: str) -> pd.DataFrame:
    data = yf.download(symbols, period=period, interval=interval, auto_adjust=True, progress=False)
    if isinstance(data.columns, pd.MultiIndex):
        close = data["Close"]
    else:
        close = data.rename(columns={"Close": symbols[0]})[[symbols[0]]]
    close = close.dropna(axis=1, thresh=max(len(close) // 2, 20))
    return close.dropna(how="all")


def compute_metrics(close: pd.DataFrame, base: str, peer: str, window: int) -> dict[str, object]:
    returns = close[[base, peer]].pct_change().dropna()
    corr = returns[base].corr(returns[peer])
    rolling = returns[base].rolling(window).corr(returns[peer]).dropna()
    beta = returns[[base, peer]].cov().loc[peer, base] / returns[base].var()
    spread = (close[base] / close[peer]).dropna()
    spread_z = ((spread - spread.mean()) / spread.std()).dropna()
    return {
        "base": base,
        "peer": peer,
        "observations": int(len(returns)),
        "correlation": round(float(corr), 4),
        "beta": round(float(beta), 4),
        "rolling_window": window,
        "rolling_current": round(float(rolling.iloc[-1]), 4) if not rolling.empty else None,
        "rolling_mean": round(float(rolling.mean()), 4) if not rolling.empty else None,
        "rolling_min": round(float(rolling.min()), 4) if not rolling.empty else None,
        "rolling_max": round(float(rolling.max()), 4) if not rolling.empty else None,
        "spread_z_current": round(float(spread_z.iloc[-1]), 4) if not spread_z.empty else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Pair correlation calculator")
    parser.add_argument("symbols", nargs="+", help="At least two ticker symbols")
    parser.add_argument("--period", default="1y")
    parser.add_argument("--interval", default="1d")
    parser.add_argument("--window", type=int, default=60)
    args = parser.parse_args()

    symbols = [symbol.upper() for symbol in args.symbols]
    if len(symbols) < 2:
        raise SystemExit("need at least two symbols")

    close = load_close_prices(symbols, args.period, args.interval)
    if len(close.columns) < 2:
        raise SystemExit("not enough usable data")

    base = close.columns[0]
    peers = list(close.columns[1:])
    results = [compute_metrics(close, base, peer, args.window) for peer in peers]
    print(json.dumps({"period": args.period, "interval": args.interval, "results": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

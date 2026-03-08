---
name: stock-info-explorer
description: Yahoo Finance powered local charting and indicator analysis for stocks, ETFs, crypto, and FX.
metadata: {"marketbot":{"emoji":"📈","requires":{"bins":["uv"]},"triggers":["chart","rsi","macd","bollinger","vwap","atr"],"output":"technical-chart-report","risk":"medium","freshness":"market-live","tools":["market_snapshot"],"required_tools":["market_snapshot"],"markets":["a-share","hong-kong","us","global"],"asset_classes":["equity","crypto","commodity","etf","forex"]}}
---

# Stock Information Explorer

This skill fetches OHLCV data from Yahoo Finance via `yfinance` and computes technical indicators locally.

## When to use

- User wants a quick quote, chart, or indicator snapshot.
- You need a local fallback when live data providers are unavailable.
- You want a chart artifact to accompany a market report.

## Script location

This skill ships with a helper script next to this file:

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py ...
```

If `marketbot` is installed as a package, resolve the script relative to the `SKILL.md` location before running it.

## Commands

### Real-time quote

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py price NVDA
```

### Fundamentals

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py fundamentals AAPL
```

### ASCII history

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py history SPY 6mo
```

### Professional chart

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py pro TSLA 6mo --rsi --macd --bb
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py pro BTC-USD 3mo --vwap --atr
```

### One-shot report

```bash
uv run --script marketbot/skills/stock-info-explorer/scripts/yf.py report NVDA 6mo
```

The script prints `CHART_PATH:/tmp/...png` when a chart is generated.

## Indicators

- `--rsi` RSI(14)
- `--macd` MACD(12,26,9)
- `--bb` Bollinger Bands(20,2)
- `--vwap` VWAP
- `--atr` ATR(14)

## Notes

- Indicators are computed locally from Yahoo data.
- Use this as a technical context skill, not a substitute for execution-grade feeds.

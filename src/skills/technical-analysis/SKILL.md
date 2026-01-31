---
name: technical-analysis
description: Technical structure, momentum, volatility, and levels.
metadata: {"marketbot":{"skillKey":"technical-analysis","emoji":"📈","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch market data for technical analysis","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"compute","description":"Compute indicators from OHLCV series","dispatch":{"kind":"tool","toolName":"indicators_compute","argMode":"raw"}}]}}
---
# Technical Analysis

Use this skill for trend, momentum, volatility, and key levels across timeframes.

## Checklist

- Structure: HH/HL vs LL/LH, range vs trend
- Momentum: RSI/MACD state, divergence
- Volatility: ATR/Bollinger squeeze vs expansion
- Levels: nearest support/resistance, invalidation

## Fetch

```json
{"asset":"ETH","market":"crypto","timeframes":["1h","4h","1d"],"mode":"auto"}
```

## Compute (optional)

```json
{"series":[{"timeframe":"1h","candles":[{"time":1,"open":1,"high":2,"low":1,"close":2,"volume":10}]}]}
```

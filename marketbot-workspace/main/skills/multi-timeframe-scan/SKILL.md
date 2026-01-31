---
name: multi-timeframe-scan
description: Multi-timeframe scan for structure + momentum.
metadata: {"marketbot":{"skillKey":"multi-timeframe-scan","emoji":"layers","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch multi-timeframe market data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize multi-timeframe market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}}]}}
---
# Multi-Timeframe Scan

Use this skill to check structure and momentum across 15m/1h/4h/1d.

## Fetch

```json
{"asset":"BTC","market":"crypto","timeframes":["15m","1h","4h","1d"],"mode":"auto"}
```

## Summary

```json
{"asset":"BTC","marketData":{...}}
```

---
name: stock-analysis
description: Stock snapshot + summary + report (multi-timeframe).
metadata: {"marketbot":{"skillKey":"stock-analysis","emoji":"chart_with_upwards_trend","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch stock market data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize stock market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}},{"name":"report","description":"Generate a stock report","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Stock Analysis

Use this skill for equity snapshots and structured reports.

## Fetch

```json
{"asset":"GOOGL","market":"stocks","timeframes":["1h","4h","1d"],"mode":"auto"}
```

## Summary

```json
{"asset":"GOOGL","marketData":{...}}
```

## Report

```json
{"userQuery":"Analyze GOOGL short-term","marketData":{...}}
```

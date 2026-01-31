---
name: crypto-analysis
description: Crypto snapshot + summary + report (short-term focus).
metadata: {"marketbot":{"skillKey":"crypto-analysis","emoji":"coin","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch crypto market data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize crypto market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}},{"name":"report","description":"Generate a crypto report","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Crypto Analysis

Use this skill for crypto snapshots and structured reports.

## Fetch

```json
{"asset":"BTC","market":"crypto","timeframes":["15m","1h","4h"],"mode":"auto"}
```

## Summary

```json
{"asset":"BTC","marketData":{...}}
```

## Report

```json
{"userQuery":"Analyze BTC short-term","marketData":{...}}
```

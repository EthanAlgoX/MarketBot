---
name: forex-analysis
description: Forex snapshot + summary + report (major pairs).
metadata: {"marketbot":{"skillKey":"forex-analysis","emoji":"money_with_wings","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch forex market data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize forex market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}},{"name":"report","description":"Generate a forex report","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Forex Analysis

Use this skill for FX snapshots and structured reports.

## Fetch

```json
{"asset":"EURUSD","market":"forex","timeframes":["1h","4h","1d"],"mode":"auto"}
```

## Summary

```json
{"asset":"EURUSD","marketData":{...}}
```

## Report

```json
{"userQuery":"Analyze EURUSD swing","marketData":{...}}
```

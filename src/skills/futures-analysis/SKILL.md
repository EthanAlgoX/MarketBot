---
name: futures-analysis
description: Futures snapshot + summary + report.
metadata: {"marketbot":{"skillKey":"futures-analysis","emoji":"chart","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch futures market data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize futures market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}},{"name":"report","description":"Generate a futures report","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Futures Analysis

Use this skill for futures snapshots and structured reports.

## Fetch

```json
{"asset":"ES","market":"futures","timeframes":["1h","4h","1d"],"mode":"auto"}
```

## Summary

```json
{"asset":"ES","marketData":{...}}
```

## Report

```json
{"userQuery":"Analyze ES futures","marketData":{...}}
```

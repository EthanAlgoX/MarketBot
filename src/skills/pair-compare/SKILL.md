---
name: pair-compare
description: Compare two assets side-by-side (trend, momentum, volatility).
metadata: {"marketbot":{"skillKey":"pair-compare","emoji":"scale","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch market data for an asset","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}},{"name":"summary","description":"Summarize market data for an asset","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}}]}}
---
# Pair Compare

Use this skill to compare two assets by running fetch/summary twice, then comparing outputs.

Example (run twice):

```json
{"asset":"BTC","market":"crypto","timeframes":["1h","4h"],"mode":"auto"}
```

```json
{"asset":"ETH","market":"crypto","timeframes":["1h","4h"],"mode":"auto"}
```

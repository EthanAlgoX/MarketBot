---
name: volatility-check
description: Quick volatility and momentum summary from market data.
metadata: {"marketbot":{"skillKey":"volatility-check","emoji":"warning","invocation":{"userInvocable":true},"commands":[{"name":"summary","description":"Summarize volatility and momentum","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}}]}}
---
# Volatility Check

Use this skill to quickly read ATR/volume/momentum states from market data.

```json
{"asset":"BTC","marketData":{...}}
```

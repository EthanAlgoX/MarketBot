---
name: trend-strength
description: Quick trend and momentum strength check.
metadata: {"marketbot":{"skillKey":"trend-strength","emoji":"bolt","invocation":{"userInvocable":true},"commands":[{"name":"summary","description":"Summarize trend and momentum","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}}]}}
---
# Trend Strength

Use this skill to quickly read trend/momentum from market data.

```json
{"asset":"AAPL","marketData":{...}}
```

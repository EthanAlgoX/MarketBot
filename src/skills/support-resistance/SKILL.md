---
name: support-resistance
description: Identify nearest support/resistance levels.
metadata: {"marketbot":{"skillKey":"support-resistance","emoji":"triangular_ruler","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch market data for levels","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}}]}}
---
# Support & Resistance

Use this skill to extract key levels from MarketBot price structure.

```json
{"asset":"ETH","market":"crypto","timeframes":["1h","4h","1d"],"mode":"auto"}
```

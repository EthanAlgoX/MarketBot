---
name: market-scan
description: Fetch structured market data (price structure + indicators).
metadata: {"marketbot":{"skillKey":"market-scan","emoji":"chart","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch market data for an asset","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}}]}}
---
# Market Scan

Use this skill to retrieve structured market data for an asset.

Example:

```
{"asset":"BTC","market":"crypto","timeframes":["1h","4h"],"mode":"auto"}
```

---
name: indicator-check
description: Compute indicators from OHLCV series.
metadata: {"marketbot":{"skillKey":"indicator-check","emoji":"compass","invocation":{"userInvocable":true},"commands":[{"name":"compute","description":"Compute indicators from OHLCV series","dispatch":{"kind":"tool","toolName":"indicators_compute","argMode":"raw"}}]}}
---
# Indicator Check

Use this skill to compute indicators from candle series.

Example:

```
{"series":[{"timeframe":"1h","candles":[{"time":1,"open":1,"high":2,"low":1,"close":2,"volume":10}]}]}
```

---
name: market-summary
description: Summarize market data into a concise narrative.
metadata: {"marketbot":{"skillKey":"market-summary","emoji":"memo","invocation":{"userInvocable":true},"commands":[{"name":"summarize","description":"Summarize MarketBot market data","dispatch":{"kind":"tool","toolName":"market_summary","argMode":"raw"}}]}}
---
# Market Summary

Use this skill to summarize MarketBot market data into a quick snapshot.

Example:

```
{"marketData":{"price_structure":{"trend_1h":"up","trend_4h":"range"},"indicators":{"ema_alignment":"bullish","rsi_1h":62,"atr_change":"increasing","volume_state":"expanding"}}}
```

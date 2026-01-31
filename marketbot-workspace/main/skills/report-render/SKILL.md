---
name: report-render
description: Render a full MarketBot report from market data.
metadata: {"marketbot":{"skillKey":"report-render","emoji":"notebook","invocation":{"userInvocable":true},"commands":[{"name":"render","description":"Generate a report from market data","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Report Render

Use this skill to generate a full analysis report from structured market data.

Example:

```
{"userQuery":"Analyze BTC short-term","marketData":{"price_structure":{"trend_1h":"up","trend_4h":"range"},"indicators":{"ema_alignment":"bullish","rsi_1h":62,"atr_change":"increasing","volume_state":"expanding"}}}
```

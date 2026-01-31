---
name: stock-buy-check
description: Analyze if a stock is a good potential buy based on technicals and fundamentals.
metadata: {"marketbot":{"skillKey":"stock-buy-check","emoji":"🛍️","invocation":{"userInvocable":true},"commands":[{"name":"analyze","description":"Analyze buy potential","dispatch":{"kind":"tool","toolName":"report_render","argMode":"json"}}]}}
---
# Stock Buy Check

Use this skill to run a targeted analysis focusing on "Buy" signals, entry prices, and risks.

## Analyze

Example:

```json
{
  "userQuery": "Analyze if NVIDIA is a good buy right now specifically focusing on entry points and downside risk",
  "marketData": {
    "asset": "NVDA",
    "market": "stocks",
    "timeframes": ["1d", "4h"]
  },
  "agentId": "default"
}
```

**Note**: This skill dispatches to `report_render` with a specific focus. You may need to provide `marketData` or rely on the agent to fetch it first if using in agentic mode. For direct usage, ensure market data is available or usage pipeline handles it.

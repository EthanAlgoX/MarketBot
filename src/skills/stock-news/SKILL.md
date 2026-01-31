---
name: stock-news
description: Fetch recent news and market updates for a specific stock.
metadata: {"marketbot":{"skillKey":"stock-news","emoji":"📰","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Search for latest news about a stock","dispatch":{"kind":"tool","toolName":"web_search","argMode":"raw"}}]}}
---
# Stock News

Use this skill to get the latest news and headlines for a specific stock.

## Fetch News

Example:

```
/skill run stock-news fetch "AAPL stock news"
```

Or simply pass the symbol:

```
/skill run stock-news fetch "Tesla supply chain issues"
```

The skill uses web search to retrieve 5 latest results.

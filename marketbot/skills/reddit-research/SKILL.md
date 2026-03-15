---
name: reddit-research
description: Use browser-backed Reddit adapters to inspect subreddit threads, search results, and retail discussion around a company, theme, or crypto asset.
metadata: {"marketbot":{"emoji":"👽","triggers":["reddit","subreddit","wsb","wallstreetbets","reddit thread","reddit search"],"output":"reddit-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["us","global","mixed"],"asset_classes":["equity","crypto","commodity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# Reddit Research

Use this skill when the user wants Reddit-native discussion context that does
not show up well in public APIs or generic news search.

## Workflow

1. Use `browser_site` with Reddit adapters such as:
   - `reddit/search`
   - `reddit/hot`
   - `reddit/thread`
2. Extract:
   - recurring narratives
   - crowd positioning or meme intensity
   - whether discussion is broad, ironic, bullish, or fearful
3. Pair with `sentiment-analysis` if a weighted conclusion is needed.

## Rules

- Treat Reddit as fast retail signal, not as a verified primary source.
- Separate memes, jokes, and sarcasm from actual thesis statements.

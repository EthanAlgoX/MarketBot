---
name: twitter-browser-research
description: Use browser-backed Twitter or X adapters to inspect search results, threads, and market commentary from analysts, traders, and company watchers.
metadata: {"marketbot":{"emoji":"🐦","triggers":["twitter","x search","tweet thread","fintwit","twitter sentiment"],"output":"twitter-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# Twitter Browser Research

Use this skill when the user needs X/Twitter-native market commentary, thread
search, or fast-moving social discussion around an asset, theme, or event.

## Workflow

1. Use `browser_site` with Twitter/X adapters such as:
   - `twitter/search`
   - `twitter/thread`
   - `twitter/user`
2. Focus on:
   - recurring narratives
   - analyst or trader commentary
   - whether sentiment is accelerating or reversing
3. Pair with `sentiment-analysis` when a weighted conclusion is needed.

## Rules

- Treat Twitter/X as fast signal and distribution context, not verified fact by itself.
- Separate original reporting from repeated hot takes or engagement bait.

---
name: twitter-browser-research
description: Use browser-backed Twitter or X adapters to inspect search results, threads, and market commentary from analysts, traders, and company watchers.
metadata: {"marketbot":{"emoji":"🐦","triggers":["twitter","x search","tweet thread","fintwit","twitter sentiment"],"output":"twitter-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# Twitter Browser Research

Use this skill when the user needs X/Twitter-native market commentary, thread
search, or fast-moving social discussion around an asset, theme, or event.

## Workflow

1. Use `browser_site` with Twitter/X adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `twitter/search`
   - `twitter/thread`
   - `twitter/user`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Focus on:
   - recurring narratives
   - analyst or trader commentary
   - whether sentiment is accelerating or reversing
4. Pair with `sentiment-analysis` when a weighted conclusion is needed.

## Rules

- Do not guess undocumented `twitter/*` adapters. If the catalog does not expose the adapter you want, say so and use the closest listed adapter instead.
- Treat Twitter/X as fast signal and distribution context, not verified fact by itself.
- Separate original reporting from repeated hot takes or engagement bait.

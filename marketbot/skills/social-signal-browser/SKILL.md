---
name: social-signal-browser
description: Use browser-backed social and community adapters to inspect discussion heat, sentiment drift, and retail attention across Xueqiu, Reddit, Zhihu, and similar logged-in or dynamic platforms.
metadata: {"marketbot":{"emoji":"📡","triggers":["discussion heat","retail attention","forum heat","social signal","reddit thread","zhihu heat","xueqiu feed","社区热度"],"output":"social-signal-browser-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","crypto","commodity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":83}}
---

# Social Signal Browser

Use this skill when standard news or social APIs are too shallow and the user
needs site-native discussion context from logged-in or dynamic community pages.

## Workflow

1. Use `browser_site` only with adapters that exist in the runtime catalog. Prefer concrete adapters from specialist skills such as:
   - `xueqiu/hot-stock`
   - `xueqiu/feed`
   - `reddit/search`
   - `reddit/thread`
   - `zhihu/search`
   - `weibo/search`
2. Focus on:
   - discussion heat
   - recurring narratives
   - sentiment acceleration or fatigue
   - whether the discussion is retail-only or broadly echoed
3. Pair with `sentiment-analysis` if a weighted conclusion is needed.

## Rules

- Do not invent new adapters inside this skill. If a needed source is not in the runtime catalog, say so and fall back to the closest listed adapter or specialist skill.
- Treat browser-backed community chatter as a fast signal, not a standalone thesis.
- Separate discussion observations from verified facts and filings.

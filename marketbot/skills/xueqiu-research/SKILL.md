---
name: xueqiu-research
description: Use browser-backed Xueqiu adapters to inspect hot stocks, stock pages, feeds, and logged-in discussion context for A-share, Hong Kong, and US market research.
metadata: {"marketbot":{"emoji":"❄️","triggers":["xueqiu","雪球","hot stock","watchlist heat","stock feed"],"output":"xueqiu-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","us","mixed"],"asset_classes":["equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":82,"fallback_skills":["social-signal-browser","sentiment-analysis"]}}
---

# Xueqiu Research

Use this skill when the user needs Xueqiu-native hot-stock, feed, or stock-page
context that standard market APIs do not provide well.

## Workflow

1. Use `browser_site` with Xueqiu adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `xueqiu/hot-stock`
   - `xueqiu/stock`
   - `xueqiu/feed`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Summarize:
   - what is trending
   - what investors are discussing
   - whether the attention looks broad, narrow, euphoric, or defensive
4. Pair with `market-report` or `sentiment-analysis` when a formal conclusion is needed.

## Rules

- Do not invent new `xueqiu/*` adapter names. If the needed adapter is not in the runtime catalog, say that explicitly and fall back to the nearest cataloged adapter.
- Treat Xueqiu as sentiment and discussion context, not as a sole source of truth.
- Separate observed discussion from factual company disclosures.

---
name: eastmoney-live
description: Use browser-backed Eastmoney adapters for live A-share quote pages, headlines, and market heat when API-level tools are insufficient or site-native context matters.
metadata: {"marketbot":{"emoji":"🧭","triggers":["eastmoney","东方财富","a-share live","个股热度","盘口资讯"],"output":"eastmoney-live-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share"],"asset_classes":["equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":82,"fallback_skills":["news-intelligence"]}}
---

# Eastmoney Live

Use this skill for A-share market pages where Eastmoney's site-native context is
more useful than plain API output.

## Workflow

1. Use `browser_site` with Eastmoney adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `eastmoney/stock`
   - `eastmoney/headlines`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - stock-page highlights
   - latest headlines or newsflash context
   - retail-facing market heat
4. Pair with `market-report` or `news-intelligence` for structured synthesis.

## Rules

- Do not invent undocumented `eastmoney/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Use this as a site-native supplement, not a replacement for validated quote tools.
- Explicitly mark page-derived context when exact fields are not standardized.

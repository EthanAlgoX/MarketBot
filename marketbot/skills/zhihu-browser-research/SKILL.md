---
name: zhihu-browser-research
description: Use browser-backed Zhihu adapters to inspect topic heat, answers, and discussion context for Chinese market themes, sectors, and company narratives.
metadata: {"marketbot":{"emoji":"📘","triggers":["zhihu","知乎","zhihu heat","zhihu answer","topic heat"],"output":"zhihu-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","macro"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# Zhihu Browser Research

Use this skill when the user needs Zhihu-native discussion context for Chinese
market themes, sectors, products, or companies.

## Workflow

1. Use `browser_site` with Zhihu adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `zhihu/search`
   - `zhihu/hot`
   - `zhihu/question`
2. Typical calls:
   - topic search: `browser_site(adapter="zhihu/search", args=["机器人出租 热度"])`
   - hot board: `browser_site(adapter="zhihu/hot")`
   - single question: `browser_site(adapter="zhihu/question", args=["<question-url-or-id>"])`
3. Focus on:
   - topic heat
   - narrative framing
   - whether consensus is retail, expert-led, or mixed
4. Pair with `social-signal-browser` when cross-platform comparison matters.

## Rules

- Do not guess undocumented `zhihu/*` adapters. If the catalog does not expose the adapter you need, use the nearest listed adapter and say what is missing.
- Treat Zhihu as narrative and attention data, not as a factual primary source.
- Separate high-quality explanatory answers from hype or repetition.

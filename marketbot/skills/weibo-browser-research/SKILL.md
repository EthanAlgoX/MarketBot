---
name: weibo-browser-research
description: Use browser-backed Weibo adapters to inspect topic heat, posts, and public narrative momentum around companies, sectors, themes, and macro events.
metadata: {"marketbot":{"emoji":"📣","triggers":["weibo","微博","weibo heat","weibo topic","hot topic"],"output":"weibo-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","macro","commodity"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# Weibo Browser Research

Use this skill when the user needs Weibo-native topic heat or public narrative
context around a market theme, company, or macro event.

## Workflow

1. Use `browser_site` with Weibo adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `weibo/search`
   - `weibo/hot`
2. Typical calls:
   - keyword search: `browser_site(adapter="weibo/search", args=["英伟达 财报"])`
   - hot board check: `browser_site(adapter="weibo/hot")`
3. Focus on:
   - topic heat
   - narrative acceleration
   - whether attention looks retail, media-driven, or event-driven
4. Pair with `social-signal-browser` when cross-platform comparison matters.

## Rules

- Do not invent undocumented `weibo/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Treat Weibo as fast narrative and heat data, not as a factual primary source.
- Separate headline repetition from real new information.

---
name: douban-browser-research
description: Use browser-backed Douban adapters to inspect movie, series, book, and culture-topic heat when consumer attention or entertainment sentiment is relevant.
metadata: {"marketbot":{"emoji":"🎬","triggers":["douban","豆瓣","douban rating","culture heat","movie heat"],"output":"douban-browser-research-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":78}}
---

# Douban Browser Research

Use this skill when the user needs Douban-native culture or entertainment heat
that may affect media, platform, or consumer-facing names.

## Workflow

1. Use `browser_site` with Douban adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `douban/search`
   - `douban/movie`
   - `douban/top250`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Focus on:
   - rating and attention
   - cultural buzz
   - whether the signal is broad enough to matter commercially
4. Pair with `xiaohongshu-browser-research` or `weibo-browser-research` when cross-platform consumer heat matters.

## Rules

- Do not invent undocumented `douban/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Treat Douban as cultural-attention context, not direct revenue evidence.
- Separate critical reception from commercial success.

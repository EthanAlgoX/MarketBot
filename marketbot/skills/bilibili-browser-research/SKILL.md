---
name: bilibili-browser-research
description: Use browser-backed Bilibili adapters to inspect video search, transcripts, comments, and creator narrative around market themes, companies, products, and macro topics.
metadata: {"marketbot":{"emoji":"📺","triggers":["bilibili","b站","bili video","bilibili transcript","bilibili comments"],"output":"bilibili-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","macro","commodity"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# Bilibili Browser Research

Use this skill when the user wants creator-led or video-native discussion
context from Bilibili around a market theme, company, or sector.

## Workflow

1. Use `browser_site` with Bilibili adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `bilibili/search`
   - `bilibili/video`
   - `bilibili/comments`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - recurring talking points
   - creator framing
   - audience comment tone and engagement
4. Pair with `youtube-transcript-browser` when comparing Chinese and global video narratives.

## Rules

- Do not invent undocumented `bilibili/*` adapters. If the runtime catalog does not expose the one you need, say so and fall back to the closest listed adapter.
- Distinguish creator opinion from source-backed facts.
- Use comments as sentiment context, not evidence of fundamentals.

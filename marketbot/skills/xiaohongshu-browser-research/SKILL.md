---
name: xiaohongshu-browser-research
description: Use browser-backed Xiaohongshu adapters to inspect note search and topic heat around consumer brands, product sentiment, lifestyle demand signals, and retail attention.
metadata: {"marketbot":{"emoji":"📕","triggers":["xiaohongshu","小红书","rednote","note heat","consumer sentiment"],"output":"xiaohongshu-browser-research-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","commodity"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# Xiaohongshu Browser Research

Use this skill when the user needs consumer-facing or lifestyle-platform
attention signals that do not show up in market news or traditional social APIs.

## Workflow

1. Use `browser_site` with Xiaohongshu adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `xiaohongshu/search`
   - `xiaohongshu/hot`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - product or brand heat
   - recurring user narratives
   - demand or preference signals
4. Pair with `social-signal-browser` when retail attention is part of the thesis.

## Rules

- Do not invent undocumented `xiaohongshu/*` adapters. If the runtime catalog does not expose the adapter you need, say so and continue with the closest listed adapter.
- Treat Xiaohongshu as consumer-attention context, not direct proof of revenue or sell-through.
- Separate brand buzz from transaction data.

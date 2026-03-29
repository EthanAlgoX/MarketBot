---
name: xiaohongshu-browser-research
description: Use Xiaohongshu tooling to inspect note search, comments, and topic heat around consumer brands, product sentiment, lifestyle demand signals, and retail attention.
metadata: {"marketbot":{"emoji":"📕","triggers":["xiaohongshu","小红书","rednote","note heat","consumer sentiment"],"output":"xiaohongshu-browser-research-report","risk":"medium","freshness":"live","tools":["xiaohongshu_cli","browser_site"],"required_tools":["xiaohongshu_cli"],"alternative_required_tools":["browser_site"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","commodity"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# Xiaohongshu Browser Research

Use this skill when the user needs consumer-facing or lifestyle-platform
attention signals that do not show up in market news or traditional social APIs.

## Workflow

1. Prefer `xiaohongshu_cli` when available.
   - for brand heat or sentiment requests, start with exactly one search:
     `xiaohongshu_cli(operation="search", keyword="lululemon", sort="popular")`
   - if freshness matters, follow with at most one more search:
     `xiaohongshu_cli(operation="search", keyword="lululemon", sort="latest")`
   - hot board: `xiaohongshu_cli(operation="hot", category="fashion")` only when the user explicitly asks for broader category heat
   - note detail: `xiaohongshu_cli(operation="read", target="<note-url-or-id>")`
   - comments: `xiaohongshu_cli(operation="comments", target="<note-url-or-id>", fetch_all=true)`
2. If `xiaohongshu_cli` is unavailable, use `browser_site` with Xiaohongshu adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `xiaohongshu/search`
   - `xiaohongshu/hot`
3. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
4. Extract:
   - product or brand heat
   - recurring user narratives
   - demand or preference signals
5. Pair with `social-signal-browser` when retail attention is part of the thesis.

## Rules

- Prefer `xiaohongshu_cli` over `browser_site` for Xiaohongshu note search, note reads, and comments because it exposes richer structured output.
- For default brand-analysis requests, do not call `status` first. Only call `status` after a prior `xiaohongshu_cli` call reports an authentication or access failure.
- Do not call `topics` unless the user explicitly asks for topic trend discovery or related-query mining.
- For ordinary heat/sentiment analysis, stop after `search(popular)` or `search(popular) + search(latest)`. Synthesize from those results instead of continuing to probe.
- If `xiaohongshu_cli` returns structured `ok: true` data, stop there and synthesize the answer from that data. Do not switch to `exec`, `browser_site`, or ad hoc file inspection for the same request.
- Use `browser_site` only when `xiaohongshu_cli` is unavailable or returns an actual access failure for the requested read path.
- Do not inspect `~/.xiaohongshu*` files with `exec`; rely on `xiaohongshu_cli` output instead.
- Do not invent undocumented `xiaohongshu/*` adapters. If the runtime catalog does not expose the adapter you need, say so and continue with the closest listed adapter.
- Treat Xiaohongshu as consumer-attention context, not direct proof of revenue or sell-through.
- Separate brand buzz from transaction data.

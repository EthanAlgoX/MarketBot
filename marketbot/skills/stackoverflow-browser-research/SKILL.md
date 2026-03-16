---
name: stackoverflow-browser-research
description: Use browser-backed Stack Overflow adapters to inspect developer questions, problem trends, and implementation friction around technologies, products, and APIs.
metadata: {"marketbot":{"emoji":"🧰","triggers":["stack overflow","stackoverflow","dev question","implementation friction","technical adoption"],"output":"stackoverflow-browser-research-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global"],"asset_classes":["equity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":78}}
---

# Stack Overflow Browser Research

Use this skill when the user needs developer pain-point or implementation
signal around a technology, framework, API, or product.

## Workflow

1. Use `browser_site` with Stack Overflow adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `stackoverflow/search`
   - `stackoverflow/thread`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - recurring implementation issues
   - setup or migration friction
   - whether interest looks broad or niche
4. Pair with `hackernews-browser-research` when developer discussion quality matters.

## Rules

- Do not invent undocumented `stackoverflow/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Treat Stack Overflow as friction and adoption signal, not as direct business proof.
- Separate novice setup issues from structural product weakness.

---
name: wikipedia-browser-research
description: Use browser-backed Wikipedia adapters to pull summaries and reference context for companies, sectors, technologies, people, and historical events relevant to research.
metadata: {"marketbot":{"emoji":"📚","triggers":["wikipedia","wiki summary","background research","historical context","entity summary"],"output":"wikipedia-browser-research-report","risk":"low","freshness":"reference","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","macro","commodity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":72}}
---

# Wikipedia Browser Research

Use this skill when the user needs concise background context on a company,
person, technology, sector, or event before deeper analysis.

## Workflow

1. Use `browser_site` with Wikipedia adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `wikipedia/search`
   - `wikipedia/summary`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - entity background
   - historical context
   - terminology and framing
4. Pair with market or browser-backed specialist skills when the summary is
   only the starting point for analysis.

## Rules

- Do not invent undocumented `wikipedia/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Treat Wikipedia as reference background, not a real-time source.
- Use it to establish context, not to validate fast-moving claims.

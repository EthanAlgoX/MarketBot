---
name: wikipedia-browser-research
description: Use browser-backed Wikipedia adapters to pull summaries and reference context for companies, sectors, technologies, people, and historical events relevant to research.
metadata: {"marketbot":{"emoji":"📚","triggers":["wikipedia","wiki summary","background research","historical context","entity summary"],"output":"wikipedia-browser-research-report","risk":"low","freshness":"reference","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","macro","commodity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":72}}
---

# Wikipedia Browser Research

Use this skill when the user needs concise background context on a company,
person, technology, sector, or event before deeper analysis.

## Workflow

1. Use `browser_site` with Wikipedia adapters such as:
   - `wikipedia/search`
   - `wikipedia/summary`
2. Extract:
   - entity background
   - historical context
   - terminology and framing
3. Pair with market or browser-backed specialist skills when the summary is
   only the starting point for analysis.

## Rules

- Treat Wikipedia as reference background, not a real-time source.
- Use it to establish context, not to validate fast-moving claims.

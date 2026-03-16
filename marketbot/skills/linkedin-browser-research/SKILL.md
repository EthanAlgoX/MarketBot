---
name: linkedin-browser-research
description: Use browser-backed LinkedIn adapters to inspect company pages, people profiles, hiring signals, and professional discussion context around industries, products, and firms.
metadata: {"marketbot":{"emoji":"💼","triggers":["linkedin","linkedin profile","hiring signal","company page","professional discussion"],"output":"linkedin-browser-research-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":78}}
---

# LinkedIn Browser Research

Use this skill when the user wants professional-network context such as hiring
signals, company activity, or profile-based ecosystem clues.

## Workflow

1. Use `browser_site` with LinkedIn adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `linkedin/search`
   - `linkedin/profile`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Focus on:
   - hiring intensity
   - company and team activity
   - industry positioning and ecosystem signals
4. Pair with `github-browser-research` when both professional and open-source
   traction matter.

## Rules

- Do not invent undocumented `linkedin/*` adapters. If the runtime catalog does not expose the one you need, say so and continue with the closest listed adapter.
- Treat LinkedIn as professional-signal context, not as audited business data.
- Separate profile claims from independently verified facts.

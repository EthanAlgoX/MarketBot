---
name: hackernews-browser-research
description: Use browser-backed Hacker News adapters to inspect story threads, launch reactions, engineering discussion, and developer interest around companies, products, and AI tooling.
metadata: {"marketbot":{"emoji":"🟠","triggers":["hacker news","hn thread","hn story","launch reaction","developer discussion"],"output":"hackernews-browser-research-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global"],"asset_classes":["equity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":80}}
---

# Hacker News Browser Research

Use this skill when the user wants Hacker News-native discussion around
products, launches, infrastructure, AI tooling, or developer-facing companies.

## Workflow

1. Use `browser_site` with HN adapters such as:
   - `hackernews/search`
   - `hackernews/thread`
   - `hackernews/top`
2. Extract:
   - quality of technical discussion
   - launch or release reaction
   - signals of developer adoption or skepticism
3. Pair with `github-browser-research` when open-source traction matters.

## Rules

- Treat HN as developer and builder sentiment, not a direct market signal.
- Distinguish technical criticism from business or financial implications.

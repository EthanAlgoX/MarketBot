---
name: github-browser-research
description: Use browser-backed GitHub adapters to inspect repositories, issues, discussions, and search results when browser-native or logged-in context is useful.
metadata: {"marketbot":{"emoji":"🐙","triggers":["github repo","github issue","github discussion","github search","repository research"],"output":"github-browser-research-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global"],"asset_classes":["macro","equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":82}}
---

# GitHub Browser Research

Use this skill when the user wants repository-native or issue-native context
from GitHub through browser-backed adapters.

## Workflow

1. Use `browser_site` with GitHub adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `github/search`
   - `github/repo`
   - `github/issues`
2. Typical calls:
   - repository search: `browser_site(adapter="github/search", args=["llm eval framework"])`
   - repo detail: `browser_site(adapter="github/repo", args=["openai/openai-python"])`
   - issue scan: `browser_site(adapter="github/issues", args=["openai/openai-python", "rate limit"])`
3. Extract:
   - project activity
   - issue or discussion themes
   - release or maintenance signals
4. Pair with `github` when CLI-level repository operations are needed.

## Rules

- Do not invent unsupported `github/*` adapters. If the catalog does not list the needed one, state that limitation and use GitHub CLI or a listed adapter instead.
- Treat GitHub browser research as product or ecosystem context, not price data.
- Distinguish repository facts from user speculation in issues or discussions.

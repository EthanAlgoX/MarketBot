---
name: browser-news-verifier
description: Use browser-backed site adapters to verify, expand, or cross-check a news item against site-native search results, dynamic pages, and logged-in discussion context.
metadata: {"marketbot":{"emoji":"🧪","triggers":["verify news","news verify","cross-check headline","headline verify","source verify","新闻核验","交叉验证"],"output":"browser-news-verifier-report","risk":"medium","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":86,"fallback_skills":["news-intelligence"]}}
---

# Browser News Verifier

Use this skill when a headline, article, or fast rumor needs browser-native
verification from site search, dynamic pages, or logged-in discussion sources.

## Workflow

1. Identify the primary headline or claim to verify.
2. Use `browser_site` only with adapters present in the runtime catalog. Prefer exact adapters such as:
   - `eastmoney/headlines`
   - `eastmoney/stock`
   - `xueqiu/stock`
   - `reddit/search`
   - `zhihu/search`
   - `youtube/search`
3. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
4. Compare:
   - whether the claim appears in site-native search
   - whether the wording changes across sources
   - whether the discussion confirms, disputes, or distorts the claim
5. Pair with `news-intelligence` for structured impact analysis after source verification.

## Output format

```md
# Browser News Verification

## Claim
- Headline:
- Verification status:

## Cross-Checks
- Source 1:
- Source 2:
- Source 3:

## Interpretation
- What is confirmed:
- What remains unverified:
- What looks distorted or speculative:
```

## Rules

- Do not use wildcard patterns like `eastmoney/*` at execution time. Choose a concrete adapter from the runtime catalog.
- If the most relevant site or adapter is not available in the catalog, state that explicitly and continue with the closest available cataloged source.
- Distinguish article confirmation from community repetition.
- Prefer direct source pages or site-native search over reposts.
- State clearly when a claim remains unverified.

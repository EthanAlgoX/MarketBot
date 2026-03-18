---
name: tech-news-digest
description: Produce a daily technology and AI news digest from a tiered source catalog, with staged fetching, optional browser fallbacks, and concise Markdown output.
metadata: {"marketbot":{"emoji":"🗞️","triggers":["tech news","daily news","ai news","news digest","技术新闻","技术日报","ai 新闻","资讯汇总"],"output":"tech-news-digest-report","risk":"low","freshness":"live","tools":["spawn","web_fetch","browser_site","browser_page","read_file","write_file"],"required_tools":["web_fetch"],"markets":["global"],"asset_classes":["macro"],"task_type":"orchestration","determinism":"tool-backed","priority":68}}
---

# Tech News Digest

Use this skill to build a concise daily digest of technology and AI news from a
curated source catalog in `references/sources.json`.

This is the MarketBot-native rewrite of a multi-source daily-news workflow. Use
it for technology, AI, developer tools, and product ecosystem coverage, not for
price-sensitive trading calls.

## Workflow

1. Start with `scripts/collect_sources.py` for the default collection pass. It
   reads `references/sources.json`, fetches enabled web sources, deduplicates,
   scores, and emits JSON or Markdown.
2. If a specific source or item needs deeper inspection, use `web_fetch` on the
   target URL.
3. If the number of worthwhile items is still too low, continue to enabled
   `tier2` sources.
4. Only use `tier3_browser` when browser tools are available and a listed source
   clearly needs JS rendering.
5. Deduplicate by URL first, then by near-identical titles.
6. Score candidates for relevance, novelty, readability, and signal density.
7. Output only the best items in concise Markdown.
8. If the user wants a saved artifact, either:
   - run `scripts/collect_sources.py --format markdown --output <path>` for a
     direct file export, or
   - write a custom report with `write_file` using
     `references/report-template.md`.

## Selection rules

Prefer:

- AI, developer tools, model products, infra, and technical strategy
- operator notes, research interpretation, and strong product insight
- pieces that explain why the development matters

Avoid:

- low-information rewrites
- generic marketing posts
- overly academic summaries without practical context
- duplicate coverage of the same event

## Runtime rules

- `browser_page` and `browser_site` are optional enrichments, not hard
  requirements.
- If browser tools are unavailable, continue with `web_fetch` and note the
  coverage gap instead of failing the whole digest.
- Prefer specialist browser-backed skills when they clearly fit a source better
  than ad hoc page interaction.
- Treat this as a current-awareness workflow, not a market recommendation flow.

## Output format

Use concise Markdown:

```md
# Tech News Digest

## Summary
- Coverage date:
- Sources checked:
- Items included:

## Top Items

### 1. <Title>
- Why it matters:
- Summary:
- Source:
- Link:

## Coverage Notes
- Skipped or failed sources:
```

If too little high-quality material is found, say so directly instead of
padding the list.

## Resources

- `scripts/collect_sources.py`
- `references/sources.json`
- `references/report-template.md`

## Command examples

```bash
python3 scripts/collect_sources.py --format markdown
python3 scripts/collect_sources.py --tiers tier1,tier2 --limit 12 --format json
python3 scripts/collect_sources.py --format markdown --output reports/tech-news-digest.md
```

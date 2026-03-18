---
name: ak-rss-digest
description: Curate a Chinese reading digest from fixed RSS and Atom feeds, focused on AI agents, frontier AI, deep interviews, and high-signal tech essays.
metadata: {"marketbot":{"emoji":"📰","triggers":["rss digest","reading digest","ai digest","tech digest","rss 摘要","阅读摘要","技术日报","ai 日报","阅读精选"],"output":"ai-reading-digest","risk":"low","freshness":"live","tools":["exec","web_fetch"],"required_tools":["exec"],"markets":["global"],"asset_classes":["macro"],"task_type":"research","determinism":"script-backed","priority":72}}
---

# AK RSS Digest

Use this skill to build a Chinese reading digest from the fixed feed bundle in
`references/feeds.opml`.

Default to the most recent 7 days ending on the current date in
`Asia/Shanghai`. Narrow to a single day only when the user explicitly asks.

## Workflow

1. Run `python3 scripts/fetch_today_feed_items.py --format json` from this skill
   directory using `exec`.
2. Treat feed-level network failures as non-fatal. Continue with the feeds that
   succeeded and mention major failures only when they materially reduce
   coverage.
3. Read the structured output and discard obvious mismatches before opening
   article pages.
4. If a feed summary is too thin to judge well, use `web_fetch` on the article
   URL to inspect the thesis and novelty.
5. Score candidates on a 10-point scale and output only items strictly above
   `7.0`.
6. If nothing qualifies, say so directly instead of padding the output.

## Selection heuristics

Prefer:

- fresh thinking about AI agents, agent tooling, evaluation, deployment, or
  failure modes
- deep interviews or operator commentary with concrete experience
- readable essays with original strategic or product insight
- high-signal technical writing that is useful beyond a narrow niche

Reject or penalize:

- raw papers and paper summaries with little interpretation
- release notes, changelogs, benchmark dumps, and implementation diaries
- vendor marketing, launch fluff, and obvious rewrites
- dry reference material without strong insight

## Scoring rubric

- `9-10`: exceptional fit, original insight, clearly worth the reader's time
- `8-8.9`: strong recommendation, relevant and readable
- `7-7.9`: borderline, do not include in the final digest
- `5-6.9`: competent but dry, narrow, or weakly aligned
- `<5`: irrelevant or low-signal

Weigh:

- relevance to AI agents, frontier AI, or adjacent strategic technology
- originality of argument or reporting
- readability
- practical usefulness for staying current

## Output format

Write the final answer in Simplified Chinese. For each item above `7`, include:

- `标题`
- `评分`
- `推荐语`
- `摘要`
- `链接`

Use a concise daily-brief style. Keep each item compact and scannable.

Example:

```markdown
本期从最近一周的 RSS 里筛出几篇值得看的文章，重点偏 AI agent、前沿判断和不太枯燥的深度内容。

- 标题：文章标题
  评分：8.7/10
  推荐语：先说为什么值得看。
  摘要：严格两句话，讲清核心观点和价值。
  链接：文章链接
```

If nothing qualifies:

```markdown
这周没有筛到真正值得推荐的文章。现有更新要么偏技术细节，要么信息密度不够，没有过 7 分线。
```

## Resources

- `scripts/fetch_today_feed_items.py`
- `references/feeds.opml`

## Command examples

```bash
python3 scripts/fetch_today_feed_items.py --format json
python3 scripts/fetch_today_feed_items.py --date 2026-03-17 --days 1 --timezone Asia/Shanghai --format json
python3 scripts/fetch_today_feed_items.py --days 7 --limit 30 --format json
```

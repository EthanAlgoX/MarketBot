---
name: twitter-browser-research
description: Use Twitter/X tooling to inspect search results, threads, profiles, and market commentary from analysts, traders, and company watchers.
metadata: {"marketbot":{"emoji":"🐦","triggers":["twitter","x search","tweet thread","fintwit","twitter sentiment"],"output":"twitter-browser-research-report","risk":"medium","freshness":"live","tools":["twitter_cli","browser_site"],"required_tools":["twitter_cli"],"alternative_required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# Twitter Browser Research

Use this skill when the user needs X/Twitter-native market commentary, thread
search, or fast-moving social discussion around an asset, theme, or event.

## Workflow

1. Prefer `twitter_cli` when available.
   - search: `twitter_cli(operation="search", query="$NVDA guidance earnings revenue", search_type="Latest", max_count=12, exclude=["replies","retweets"], do_filter=true, min_likes=2)`
   - thread/detail: `twitter_cli(operation="tweet", target="<tweet-url-or-id>", max_count=30)`
   - user: `twitter_cli(operation="user", screen_name="@sama")`
   - user posts: `twitter_cli(operation="user_posts", screen_name="@sama", max_count=20)`
   - article: `twitter_cli(operation="article", target="<article-url-or-id>")`
2. If `twitter_cli` is unavailable, use `browser_site` with Twitter/X adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `twitter/search`
   - `twitter/thread`
   - `twitter/user`
3. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
4. Focus on:
   - recurring narratives
   - analyst or trader commentary
   - whether sentiment is accelerating or reversing
5. Pair with `sentiment-analysis` when a weighted conclusion is needed.

## Rules

- Prefer `twitter_cli` over `browser_site` for Twitter/X search, tweet detail, profile lookup, and user-post analysis because it exposes richer structured output.
- For ordinary narrative or sentiment requests, force `search_type="Latest"`, prefer cashtags for obvious equity tickers, add `exclude=["replies","retweets"]`, and keep the search window small enough to reduce spam and engagement bait.
- If the query contains broad finance words like `guidance`, `outlook`, or `forecast`, tighten it with earnings context such as the ticker cashtag, `earnings`, or `revenue` instead of searching the bare word alone.
- For ordinary analysis requests, do not call `status` first. Only call `status` after a prior `twitter_cli` call reports an authentication or access failure.
- Start with one focused search, not a broad crawl. Only run a second search when the first query is too noisy or misses the core catalyst wording.
- If `twitter_cli` returns structured `ok: true` data, stop there and synthesize the answer from that data. Do not switch to `exec`, `browser_site`, or local cache inspection for the same request.
- Use `browser_site` only when `twitter_cli` is unavailable or returns an actual access failure for the requested read path.
- Do not guess undocumented `twitter/*` adapters. If the catalog does not expose the adapter you want, say so and use the closest listed adapter instead.
- Treat Twitter/X as fast signal and distribution context, not verified fact by itself.
- Separate original reporting from repeated hot takes or engagement bait.

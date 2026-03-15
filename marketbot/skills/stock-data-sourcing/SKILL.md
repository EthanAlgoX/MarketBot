---
name: stock-data-sourcing
description: Select and combine market data and news providers for A-share, Hong Kong, and US stock analysis. Use when Codex needs to choose between efinance, akshare, tushare, pytdx, baostock, yfinance, Tavily, Bocha, Brave, or SerpAPI; explain provider tradeoffs; design fallback chains; or plan data ingestion for cross-market watchlists and reports.
metadata: {"marketbot":{"emoji":"🧭","triggers":["data source","provider","coverage","fallback","routing","行情源","数据源"],"output":"source-plan","risk":"low","freshness":"reference","tools":["market_source_plan","browser_site"],"required_tools":["market_source_plan"],"markets":["a-share","hong-kong","us","mixed"],"asset_classes":["equity","etf"]}}
---

# Stock Data Sourcing

## Overview

Use this skill to route cross-market data requests to the right providers before writing analysis or building ingestion workflows.

Prefer market coverage and freshness over provider purity, and always state the fallback chain when source quality is uncertain.

## Workflow

1. Classify the request by market and task:
   - market: `A-share`, `Hong Kong`, `US`, `index`, `ETF`
   - task: `realtime quote`, `daily history`, `chips`, `fundamentals`, `market breadth`, `news`, `event intel`
2. Read [references/data-sources.md](references/data-sources.md) when choosing or justifying providers.
3. Pick a primary provider and at least one fallback.
4. If `marketbot` already has a native tool that covers the task, use it and keep this skill as routing guidance.
5. If authenticated browser-native context is materially better than public APIs, include a `browser-authenticated` lane using `browser_site`.
5. In the answer, state:
   - chosen source
   - fallback chain
   - freshness caveat
   - gaps that still need integration

## Routing Rules

### Quotes and history

- `A-share`:
  - prefer `tushare` when a token is configured and stable structured data matters
  - otherwise prefer `efinance` for broad free coverage
  - fall back to `akshare`, then `pytdx`, then `baostock`
- `Hong Kong`:
  - prefer `akshare` for free historical and realtime HK support
  - fall back to `yfinance` when symbol conversion is acceptable
- `US stocks` and `US indices`:
  - prefer `yfinance`
  - do not route US history through `akshare` or `efinance`

### Specialized enrichments

- `chips / cost distribution`: prefer `akshare`
- `fundamentals / boards / company profile`: prefer `efinance`
- `market indices / sector rankings`:
  - `A-share`: `efinance`, `akshare`, or `tushare`
  - `US`: `yfinance` for indices; do not over-promise sector breadth unless a provider is actually wired

### News and event intel

- `A-share` and Chinese news:
  - prefer `Bocha`, then `Tavily`, then `SerpAPI`
  - for site-native logged-in context or dynamic pages, add `browser_site` with concrete cataloged adapters such as `eastmoney/stock`, `eastmoney/headlines`, `xueqiu/stock`, or `xueqiu/hot-stock`
- `US` and global English news:
  - prefer `Brave`, then `Tavily`, then `SerpAPI`
  - for logged-in social or dynamic discussion pages, add `browser_site` only with cataloged adapters such as `reddit/search`, `twitter/search`, `youtube/transcript`, or `github/search`
- Default freshness target: keep news within `3 days` unless the user asks for a longer window.
- For catalyst work, search across these dimensions:
  - latest news
  - market analysis / analyst view
  - risk check
  - earnings
  - industry context

## Pairing

- Use `market-report` for the final write-up.
- Use `catalyst-tracker` when the user cares about drivers and calendars.
- Use `stock-info-explorer` for Yahoo-based charts after the source plan is decided.
- Use `risk-checklist` after the source-backed thesis is stable.

## Output pattern

```md
# Source Plan: <SYMBOL or WATCHLIST>

## Primary
- Provider:
- Why:

## Fallbacks
- 1:
- 2:

## Freshness / Limits
- Expected latency:
- Coverage gaps:
- News window:

## Integration Notes
- Existing marketbot tools to use:
- New connectors still needed:
```

## Rules

- Do not claim a provider is already integrated into `marketbot` unless the code path exists.
- Separate current runtime capability from recommended future integration.
- Prefer exact provider names over vague phrases like "some API".
- If coverage is mixed, explicitly say which asset classes are strong and which are weak.
- Treat `browser_site` as a high-trust local source lane, not the default first choice.

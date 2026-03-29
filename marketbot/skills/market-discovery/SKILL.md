---
name: market-discovery
description: Automatically discover potential investment opportunities by synthesizing market data, events, sentiment, and sector momentum.
metadata: {"marketbot":{"emoji":"🔭","triggers":["discover","opportunity","theme","rotation","市场机会","主题机会","轮动机会"],"output":"market-opportunity-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_social_sentiment","market_brief","thesis_tracker","browser_site"],"required_tools":["market_snapshot","market_news","market_brief"],"markets":["a-share","global","mixed"],"asset_classes":["equity","crypto","commodity","etf"]}}
---

# Market Opportunity Discovery

Use this skill to scan the broader market and identify the most actionable investment opportunities based on events, sentiment, volume, and momentum. Treat it as an orchestrator skill: it should combine native market tools with narrower specialist skills instead of guessing ad hoc workflows.

For A-share discovery, use TickFlow-backed snapshot data as the primary live move detector when the runtime exposes it, and treat social sentiment as optional unless a market-native social/browser source is available.

## When to use

- User explicitly requests `/discover` or asks for new market opportunities.
- Executing a scheduled daily market scan to identify emerging trends.
- Another agent or skill requires a synthesized list of current market opportunities via API.

## Core Analysis Pipeline

Follow this pipeline to arrive at the final opportunity list:

1. **Step 1: Market Scan**: Use `market_snapshot` and `market_news` to look for abnormal price movements, volume spikes, or catalyst clusters.
2. **Step 2: Event Matching**: Use `news-intelligence` or direct event tools to identify what is driving the anomaly.
3. **Step 3: Sentiment Shift**: Use `sentiment-analysis` for baseline sentiment.
   - If site-native or logged-in discussion heat matters, escalate to a narrower browser-backed specialist:
     - `xueqiu-research`
     - `eastmoney-live`
     - `reddit-research`
     - `twitter-browser-research`
     - `zhihu-browser-research`
     - `weibo-browser-research`
     - `social-signal-browser`
   - When browser-backed evidence is needed, use only adapters that exist in the runtime catalog. Do not invent new adapter names inside this skill.
4. **Step 4: Synthesis Anchor**: Use `market_brief` for the strongest candidate or theme basket so the final answer already contains scenario framing, prior intel context, and optional logic-chain support.
5. **Step 5: Fund Flow/Volume**: Detect capital inflows using ETF data, high-volume prints, or sector-volume metrics.
6. **Step 6: Sector Momentum**: Identify whether multiple assets in the same sector are moving together.
7. **Step 7: Opportunity Scoring**: Form a final `opportunity_score` based on the weights below.

For A-share discovery specifically:

- Prefer sector/theme clustering over isolated single-name moves.
- Treat ETF participation and board breadth as stronger confirmation than standalone social chatter.
- If the move is driven only by low-confidence social/forum noise, downgrade it to a watchlist candidate.
- If the user explicitly wants this opportunity tracked across sessions, create a thesis after the scan using `market_brief(..., thesisMode="create", thesisText=...)` or `thesis_tracker` directly.

## Opportunity Scoring Formula

Calculate a normalized score (0.0 to 1.0) using the following weights:

- **0.3**: Event Impact (Quality and macro relevance of the catalyst)
- **0.3**: Sentiment (Direction and strength extracted from text sources)
- **0.2**: Volume & Fund Flow (Evidence of institutional or strong volume buying)
- **0.2**: Sector Momentum (Breadth of the move across multiple related assets)

*Threshold: Only present opportunities with a `score >= 0.70`.*

## Opportunity Types

Categorize each discovered opportunity into one of four buckets:

- `Macro` (e.g., Rate cuts -> Tech/Gold)
- `Industry` (e.g., Freight rates -> Shipping)
- `Company` (e.g., Earnings beat -> Specific ticker)
- `Sentiment` (e.g., Unusually high retail/social engagement on a theme)

## Data Availability Rules

- Prefer live tool output over prior knowledge when discussing current opportunities.
- Prefer specialist browser-backed skills over direct `browser_site` calls whenever a matching skill exists.
- For each market section you write, confirm that this run has current tool evidence for that market.
- If you did not fetch current evidence for a market, mark it as `unverified` instead of presenting a concrete market view.
- If live data is unavailable for a market or symbol, say `live data unavailable` or `price unavailable`.
- Do not invent provider-specific failures such as `Yahoo 429` unless that exact failure is present in current tool warnings or source-health output.
- Do not present unavailable markets as actionable setups; downgrade them to watchlist candidates and explain the data gap.
- If no listed browser-backed specialist or cataloged adapter fits the request, say that explicitly instead of fabricating a browser workflow.

## Daily Opportunity Guardrails

Use these guardrails when the user asks for a generic daily opportunity scan such as `每日机会分析`, `今日机会`, or `market opportunities today`.

- Do not describe the tape as `全面普跌`, `全面上涨`, `系统性抛售`, or similar breadth claims unless you actually fetched breadth-style evidence beyond a small basket of proxy assets.
- Do not treat a single outlier move in a defensive asset such as `GLD`, `gold`, `TLT`, or `DXY` as the core market thesis unless a second independent source confirms it.
- If one quote looks abnormal relative to the rest of the snapshot, label it `unverified outlier` and exclude it from the main conclusion unless confirmed.
- If current evidence only supports a risk dashboard and not a real opportunity list, say `今日无高置信机会，维持观察名单` instead of forcing a bullish/bearish trade idea.
- For generic daily scans, prefer native market tools first: `market_snapshot`, `market_news`, `market_social_sentiment`, `market_macro`, and `market_brief`.
- Avoid ad hoc `exec`, `web_fetch`, `web_search`, or browser fallbacks for broad-market price discovery when native market tools already returned usable data. If native live data is weak, say so explicitly.
- Distinguish clearly between:
  - `confirmed`: supported by current tool output
  - `watchlist`: plausible but not yet confirmed
  - `unverified`: data gap or conflicting signals
- When confidence is below `0.70`, downgrade the setup to `watchlist` or `no high-conviction setup`.
- If the request arrives on a weekend or outside the main market session, frame the output as a `watchlist / next-session prep` report rather than an intraday action plan.
- Do not run `exec` just to recover or inspect previous tool output. Use the tool results already in context, and if they are insufficient, state the gap directly.

## Daily Output Template

For generic daily opportunity scans, prefer this structure:

```md
# 🔭 Daily Opportunity Report

## 1. Market Regime
- Risk-on / risk-off / mixed
- What is confirmed by current tools

## 2. High-Conviction Setups
- If none: `No high-conviction setups today.`

## 3. Watchlist
- 2-5 symbols or themes
- Why each remains only watchlist quality

## 4. Invalidations
- What would upgrade or cancel today's view

## 5. Data Gaps
- Any unverified prices, outliers, or missing market coverage
```

## Output Format

### User-Facing Report (Markdown)

When interacting in a chat, use this format:

```md
# 🔭 Market Opportunity Report

## 💡 Opportunity: <Theme Name> (Score: <0.0-1.0>)

**Type**: <Macro/Industry/Company/Sentiment>

**Reasons**:
- <Event/Catalyst description>
- <Fund flow/Volume notes>
- <Sentiment indicators>

**Related Assets**:
- **<SYMBOL 1>**: <Reason it benefits>
- **<SYMBOL 2>**: <Reason it benefits>
- **<SYMBOL 3>**: <Reason it benefits>
```

### API Response Format

If queried programmatically or requested in a structured format by another skill, output standard JSON:

```json
[
  {
    "opportunity": "AI computing",
    "sector": "semiconductor",
    "score": 0.82,
    "type": "Industry",
    "assets": [
      {"asset": "NVDA"},
      {"asset": "AMD"},
      {"asset": "TSMC"}
    ]
  }
]
```

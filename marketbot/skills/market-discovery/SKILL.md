---
name: market-discovery
description: Automatically discover potential investment opportunities by synthesizing market data, events, sentiment, and sector momentum.
metadata: {"marketbot":{"emoji":"🔭","triggers":["discover","opportunity","theme","rotation","机会","市场机会","今日机会","机会分析","主题机会","轮动机会"],"output":"market-opportunity-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_social_sentiment","browser_site"],"required_tools":["market_snapshot","market_news"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","etf"]}}
---

# Market Opportunity Discovery

Use this skill to scan the broader market and identify the most actionable investment opportunities based on events, sentiment, volume, and momentum. Treat it as an orchestrator skill: it should combine native market tools with narrower specialist skills instead of guessing ad hoc workflows.

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
4. **Step 4: Fund Flow/Volume**: Detect capital inflows using ETF data, high-volume prints, or sector-volume metrics.
5. **Step 5: Sector Momentum**: Identify whether multiple assets in the same sector are moving together.
6. **Step 6: Opportunity Scoring**: Form a final `opportunity_score` based on the weights below.

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

---
name: market-discovery
description: Automatically discover potential investment opportunities by synthesizing market data, events, sentiment, and sector momentum.
metadata: {"marketbot":{"emoji":"🔭","triggers":["discover","opportunity","theme","rotation"],"output":"market-opportunity-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_social_sentiment"],"required_tools":["market_snapshot","market_news"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","etf"]}}
---

# Market Opportunity Discovery

Use this skill to scan the broader market and identify the most actionable investment opportunities based on a weighted scoring mechanism of events, sentiment, volume, and momentum. It is a highly analytical skill that aggregates data from multiple sources.

## When to use

- User explicitly requests `/discover` or asks for new market opportunities.
- Executing a scheduled daily market scan to identify emerging trends.
- Another agent or skill requires a synthesized list of current market opportunities via API.

## Core Analysis Pipeline

Follow this pipeline to arrive at the final opportunity list:

1. **Step 1: Market Scan**: Look for abnormal price movements or volume spikes across sectors. (e.g., Semiconductor +3.8%, Volume +120%).
2. **Step 2: Event Matching**: Consult the `news` or event analysis tools to see what is driving the anomaly (e.g., "AI GPU demand").
3. **Step 3: Sentiment Shift**: Consult the `sentiment-analysis` skill to check the trend (e.g., sentiment rising from 0.41 to 0.67).
4. **Step 4: Fund Flow/Volume**: Detect capital inflows using ETF data, high volume prints, or sector volume metrics.
5. **Step 5: Sector Momentum**: Identify if multiple assets in the same sector are moving together (e.g., NVDA, AMD, TSMC all rising).
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

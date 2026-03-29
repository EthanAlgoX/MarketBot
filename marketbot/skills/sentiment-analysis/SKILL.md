---
name: sentiment-analysis
description: Extract and quantify market sentiment signals from news, social media, and forums for a specific asset or sector.
metadata: {"marketbot":{"emoji":"🎭","triggers":["sentiment","crowd","social","forum"],"output":"sentiment-report","risk":"medium","freshness":"news-live","tools":["market_news","market_social_sentiment","browser_site"],"required_tools":["market_social_sentiment"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","crypto","commodity","etf"]}}
---

# Sentiment Analysis

Use this skill to extract, quantify, and track the sentiment trends of a specific asset or the broader market from unstructured text data (news, social media, forums).

## When to use

- User explicitly requests sentiment analysis for a ticker (e.g., `/sentiment NVDA`).
- Another skill (e.g., `market-discovery`, `market-report`, `stock-watch`) needs an objective sentiment score to form a conclusion.
- Tracking sentiment shifts over time (e.g., "Is the sentiment for AI chips improving?").

## Data Sources & Weights

When conducting sentiment analysis, gather data from multiple sources and apply the following conceptual weights to form a final conclusion:

1. **News (Weight: 0.5)**: Reuters, Bloomberg, CNBC. (High reliability).
2. **Social Media (Weight: 0.3)**: X (Twitter), Stocktwits. (High noise, high speed, weight by engagement/likes/retweets).
3. **Forums (Weight: 0.2)**: Reddit (e.g., r/wallstreetbets, r/investing). (Community driven, weight by upvotes).

## Workflow

1. **Data Gathering & Cleaning**:
   - Use market news and social sentiment tools to gather raw text for the target asset/sector within the specified time window (e.g., `24h`).
   - When site-native, logged-in, or dynamic discussion pages matter, supplement with `browser_site` on Xueqiu, Reddit, Zhihu, or similar platforms.
   - Clean the text by filtering out spam, ads, and irrelevant noise.
   - If the runtime exposes `tools.market.sentimentBackend = finbert`, prefer that backend for text scoring and mention the backend used in the result when it materially affects confidence.

2. **Entity Extraction**:
   - Identify the specific asset(s) and sectors mentioned in the text (e.g., "NVDA", "AI Chips").

3. **Sentiment Classification & Scoring**:
   - Analyze the text to classify it as `positive`, `neutral`, or `negative`.
   - Calculate an aggregated sentiment score for the asset (normalized to a scale, e.g., 0.0 to 1.0, where >0.5 is bullish).

4. **Trend Calculation**:
   - Compare current sentiment metric ($t$) against the previous period ($t-1$).
   - Determine the trend: `Rising`, `Falling`, or `Stable`.

5. **Aggregation**:
   - Synthesize the data to form a market, sector, or stock-level sentiment view.

## Output Format

If returning directly to the user or generating a report, use the following format:

```md
# 🎭 Sentiment Report: <ASSET/SECTOR>

## 📊 Overview
- **Sentiment Score**: <0.0 - 1.0> (<Bullish/Neutral/Bearish>)
- **Trend**: <Rising/Falling/Stable>

## 📰 Factors & Sources
- **News Sentiment**: <Score / View>
- **Social/Forum Sentiment**: <Score / View>

## 🔍 Key Drivers
- <Driver 1 (e.g., Strong AI GPU demand)>
- <Driver 2 (e.g., Positive analyst upgrades)>

## 📝 Conclusion
<One sentence actionable summary>
```

## API / Tool Usage Example

When other skills or the system query this skill conceptually, it functions like an API returning:

```json
{
  "asset": "NVDA",
  "window": "24h",
  "sentiment": 0.71,
  "trend": "rising",
  "sources": {
    "news": 0.76,
    "social": 0.65
  }
}
```

If queried via Natural Language, provide the structured Markdown report instead.

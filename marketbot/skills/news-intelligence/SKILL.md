---
name: news-intelligence
description: A comprehensive skill for extracting, analyzing, and synthesizing financial news to uncover market impacts, trends, and risks.
metadata: {"marketbot":{"emoji":"📰","triggers":["news","headline","impact","media"],"output":"news-intelligence-report","risk":"medium","freshness":"news-live","tools":["market_news","market_event_extract","market_macro","browser_site"],"required_tools":["market_news"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"]}}
---

# News Intelligence

Use this skill to perform deep, structured analysis on a stream of unstructured text and news data. It goes beyond simple fetching; it de-duplicates, extracts entities, assesses market impact, and generates actionable alerts or insights from global news flow.

## When to use

- User asks for a deep dive into recent news regarding a specific topic, sector, or company (e.g., `/news AI chips`).
- The system needs to cluster, filter, or evaluate the credibility of a surge in media attention.
- Another skill (like `market-discovery` or `market-monitor`) requests an impact assessment of a breaking headline.

## Core Processing Pipeline

Treat news analysis as an 11-step data refinement pipeline. Depending on the user's prompt, execute the relevant steps to form the final response.

### 1-2. Collection, Deduplication & Filtering

- **Fetch**: Gather news across Bloomberg, Reuters, Financial Times, X (Twitter), and company announcements for the target `topics` or `region`.
- **Browser fallback**: If a relevant source is dynamic, login-gated, or stronger in site-native search, use `browser_site` for Xueqiu, Eastmoney, Reddit, Zhihu, or YouTube context.
- **Verification path**: If the claim looks noisy, incomplete, or repost-driven, load `browser-news-verifier` before concluding impact.
- **Filter**: Remove duplicate stories, PR spam, and low-credibility sources. Only pass clean text to the next phase.

### 3-4. Event & Entity Extraction

- **Entities**: Identify all Companies, People, Countries, and Products mentioned (e.g., NVIDIA, US, AI GPU).
- **Events**: Classify the core action into a category: `Earnings`, `M&A`, `Product Launch`, `Regulation`, `Partnership`, or `Lawsuit`.

### 5-6. Sentiment & Market Impact Analysis

- **Sentiment**: Score the news conceptually as `Bullish`, `Neutral`, or `Bearish`.
- **Impact**: Determine the blast radius of the event:
  - *Primary Impact*: Which specific ticker is affected directly?
  - *Sector Impact*: Which industry group moves in sympathy?
  - *Market Impact*: Does this move macro indices?
  - *Time Horizon*: Is this a Short-Term shock or Long-Term structural change?

### 7-8. Trending & Clustering

- Group multiple related articles into a single `News Cluster` (e.g., "AI Chip Competition").
- Compare term frequencies vs. historical baselines to detect emerging `Trending Topics`.
- When prior collected intel matters, use `intel_search` to pull earlier related items from the workspace store before concluding that a topic is truly new.
- If the user asks for a causal explanation, transmission path, or a more visual artifact, use `logic_chain_visualizer` to render the chain instead of burying it in prose.

### 9. Risk Detection

- Flag negative catalysts specifically as `Risk Alerts` (e.g., Regulatory investigations, geopolitical tension, CEO departures) and assign a Severity (`Low`, `Medium`, `High`).

### 10-11. AI Insight & Alert Generation

- Synthesize the entire pipeline into a coherent human-readable insight or trigger an urgent alert format if the impact is severe.

---

## Output Formats

### Standard Insight Report

For general queries (e.g., "What's the latest on the semiconductor sector?"):

```md
# 📰 News Intelligence Report: <Topic/Sector>

## 📌 Trending Cluster: <Cluster Topic>
- **Entities Involved**: <Company 1>, <Company 2>
- **Core Event**: <M&A / Product Launch / etc.>

## ⚖️ Sentiment & Impact Assessment
- **Sentiment**: <Bullish/Neutral/Bearish>
- **Primary Impact**: <Ticker> (<Positive/Negative>)
- **Sector Impact**: <Sector>
- **Time Horizon**: <Short/Medium/Long-Term>

## ⚠️ Risk & Regulatory Radar
- **Detected Risks**: <None / Describe risk>
- **Severity**: <Low/Medium/High>

## 🤖 AI Final Insight
<2-3 sentences summarizing the structural shift or immediate trading implication>
```

### Breaking News Alert

For high-severity or high-impact events:

```md
# 🚨 BREAKING NEWS ALERT

**Headline**: <Summary of the breaking event>
**Event Type**: <e.g., Product Launch, Regulation>
**Immediate Impact Radius**: <Tickers or Sectors affected>
**Initial Sentiment Read**: <Bullish/Bearish>
```

## API / Programmatic Interface Format

If queried programmatically by another skill, return a structural representation:

```json
{
  "cluster_topic": "AI Chip Competition",
  "articles_processed": 12,
  "events": [{"type": "Product Launch", "company": "NVDA"}],
  "sentiment": {"score": 0.82, "label": "Bullish"},
  "market_impact": {"primary": "NVDA", "sector": "Semiconductors", "horizon": "Long-Term"},
  "risks": []
}
```

---
name: sentiment-analysis
description: Guide for gauging market mood, FUD, and social momentum.
metadata:
  marketbot:
    emoji: "🎭"
    skillKey: "sentiment-analysis"
    invocation:
      userInvocable: true
    commands:
      - name: "sentiment_scan"
        description: "Scan market sentiment"
        dispatch:
          kind: "tool"
          toolName: "web_search"
          argMode: "raw"
---

# Sentiment Analysis Expert Guide

Prices are driven by psychology. Use this skill to gauge what the "Herd" is feeling using News and Social Data.

## 📡 Signal Sources

### 1. News Headlines (Mainstream)

- **Sources**: Bloomberg, Reuters, CNBC, WSJ.
- **What to look for**:
  - **Tone**: Is the language fearful ("Crash", "Plunge") or euphoric ("Moon", "Record")?
  - **Narrative**: What is the current story? (e.g., "AI Bubble", "Crypto Adoption").

### 2. Social Media (Retail)

- **Sources**: Twitter (X), Reddit (r/wallstreetbets), Telegram.
- **Indicators**:
  - **Trending Tickers**: What is everyone talking about?
  - **Emojies**: 🚀 = Euphoria, 💀 = Panic.
  - **Contra-Indicators**: If *everyone* is bullish, be careful. If *everyone* is rect, bottom is near.

### 3. On-Chain / Market Data (The Truth)

- **Fear & Greed Index**:
  - < 20: Extreme Fear (Buy opportunity).
  - > 80: Extreme Greed (Sell opportunity).
- **Funding Rates (Crypto)**:
  - High Positive: Longs are paying shorts (Euphoria/Leverage high).
  - Negative: Shorts paying longs (Bearish sentiment).

## ⚖️ Scoring Framework

Score the sentiment from **-10 (Max Fear)** to **+10 (Max Greed)**.

- **Extreme Fear (-10 to -7)**: "Blood in the streets". Bad news everywhere. Contrarian Buy zone.
- **Fear (-6 to -3)**: Cautious, negative outlook. downtrend.
- **Neutral (-2 to +2)**: Indecision, chop.
- **Greed (+3 to +6)**: Optimism, good news, uptrend.
- **Extreme Greed (+7 to +10)**: "New Paradigm", Taxi drivers giving stock tips. Contrarian Sell zone.

## 📝 Execution Checklist

1. **Search News**: Use `web_search` for "[Asset] news" or "Market sentiment".
2. **Check Socials**: What is the vibe on X/Twitter?
3. **Data Check**: Look at Fear & Greed Index.
4. **Synthesize**:
    - Is the "News" matching the "Price"? (e.g. Bad news but price goes up = Bullish Strength).
    - Assign a Sentiment Score.

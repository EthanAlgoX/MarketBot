---
name: market-monitor
description: A comprehensive, real-time market surveillance skill that tracks price movements, macro indicators, sector rotations, earnings, and news to generate actionable alerts and AI summaries.
metadata: {"marketbot":{"emoji":"📈","triggers":["monitor","market summary","overview","surveillance"],"output":"market-monitor-report","risk":"medium","freshness":"intraday-live","tools":["market_snapshot","market_news","market_macro","market_brief"],"required_tools":["market_snapshot","market_macro"],"markets":["a-share","global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"]}}
---

# Market Monitor

Use this skill to perform continuous or on-demand surveillance of the broader financial markets. It synthesizes multiple real-time data streams to detect abnormal market behavior, track macroeconomic shifts, and alert the user to critical events.

For A-share runs, treat TickFlow-backed snapshot data as the primary live price lane when the runtime is configured for it.

## When to use

- User explicitly asks for a market overview (e.g., `/monitor`, "How is the market doing today?", "Give me a market summary").
- A scheduled `cron` job triggers a morning, mid-day, or closing bell market update.
- The system detects a significant volatility event and triggers an automated alert.

## Surveillance Modules (Pipeline)

When providing a full market update, execute the following modules. If the user asks for a specific module (e.g., "What are the top gainers?", "Any earnings today?"), execute only the relevant section.

### 1. Macro Indicator Snapshot

Fetch the real-time status of critical macro benchmarks to gauge overall market health.

Use market-appropriate benchmarks instead of forcing one global template:

- **A-share**: SSE Composite, SZSE Component, ChiNext, CSI 300, sector breadth, limit-up / limit-down counts
- **Global / US**: S&P500, NASDAQ, Russell 2000
- **Bonds**: US10Y Yield when global macro context matters
- **Commodities**: Gold, Crude Oil
- **Volatility/Risk**: VIX, Put/Call Ratio for global/US runs

### 2. Market Movers (Anomalies)

Detect and list out the assets experiencing abnormal activity:

- **Top Gainers & Losers**: Assets moving >3% on the day.
- **Unusual Volume**: Assets trading at >2x their average volume.
- **A-share specific**: call out limit-up concentration, board/sector clustering, and ETF-led broad market moves when visible.

### 3. Sector Rotation & Breadth

Identify which sectors are leading or lagging, and track capital flow.

- e.g., Technology (+2.1%), Energy (+1.4%), Financials (-0.8%).

### 4. Technical Signal Detection

Scan key market leaders for critical technical setups.

- **Momentum**: RSI (Overbought/Oversold), MACD crosses.
- **Structure**: Breakouts above resistance or breakdowns below support.

### 5. News & Event / Earnings Tracking

Overlay fundamental drivers on top of the price action.

- **Breaking News**: Identify major headlines (e.g., Fed policy, geopolitics).
- **Earnings**: List critical earnings expected today and their expected EPS/guidance surprises.

### 6. AI Market Synthesis & Alert Generation

Aggregate all the above data into a cohesive, readable narrative. Generate an urgent alert format if critical risk thresholds are breached (e.g., VIX spikes >15%, major index drops).

---

## Output Formats

### Standard Market Review Output

Use this format for general market overviews and closing bell reports:

For A-share-focused runs:

```md
🎯 <DATE> Market Review

📊 Major Indices
- SSE Composite: <Price> (<🟢/🔴%>)
- SZSE Component: <Price> (<🟢/🔴%>)
- ChiNext Index: <Price> (<🟢/🔴%>)

📈 Market Overview
- Advance: <N> | Decline: <N> | Limit Up: <N> | Limit Down: <N>
- Market Sentiment: <Bullish/Bearish/Neutral>

🔥 Sector Performance
- Leading: <Sector 1>, <Sector 2>, <Sector 3>
- Laggards: <Sector 1>, <Sector 2>, <Sector 3>

🤖 AI Synthesis
<2-3 sentences summarizing the key market drivers and capital flow logic for the day>.
```

For global / US-focused runs:

```md
🎯 <DATE> Market Review

📊 Major Indices
- S&P 500: <Price> (<🟢/🔴%>)
- NASDAQ 100: <Price> (<🟢/🔴%>)
- Russell 2000: <Price> (<🟢/🔴%>)
- VIX: <Value> (<🟢/🔴Δ>)

📈 Market Overview
- Breadth:
- Risk Tone:
- Macro Pressure Points:

🔥 Sector Performance
- Leading:
- Laggards:

🤖 AI Synthesis
<2-3 sentences summarizing cross-asset drivers, macro pressure, and risk appetite>.
```

### Global Macro & Monitor (Optional)

If the user specifically asks for global/US macro context:

### Urgent Alert Output (If triggered by severe conditions)

```md
# 🚨 MARKET ALERT: <Event Type>

**Condition**: <e.g., TSLA dropped 4% in 30 minutes>
**Context**: <e.g., Unusual volume detected alongside negative news>
**Recommended Action**: <e.g., Review exposure to EV sector>
```

## Internal Rules

- **Speed over precision**: This is a monitor. Favor fast, reliable data feeds.
- **Avoid noise**: Only report sector or movers data if the change is statistically significant.
- **Market-native framing**: For A-share runs, prefer breadth, sector clustering, and board/ETF participation over US-style volatility framing.

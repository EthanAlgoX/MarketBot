---
name: stock-watch
description: Automatically monitor specific stocks and provide daily summaries of price, news, and technical indicators.
metadata: {"marketbot":{"emoji":"📈","triggers":["watchlist","watch","daily summary","decision dashboard"],"output":"stock-watch-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_social_sentiment","market_fundamentals","market_brief","thesis_tracker"],"required_tools":["market_snapshot","market_news","market_brief"],"markets":["a-share","hong-kong","us","mixed"],"asset_classes":["equity","etf"]}}
---

# Stock Watch

Use this skill to monitor and analyze specific stocks, providing high-quality "Decision Dashboard" reports that synthesize market data, capital flows, and public sentiment.

## When to use

- User explicitly asks to watch or analyze stocks (e.g., `/watch AAPL`, `/watch 000657, 300260`).
- User wants a professional decision-ready summary for specific tickers.

## Workflow

1. **Scheduling (Optional)**: If the user asks for periodic monitoring, use the `cron` tool to schedule the task.
2. **Data Acquisition**: For each ticker, gather the following:
   - **Market Snapshot**: Price, volume, and daily change.
     - For A-share names, prefer TickFlow-backed realtime snapshot when configured.
   - **Capital Flow**: Identify main fund inflows/outflows (主力资金) if available via market logs or news.
   - **Sentiment**: Quantify sentiment from news and social sources (weighted News 0.5, Social 0.3, Forums 0.2).
     - For A-share and Hong Kong names, lower the confidence of social/forum inputs unless the runtime exposes a market-native social source.
   - **Fundamentals**: Key financial dates, performance YoY/QoQ, and catalyst events.
     - TickFlow-backed fundamentals currently give the strongest A-share baseline for name, share count, and market-cap style fields inside `marketbot`.
   - **Risk Assessment**: Check for technical overextension, liquidity issues, or negative news catalysts.
3. **Execution & Scoring**:
   - Assign a **Decision Score (0-100)** based on integrated signals.
   - Categorize into **🟢 Buy**, **🟡 Watch**, or **🔴 Sell**.
4. **Synthesis Anchor**:
   - Prefer running `market_brief` for the lead symbol or compact watch basket so the result already includes scenario framing, prior intel context, and optional logic-chain output.
5. **Output Synthesis**: Generate the report according to the "Decision Dashboard" template.
   - If the user wants this view tracked over time, pair the output with `thesis_tracker` or call `market_brief` in thesis mode so the monitoring loop can update the same thesis later.

## Output Format

Output the summary using this exact structure:

```md
🎯 <DATE> Decision Dashboard
Total Stocks: <N> | 🟢 Buy: <B> 🟡 Watch: <W> 🔴 Sell: <S>

📊 Analysis Summary
<Decision Emoji> <Ticker Name> (<ID>): <Decision> | Score <Score> | Bias <Sentiment>
...

---

### <Ticker Name> (<ID>)

#### 📰 Important Info
- **Sentiment**: <Description of public sentiment and sentiment acceleration>.
- **Expectations**: <Brief on upcoming earnings, growth potential, or fundamental drivers>.

#### 🚨 Risk Alerts
1. **<Risk 1>**: <Description (e.g., Fund outflow, high concentration)>.
2. **<Risk 2>**: <Description>.
3. **<Risk 3>**: <Description>.

#### ✨ Bullish Catalysts
1. **<Catalyst 1>**: <Description (e.g., Sector tailwinds,绑定头部大厂)>.
2. **<Catalyst 2>**: <Description>.

#### 📢 Latest Dynamics
【Latest】 <1-2 sentences summarizing the most recent news or capital flow status>.

---
Generated at: <HH:MM>
```

## Rules

- **Precision**: Separate factual capital flow data from speculative sentiment.
- **Categorization**: "Watch" is the default for scores between 40-70.
- **Actionable**: Ensure the "Latest Dynamics" provides a "so what" for the user.

---
name: stock-watch
description: Automatically monitor specific stocks and provide daily summaries of price, news, and technical indicators.
metadata: {"marketbot":{"emoji":"📈"}}
---

# Stock Watch

Use this skill to monitor specific stocks and provide daily, periodic summaries.

## When to use

- User explicitly asks to watch or monitor a stock (e.g., `/watch AAPL`, `/watch NVDA TSLA`).
- User wants an automated end-of-day or daily summary for specific tickers.

## Workflow

1. **Scheduling**: If the user asks to start watching a stock on a schedule, use the `cron` tool to schedule a recurring task (e.g., `cron(action="add", message="Execute stock-watch for AAPL", cron_expr="0 21 * * *")`).
2. **Execution**: When activated (either manually or via the cron reminder), perform the following steps:
   - Request market data using relevant tools (e.g. price, volume, and technical indicators like MA, RSI, MACD).
   - Fetch the latest relevant news for the symbol(s).
   - Combine technical data and news to determine the short-term sentiment.
3. **Output**: Generate a concise Daily Summary based on the provided format.

## Output Format

Output the summary in the following structured format (adjust based on available data):

```md
# 📅 Daily Summary: <SYMBOL>

## 📊 Price & Technicals
- **Price**: <Current Price> (<% Change>)
- **Technicals**: <Brief note on MA/RSI/Volume/Key levels>

## 📰 News & Catalysts
- <Key news headline or fundamental driver>

## 🧠 Sentiment & Conclusion
- **Sentiment**: <Bullish/Bearish/Neutral>
- **Conclusion**: <Brief actionable summary>
```

## Supported Parameters

- **Tickers**: One or more stock symbols (e.g., NVDA, 00700.HK, TSLA)
- **Frequency/Time**: Default to daily if not specified, or configure based on the user's requested schedule.

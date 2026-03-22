---
name: daily-market-opportunity
description: Produce a fixed daily market opportunity scan for requests like `每日机会`, `每日机会分析`, or `今日机会`, using a constrained market-data pipeline and a stable watchlist-first output.
metadata: {"marketbot":{"emoji":"📅","triggers":["每日机会","每日机会分析","今日机会","今日机会分析","daily opportunity"],"output":"daily-market-opportunity-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_macro","market_brief"],"required_tools":["market_snapshot","market_news","market_brief"],"markets":["a-share","global","mixed"],"asset_classes":["equity","crypto","etf","macro"]}}
---

# Daily Market Opportunity

Use this skill only for fixed-format daily scans such as `每日机会`, `每日机会分析`, or `今日机会`.
If the user is asking about save location, markdown path, report document, or persistence behavior, do not run the scan. Answer only with the local report directory behavior if that information is already available in the conversation/runtime.

## Fixed Tool Pipeline

Run this exact sequence and stop after it unless the user explicitly asks for deeper follow-up:

1. Tool phase: call `market_snapshot`, `market_news`, `market_macro`
2. Include `market_brief` in the same fixed pipeline whenever possible so the final answer already has a synthesis anchor

Do not start a second broad-market exploration round or any open-ended follow-up tooling loop.
After the fixed pipeline completes, produce the final answer immediately. Do not request any additional tool calls for price history, follow-up verification, or extra market context.

Use a compact, fixed symbol basket. Do not duplicate symbols or mix aliases for the same benchmark in the same tool call.
- US/global risk basket: `SPY`, `QQQ`, `DIA`, `IWM`, `NVDA`, `AAPL`, `MSFT`, `TSLA`, `BTC-USD`, `ETH-USD`, `GLD`, `TLT`, `DXY`
- Hong Kong basket: `0700.HK`, `9988.HK`, `3690.HK`, `9618.HK`, `HSI`, `HSTECH`
- A-share basket: `000300`, `000001`, `399001`, `600519`, `002594`, `300750`

Treat `market_brief` as the synthesis anchor for the final answer. `market_snapshot`, `market_news`, and `market_macro` are supporting inputs, not reasons to start extra exploration.
The runtime persists the final report to a local markdown file automatically, but only for successful real scans. Path queries, document-location questions, and error responses must not be treated as report content. Keep the final answer markdown-clean so it can be saved directly.
Tool calls must happen through actual function calling only. Never print raw tool-call markup such as `<minimax:tool_call>`, `<invoke ...>`, XML, or pseudo-function syntax in the user-facing answer.

## Hard Constraints

- Do not call `exec`, `web_search`, `web_fetch`, `browser_site`, or browser-backed specialist skills.
- Do not call `market_fundamentals` or `market_social_sentiment` in this skill's default path.
- Do not inspect previous tool output via shell or recovery commands.
- Requests containing terms like `保存地址`, `保存到地址`, `地址`, `保存路径`, `markdown`, `.md`, `文档`, `在哪`, or `在哪里` are metadata/path questions, not scan requests.
- If live data is degraded, say `live data unavailable` and continue with a watchlist-quality report.
- Do not name backend vendors, provider names, API products, or HTTP status codes in the user-facing answer. Summarize them as `live data unavailable`, `macro data unavailable`, or `some fields unavailable`.
- If any tool call fails or returns malformed/debug output, do not echo raw errors. Produce a short degraded report using `live data unavailable` / `some fields unavailable` in `Data Gaps`.
- If quote coverage is poor or macro fields are mostly null, do not print confidence decimals, scores, sizing, stop-losses, or pseudo-precise trigger levels.
- When the request lands on a weekend / closed market and quotes are degraded, keep `Watchlist` to 2 items max, and prefer recent catalysts over stale breadth commentary.
- Do not include a symbol in `Watchlist` if it only has one stale quote or if catalyst/news support is unavailable.
- Do not cite stale headlines older than 14 calendar days as a main catalyst unless clearly labeled as background.
- Do not mention missing API keys, configuration tasks, or setup advice such as `配置 FRED API Key`; summarize all such issues as `macro data unavailable` or `live data unavailable`.
- Avoid explicit `操作建议`, `轻仓跟进`, `严格控仓`, and similar execution advice when current quotes are unavailable or the market is closed.
- If the request lands on a weekend or outside the main trading session, frame the result as `next-session prep`, not an intraday action plan.
- If confidence is below `0.70`, say `今日无高置信机会，维持观察名单`.
- Do not generalize a small basket into claims like `全面普跌` or `系统性抛售`.
- Mark isolated abnormal quotes as `unverified outlier` and exclude them from the main thesis.
- Keep the report short enough for one compact card sequence in chat. Avoid sprawling event dumps.
- Prefer 3 watchlist items max on weekends / market-closed periods.
- Do not introduce off-basket candidates unless they are already present in the current tool outputs as explicit quoted symbols. News-only narrative mentions without current tool support stay inside the catalyst text, not the watchlist table.
- If all evidence is weak or mostly narrative, say `观察级` explicitly and avoid pseudo-precision.

## Output Shape

Always use this structure:

```md
# 📅 每日机会扫描

## 1. Market Regime
- Confirmed by current tools only

## 2. High-Conviction Setups
- If none: `今日无高置信机会，维持观察名单`

## 3. Watchlist
- 2-3 themes or symbols on weekends / closed markets; 2-5 only during live sessions
- Each item must include catalyst, why it is only watchlist-quality, and what would confirm it

## 4. Invalidations
- What would cancel or upgrade the view next session

## 5. Data Gaps
- Missing live quotes
- Missing macro fields
- Any `unverified outlier`
```

## Preferred Tone

- Concise
- Market-facing
- Clear about confidence and data quality
- No internal chain-of-thought
- No backend or provider jargon
- Markdown-clean so it can be archived locally without post-processing
- In weak-data mode, compact and high-signal rather than comprehensive

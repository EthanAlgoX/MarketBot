---
name: market-report
description: Create a structured market analysis report with regime, levels, catalysts, and risks.
metadata: {"marketbot":{"emoji":"📋"}}
---

# Market Report

Produce a concise, structured market analysis report for a single asset.

## When to use

- User asks for market analysis, outlook, or a trade plan.
- User requests regime, trend, levels, catalysts, or risk summary.
- You need to convert raw market data into a decision-ready note.

## Preferred marketbot workflow

1. Use `market_snapshot` for recent price, momentum, and flow hints.
2. Use `market_news`, `market_social_sentiment`, and `market_macro` when relevant.
3. Use `market_event_extract` if a headline or catalyst is driving the move.
4. Use `market_signal` or `market_brief` to get a draft signal and scenario view.
5. Write the final answer in the report format below, separating facts from assumptions.

## Inputs to confirm if missing

- Asset symbol and market (`stocks`, `crypto`, `futures`, `forex`, `etf`)
- Timeframe(s) such as `1h`, `4h`, `1d`
- Risk tolerance (`low`, `medium`, `high`)
- Style (`intraday`, `swing`, `position`)

If those are missing, make the narrowest safe assumption and state it explicitly.

## Output format

```md
# Market Analysis: <ASSET>

## Summary
- Direction/Bias:
- Confidence (0-100):
- Regime:

## Trend & Structure
- Trend (1h/4h/1d):
- Structure notes:

## Key Levels
- Support:
- Resistance:
- Invalidation:

## Catalysts
- Upcoming/Recent:

## Risks
- Primary risks:
- What would change the view:

## Plan
- Suggested action:
- Entry ideas:
- Stop:
- Targets:
- Position size guidance:

> Disclaimer: MarketBot provides research and analysis only, not financial advice.
```

## Style rules

- Keep it concise and actionable.
- Call out missing or stale data explicitly.
- Default to `watch` when evidence is weak.
- Never imply guaranteed returns.

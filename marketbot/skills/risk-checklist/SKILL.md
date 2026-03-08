---
name: risk-checklist
description: Generate a trade risk checklist and position-sizing guidance.
metadata: {"marketbot":{"emoji":"🛡️","triggers":["risk","position size","stop loss","invalidation"],"output":"risk-checklist","risk":"high","freshness":"market-live","tools":["market_snapshot","market_macro","market_news","market_signal"],"required_tools":["market_snapshot","market_signal"],"markets":["a-share","hong-kong","us","global"],"asset_classes":["equity","crypto","commodity","etf"]}}
---

# Risk Checklist

Create a risk checklist for a proposed trade or market view.

## When to use

- User asks whether a trade is safe.
- You are about to propose entries, targets, or size.
- A signal looks attractive but event or volatility risk may dominate.

## Preferred marketbot workflow

1. Use `market_snapshot` for current move and liquidity hints.
2. Use `market_macro` and `market_news` for event risk.
3. Use `market_social_sentiment` if the trade is crowd-driven.
4. Use `market_signal` for baseline confidence and stop/position constraints.

## Checklist

- Regime risk (trend vs range)
- Volatility state and typical ATR move
- Liquidity or slippage risk
- Event or catalyst risk
- Correlation and factor exposure
- Time risk (overnight, weekend, earnings, macro release)
- Execution risk (spread, gaps, funding, borrow, leverage)

## Output format

```md
# Risk Checklist: <ASSET>

## Risk Summary
- Overall risk: Low/Medium/High
- Key blockers:

## Checklist
- Regime fit: ✅/⚠️/❌
- Volatility: ✅/⚠️/❌
- Liquidity: ✅/⚠️/❌
- Event risk: ✅/⚠️/❌
- Correlation: ✅/⚠️/❌
- Time risk: ✅/⚠️/❌
- Execution: ✅/⚠️/❌

## Position Sizing Guidance
- Suggested size: Small/Normal/Reduced
- Max loss per trade (%):
- Invalidation level:

> Disclaimer: MarketBot provides research and analysis only, not financial advice.
```

## Rules

- If evidence is mixed, bias toward reduced size.
- If invalidation is unclear, say the trade is not ready.

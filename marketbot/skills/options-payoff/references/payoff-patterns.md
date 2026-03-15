# Payoff Patterns

Use this file when the structure needs exact payoff logic or edge-case handling.

## Single Leg

- Long call: upside convexity, max loss is premium paid.
- Long put: downside convexity, max loss is premium paid.
- Short call: max profit is premium received, upside risk may be unlimited.
- Short put: max profit is premium received, downside risk is large but bounded
  by strike minus premium when cash-secured.

## Common Structures

### Vertical Spread

- Debit call spread: bullish, bounded upside and downside.
- Debit put spread: bearish, bounded upside and downside.
- Credit call spread: bearish, bounded risk.
- Credit put spread: bullish, bounded risk.

### Straddle

- Long straddle: long volatility, two-sided breakevens.
- Short straddle: short volatility, very high tail risk.

### Strangle

- Long strangle: long volatility, cheaper than straddle but needs larger move.
- Short strangle: short volatility with wide but dangerous tail exposure.

### Iron Condor

- Net credit, profits if spot stays inside the short strikes.
- Max loss equals wing width minus credit received.

### Covered Call

- Long underlying plus short call.
- Upside capped at strike plus premium.
- Downside still exposed through the stock position.

## Output Guardrails

- State all assumptions.
- Call out undefined max loss or max profit when appropriate.
- If premium, contract count, or multiplier is missing, keep outputs qualitative
  or use labeled assumptions.

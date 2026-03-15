---
name: options-payoff
description: Build option payoff and breakeven analysis for single-leg and multi-leg option trades, including vertical spreads, straddles, strangles, covered calls, iron condors, and custom leg structures.
metadata: {"marketbot":{"emoji":"🧮","triggers":["options payoff","payoff curve","option spread","iron condor","straddle","strangle","covered call","vertical spread","breakeven","期权收益","期权策略"],"output":"options-payoff-report","risk":"high","freshness":"end-of-day","tools":["market_snapshot","market_source_plan"],"required_tools":["market_snapshot"],"markets":["us","global"],"asset_classes":["equity","etf","index"],"task_type":"options-analysis","determinism":"script-backed","priority":90}}
---

# Options Payoff

Use this skill when the user wants to understand how an options position makes
or loses money across different underlying prices.

## When to use

- User describes an option strategy or shares strikes and premium.
- User asks for breakevens, max profit, max loss, or risk asymmetry.
- `market-report` needs a specialist read on an option structure.

## Inputs

- Underlying
- Strategy type
- Expiry or DTE
- Strike(s)
- Premium paid or received
- Quantity and multiplier when known

If some fields are missing, state the assumption explicitly and keep the
analysis illustrative rather than precise.

## Workflow

1. Normalize the option legs and identify whether the structure is single-leg,
   spread, or multi-leg.
2. Read [references/payoff-patterns.md](references/payoff-patterns.md) for the
   matching strategy formula and edge cases.
3. When the user provides enough leg detail, run the helper script:

```bash
python marketbot/skills/options-payoff/scripts/payoff.py \
  --leg long:call:100:5 \
  --leg short:call:110:2 \
  --spot 104
```

4. Compute or explain:
   - payoff at expiry
   - breakeven level(s)
   - max profit and max loss when bounded
   - directional bias and volatility sensitivity
5. If spot context matters, use `market_snapshot` for the current underlying
   price and compare it against the profit zone.
6. If the user asks for a broader thesis, pair this skill with `market-report`.

## Output format

```md
# Options Payoff: <UNDERLYING>

## Position
- Strategy:
- Expiry:
- Spot:
- Net premium:

## Payoff Profile
- Max profit:
- Max loss:
- Breakeven(s):
- Bias:

## Scenario Notes
- If spot rises to:
- If spot stays near:
- If spot falls to:

## Risks
- Theta / time decay:
- Volatility sensitivity:
- Assignment / gap risk:
```

## Rules

- Do not invent Greeks or theoretical values if they were not computed.
- Mark unlimited risk or profit explicitly.
- Separate payoff facts from directional interpretation.

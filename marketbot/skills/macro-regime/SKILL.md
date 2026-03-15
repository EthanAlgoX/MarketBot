---
name: macro-regime
description: Identify the current macro regime using rates, inflation, dollar, commodities, and risk appetite. Use when the user asks whether the environment is risk-on, risk-off, inflationary, disinflationary, or policy-sensitive.
metadata: {"marketbot":{"emoji":"🌐","triggers":["macro regime","risk on","risk off","inflation regime","disinflation","policy regime","macro backdrop","宏观环境","风险偏好"],"output":"macro-regime-report","risk":"medium","freshness":"end-of-day","tools":["market_macro","market_news","market_brief"],"required_tools":["market_macro"],"markets":["global","mixed"],"asset_classes":["macro","equity","commodity","etf"],"task_type":"macro-analysis","determinism":"tool-backed","priority":80}}
---

# Macro Regime

Use this skill to classify the broader environment before making directional
calls on equities, rates-sensitive assets, gold, or cyclical themes.

## When to use

- User asks whether markets are in risk-on or risk-off mode.
- A trade depends heavily on rates, inflation, or policy direction.
- `market-report` needs a dedicated macro framing layer.

## Workflow

1. Use `market_macro` to gather the regime inputs.
2. Use `market_news` only when policy headlines or macro events are moving the
   tape materially.
3. Read [references/regime-map.md](references/regime-map.md) when translating
   mixed inputs into a regime label.
4. Output:
   - likely regime
   - dominant drivers
   - assets helped by the regime
   - assets hurt by the regime

## Output format

```md
# Macro Regime

## Regime Call
- Label:
- Confidence:

## Drivers
- Rates:
- Inflation:
- Dollar / liquidity:
- Risk appetite:

## Market Implications
- Assets helped:
- Assets pressured:

## Watchpoints
- Next macro event:
- What would change the regime call:
```

## Rules

- Do not overstate precision when macro signals conflict.
- Name the dominant driver instead of listing indicators without hierarchy.
- State whether the regime call is stable or event-dependent.

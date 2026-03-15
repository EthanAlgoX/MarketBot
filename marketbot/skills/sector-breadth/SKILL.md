---
name: sector-breadth
description: Analyze sector or theme breadth, leadership, laggards, and participation quality. Use when the user asks whether a move is broad-based, narrow, expanding, or fading across a sector, index, or thematic basket.
metadata: {"marketbot":{"emoji":"📚","triggers":["sector breadth","market breadth","breadth","participation","leader laggard","theme breadth","板块强度","市场宽度","扩散"],"output":"sector-breadth-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_brief","market_news"],"required_tools":["market_snapshot"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","etf"],"task_type":"breadth-analysis","determinism":"tool-backed","priority":80}}
---

# Sector Breadth

Use this skill when the user wants to know whether a sector or theme move is
healthy, broad, and durable, or just driven by one or two leaders.

## When to use

- User asks whether a theme is expanding or fading.
- A strong move needs confirmation from peers or breadth.
- `market-discovery` needs a focused depth check on a theme.

## Workflow

1. Confirm the sector, theme, or basket members. If the user only gives a
   theme, define a representative basket explicitly.
2. Use `market_snapshot` to compare price change, volume behavior, and momentum
   across the basket.
3. Use `market_news` when leadership changes appear event-driven.
4. Use [references/breadth-guide.md](references/breadth-guide.md) for the
   breadth interpretation rules.
5. Summarize whether the move is:
   - broad and healthy
   - leader-driven but fragile
   - mixed and rotational
   - breaking down

## Output format

```md
# Sector Breadth: <THEME>

## Breadth Summary
- Participation quality:
- Leaders:
- Laggards:

## Evidence
- Breadth ratio:
- Volume confirmation:
- News or catalyst support:

## Interpretation
- What the breadth says about move quality:
- What would confirm continuation:
- What would weaken the theme:
```

## Rules

- Do not describe a move as broad if only one or two names lead.
- Separate tape evidence from narrative explanation.
- State basket assumptions explicitly when the universe is inferred.

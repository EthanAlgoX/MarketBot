---
name: pair-correlation
description: Analyze pair correlation, beta, spread divergence, and rolling co-movement for two or more assets. Use when the user asks how names move together, whether a pair is stretched, or which peers track a target.
metadata: {"marketbot":{"emoji":"🧷","triggers":["correlation","pair trade","pairs trade","rolling correlation","beta to","co-movement","spread z-score","related stocks","哪些股票联动","相关性"],"output":"pair-correlation-report","risk":"medium","freshness":"end-of-day","tools":["market_snapshot","market_source_plan"],"required_tools":["market_snapshot"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","etf","crypto","commodity"],"task_type":"correlation-analysis","determinism":"script-backed","priority":85}}
---

# Pair Correlation

Use this skill for relationship analysis across two or more symbols.

## When to use

- User asks whether two names move together.
- User wants a pair-trading style read on spread divergence.
- `portfolio-analyzer` or `stock-watch` needs a focused co-movement view.

## Workflow

1. Confirm the symbols and the lookback window. Default to `1y` if missing.
2. Read [references/analysis-playbook.md](references/analysis-playbook.md) for
   metric definitions and interpretation thresholds.
3. When price history is needed, run the helper script:

```bash
uv run --script marketbot/skills/pair-correlation/scripts/correlation.py NVDA AMD --period 1y --window 60
```

4. Analyze:
   - return correlation
   - rolling correlation stability
   - beta / relative sensitivity
   - spread or relative-performance stretch when relevant
5. Use `market_snapshot` for current context and last move comparison.
6. If the user wants portfolio implications, pair with `portfolio-analyzer`.

## Output format

```md
# Pair Correlation: <A> vs <B>

## Setup
- Lookback:
- Market:
- Current move:

## Relationship
- Correlation:
- Rolling correlation:
- Beta:
- Relative strength / spread:

## Interpretation
- What links the pair:
- What weakens the relationship:

## Watchpoints
- Break conditions:
- Risk to the thesis:
```

## Rules

- Always state the lookback window used or assumed.
- Do not equate correlation with causation.
- Flag unstable relationships when rolling behavior varies materially.

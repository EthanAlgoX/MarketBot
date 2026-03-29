---
name: earnings-readout
description: Summarize an earnings release into beat-or-miss, guidance change, call highlights, price reaction, and follow-up catalysts for a stock or watchlist name.
metadata: {"marketbot":{"emoji":"🧾","triggers":["earnings results","results","quarterly report","guidance","beat or miss","财报","业绩解读","电话会"],"output":"earnings-readout-report","risk":"high","freshness":"event-live","tools":["market_news","market_event_extract","market_snapshot","market_fundamentals"],"required_tools":["market_news","market_snapshot"],"markets":["a-share","hong-kong","us","global"],"asset_classes":["equity","etf"],"task_type":"earnings-analysis","determinism":"tool-backed","priority":90}}
---

# Earnings Readout

Use this skill to turn a results release into a structured readout that is fast
to scan and easy to compare across names.

## When to use

- User asks for earnings interpretation or post-results reaction.
- A stock gaps after reporting and the move needs decomposition.
- `market-report` needs a specialist event summary around a reporting date.

## Workflow

1. Use `market_news` to gather the latest results headlines and call summaries.
2. Use `market_event_extract` on the most important earnings item when a clean
   event breakdown is needed.
3. Use `market_snapshot` for the immediate price and volume reaction.
4. Use `market_fundamentals` for context such as valuation or trailing growth
   fields when available.
5. When you have raw release text or call notes saved locally, run:

```bash
python marketbot/skills/earnings-readout/scripts/readout.py /path/to/earnings_notes.txt
```

6. Read [references/readout-template.md](references/readout-template.md) if the
   release includes multiple moving parts or conflicting signals.
7. If the stock reaction depends on a multi-step transmission path, use
   `logic_chain_visualizer` to show how beat/miss, guidance, margins, and
   valuation compression or expansion connect.

## Output format

```md
# Earnings Readout: <SYMBOL>

## Headline
- Quarter:
- Price reaction:
- Initial verdict:

## What Beat / Missed
- Revenue:
- EPS / profit:
- Margin / demand notes:

## Guidance
- Raised / maintained / cut:
- Management tone:

## Why The Stock Moved
- Primary driver:
- Secondary driver:

## Follow-up Catalysts
- Next thing to watch:
- What would confirm the reaction:

## Risks
- Quality of beat:
- One-off effects:
- Expectations still embedded:
```

## Rules

- Separate reported facts from interpretation.
- If guidance is missing, say so directly.
- Do not compress beat/miss and guidance into a single conclusion when they
  point in different directions.

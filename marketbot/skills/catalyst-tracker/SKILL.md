---
name: catalyst-tracker
description: Build a catalyst list and event calendar for an asset.
metadata: {"marketbot":{"emoji":"🗓️","triggers":["catalyst","event","calendar","news driver"],"output":"catalyst-tracker","risk":"medium","freshness":"event-live","tools":["market_news","market_event_extract","market_macro"],"required_tools":["market_news","market_event_extract"],"markets":["a-share","hong-kong","us","global"],"asset_classes":["equity","crypto","commodity","macro","etf"]}}
---

# Catalyst Tracker

Compile relevant catalysts and event risk for a given asset and timeframe.

## When to use

- User asks for catalysts, upcoming events, or news drivers.
- You need event context before making a directional call.
- A market move appears headline-driven and needs decomposition.

## Preferred marketbot workflow

1. Use `market_news` for recent headlines on the symbol.
2. Use `market_event_extract` on the most important headline(s).
3. Use `market_macro` if the asset is macro-sensitive.
4. If the user asks for a complete view, pair this skill with `market-report`.

## Inputs to confirm if missing

- Asset and market
- Time horizon (`days`, `weeks`, `months`)
- Geographic focus when macro-sensitive

## Output format

```md
# Catalyst Tracker: <ASSET>

## Upcoming (Confirmed)
- <date>: <event> — expected impact: low/medium/high

## Recent (Last 7-30 Days)
- <date>: <event> — market reaction summary

## Macro / Industry Watchlist
- <event>: why it matters

## Data Gaps
- Missing sources or unverified events

> Disclaimer: MarketBot provides research and analysis only, not financial advice.
```

## Rules

- Separate confirmed events from speculation.
- Use exact dates when available; otherwise say `TBD`.
- State what would invalidate the catalyst narrative.

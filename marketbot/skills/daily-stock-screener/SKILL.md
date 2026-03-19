---
name: daily-stock-screener
description: Screen a daily equity watchlist with valuation, trend, volume, and news sentiment filters to produce ranked candidates and a concise market brief.
metadata: {"marketbot":{"emoji":"🧾","triggers":["screen","screener","scan","watchlist","candidates","candidate","shortlist","rank","ranking","top ideas","watchlist brief","stock picks","机会筛选","股票筛选","候选","打分","排序"],"output":"daily-stock-screener-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_social_sentiment","market_fundamentals","market_brief"],"required_tools":["market_snapshot","market_news","market_fundamentals"],"markets":["a-share","hong-kong","us","mixed"],"asset_classes":["equity"]}}
---

# Daily Stock Screener

Use this skill to turn a watchlist into a ranked shortlist of daily trade candidates.

It is designed for lightweight daily screening, not execution-grade alpha research.

## When to use

- User asks to screen a stock list for today's opportunities.
- User wants a ranked shortlist based on trend, valuation, volume, and sentiment.
- A recurring job needs a repeatable daily watchlist brief.

## Inputs

Confirm these when the user provides them. If they do not, use the defaults below and state that you did.

- `watchlist`: list of equities to screen
- `market_index`: benchmark for context
- `pe_range`: default `5-25`
- `rsi_range`: default `30-70`
- `volume_multiplier`: default `1.5`
- `sentiment_threshold`: default `0.2`
- `report_format`: default `markdown`

Safe defaults by market:

- `US`: benchmark `SPY`
- `growth / tech-heavy`: benchmark `QQQ`
- `A-share`: benchmark `CSI 300`
- `Hong Kong`: benchmark `HSI`

## Tools to use

Primary tools:

1. `market_snapshot` for price, change, volume, average volume, flow hints, and momentum proxy
   - For A-share lists, prefer TickFlow-backed realtime snapshot when configured.
2. `market_fundamentals` for valuation fields such as PE when available
   - For A-share lists, TickFlow currently provides profile/share-cap basics first; PE/PB may still be unavailable and should be labeled explicitly.
3. `market_news` for recent headlines
4. `market_social_sentiment` for crowd tone when relevant
   - For A-share and Hong Kong lists, do not assume Reddit-like live coverage; treat social tone as optional and lower-confidence unless a market-native source is present.
5. `market_brief` for final market summary and scenario framing

Optional enrichment:

- If the user explicitly requires exact `RSI`, `20MA`, or `50MA`, load `stock-info-explorer` and use its local Yahoo-based script.
- If exact indicator coverage is unavailable for a symbol or market, do not invent values. Mark them as `unavailable` and continue with the remaining filters.

Read [references/screening-playbook.md](references/screening-playbook.md) when you need:

- the default scoring breakdown
- explicit downgrade behavior for missing indicators
- a reusable rejected / borderline classification pattern

## Processing pipeline

Run this pipeline in order:

1. Normalize the watchlist and identify the market lane.
2. Fetch snapshot and fundamentals data for every symbol.
3. Apply hard filters:
   - PE inside range, if PE exists
   - volume spike above `volume_multiplier`
   - trend / momentum proxies are not clearly bearish
4. Fetch recent headlines for the remaining names.
5. Score sentiment from headlines and social context.
6. Rank surviving names.
7. Generate a short market brief plus top candidates.

## Screening rules

Use the user's exact thresholds when provided. Otherwise use the defaults below.

### Hard filters

- `P/E Ratio`: keep names inside `5-25` when PE is available
- `Volume Spike`: prefer names with `volume / avgVolume > 1.5`
- `Trend Filter`: prefer names with positive momentum or clear inflow hints
- `Sentiment Filter`: prefer names with sentiment score above `0.2`

### Technical rules

If exact technical indicators are available:

- `RSI`: keep `30-70`
- `Trend Filter`: price above `50MA`
- `Momentum`: `20MA > 50MA`

If exact technical indicators are not available:

- use `market_snapshot` momentum + flow hints as a proxy
- explicitly label technical precision as limited

## Ranking

Use a transparent score. A simple default is:

```text
score =
0.30 * trend_score
+ 0.25 * volume_score
+ 0.25 * sentiment_score
+ 0.20 * valuation_score
```

Interpretation:

- `trend_score`: price structure, momentum, inflow hint
- `volume_score`: volume spike vs average volume
- `sentiment_score`: headlines plus optional social tone
- `valuation_score`: PE inside range and not obviously stretched

If a factor is unavailable, reduce its weight and say so.

The more detailed scoring and downgrade notes live in [references/screening-playbook.md](references/screening-playbook.md).

## Pairings

- Use `market-report` if the user wants a full write-up after the screener.
- Use `news-intelligence` if one candidate has a complex catalyst that needs deeper event analysis.
- Use `sentiment-analysis` if the user asks for a fuller sentiment breakdown.
- Use `stock-data-sourcing` if source coverage is uncertain for the target market.
- Use `catalyst-tracker` for earnings dates and known upcoming catalysts.

## Output format

Default to Markdown:

```md
# Daily Stock Screener Report

## Market Context
- Benchmark:
- Session:
- Screening assumptions:

## Top Candidates

### 1. <SYMBOL>
- Score:
- Price:
- PE:
- RSI:
- Volume vs Avg:
- Sentiment:
- Why it passed:
- Risk flags:

### 2. <SYMBOL>
- Score:
- Price:
- PE:
- RSI:
- Volume vs Avg:
- Sentiment:
- Why it passed:
- Risk flags:

## Rejected / Borderline
- <SYMBOL>: reason

## Market Summary
- Breadth / tone:
- Best setups:
- Main risks:

> Disclaimer: MarketBot provides research and analysis only, not financial advice.
```

If the user asks for JSON, return:

```json
{
  "top_candidates": [],
  "sentiment_scores": {},
  "technical_metrics": {},
  "risk_flags": {},
  "market_summary": ""
}
```

## Rules

- Do not fabricate PE, RSI, moving averages, insider activity, or earnings dates.
- Separate hard facts from model judgment.
- If fewer than two names survive, say that the screen is sparse instead of padding the list.
- When sentiment is mixed or stale, downgrade confidence.
- Keep the final brief concise and ranking-oriented.

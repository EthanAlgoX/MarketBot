# Daily Stock Screener Playbook

Use this reference when you need a more explicit screening and ranking policy than the short version in `SKILL.md`.

## Default assumptions

If the user does not provide parameters, default to:

- `pe_range = 5-25`
- `rsi_range = 30-70`
- `volume_multiplier = 1.5`
- `sentiment_threshold = 0.2`
- `report_format = markdown`

Benchmark defaults:

- `US broad market`: `SPY`
- `US growth / tech`: `QQQ`
- `A-share`: `CSI 300`
- `Hong Kong`: `HSI`

## Factor model

Use a weighted score with an explicit note that it is heuristic:

```text
score =
0.30 * trend_score
+ 0.25 * volume_score
+ 0.25 * sentiment_score
+ 0.20 * valuation_score
```

### Factor definitions

- `trend_score`
  - strong positive momentum or bullish structure: `0.8-1.0`
  - neutral / mixed: `0.4-0.7`
  - weak / deteriorating: `0.0-0.3`
- `volume_score`
  - `>= 2.0x avgVolume`: `0.9-1.0`
  - `1.5x-2.0x`: `0.7-0.9`
  - `1.0x-1.5x`: `0.4-0.6`
  - `< 1.0x`: `0.0-0.3`
- `sentiment_score`
  - clearly positive catalyst flow: `> 0.6`
  - mixed but positive skew: `0.2-0.6`
  - weak / noisy: `-0.1 to 0.2`
  - clearly negative: `< -0.1`
- `valuation_score`
  - PE inside preferred range: `0.7-1.0`
  - PE slightly stretched: `0.3-0.6`
  - PE unavailable: mark as `unknown` and reduce weight

## Missing-data downgrade rules

Do not fail the whole screen because one field is missing.

### If PE is unavailable

- remove the valuation term from the denominator
- say `valuation unavailable for this symbol / market`

### If RSI / moving averages are unavailable

- switch to `market_snapshot` momentum and flow hints
- say `technical precision limited; used proxy trend signals`

### If news coverage is thin

- keep the symbol only if price/volume evidence is strong
- mark `sentiment confidence: low`

### If both news and fundamentals are thin

- move the symbol to `borderline`

## Candidate buckets

Use three buckets:

- `top candidates`: passed most filters and rank in the top tier
- `borderline`: one weak or missing dimension, but still worth watching
- `rejected`: failed a hard filter or had clearly negative evidence

## Rejection language

Keep rejected reasons short and factual:

- `PE above preferred range`
- `volume confirmation missing`
- `headline tone mixed / negative`
- `trend proxy still weak`
- `insufficient reliable data`

## Output discipline

- Never pad the shortlist.
- If only one symbol survives, say that the screener is sparse today.
- If none survive, return a concise `no clear setups` conclusion plus the top reasons for rejection.

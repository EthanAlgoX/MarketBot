# Panic Reversion Scoring Playbook

Use this file when the request needs a more explicit rubric for `恐慌系数`.

## First frame the selloff

Before scoring panic, write down:

- `Recent high anchor`
- `Current drawdown from that high`
- `Primary selloff cause`
- `Event progress`

Anchor selection priority:

1. user-specified swing high
2. last 5 trading days
3. last 10 trading days
4. pre-event high if a clear headline timestamp exists

Recommended event-progress labels:

- `Worsening`
- `Active but stabilizing`
- `Easing`
- `Mostly priced in`

## Suggested scoring rubric

Score the `Panic Coefficient` on a 0-100 basis:

- `Drawdown severity` 0-30
  - drawdown from recent high is extreme versus the symbol's normal behavior
  - same-day or 3-day drawdown is unusually fast
  - large gap-down plus intraday flush
- `Volume dislocation` 0-15
  - turnover or volume spikes far above baseline
  - forced liquidation or crowded one-way selling signs
- `Catalyst shock` 0-20
  - war, macro panic, policy headline, sector contagion
  - company-specific bad news should raise panic but also increase structural-risk review
- `Narrative capitulation` 0-15
  - broad fear language, one-sided bearish positioning, panic discussion intensity
- `Stabilization bonus` 0-20
  - long lower wick, reclaim from low, failed breakdown, or multi-bar base attempt

Do not interpret a high score as bullish by itself. It only means the washout is extreme.

## Drawdown bands

For common equities:

- `< 8%`: normal pullback
- `8-15%`: stress
- `15-25%`: high panic watch zone
- `> 25%`: extreme panic zone

For leveraged wrappers:

- `< 12%`: normal high-beta noise
- `12-20%`: stress
- `20-35%`: high panic watch zone
- `> 35%`: extreme panic zone

## Structural damage review

Classify separately:

- `Low`
  - shock is mostly exogenous
  - no new evidence of broken demand, fraud, dilution, or existential balance-sheet pressure
- `Medium`
  - some thesis uncertainty exists, but the business and catalyst path remain intact
- `High`
  - guidance cut, broken earnings logic, accounting issue, financing stress, regulatory impairment, or thesis invalidation

## Reversion grid

- `Prime Buy Window`
  - panic `>= 75`
  - structural damage not high
  - event progress is `Active but stabilizing` or `Easing`
  - stabilization signs visible
- `Watch Reclaim`
  - panic `60-74`, or panic is high but stabilization is incomplete
- `Avoid Knife Catch`
  - structural damage high
  - event progress is still `Worsening`
  - no stabilization
  - leveraged wrapper risk dominates the setup

## Event-progress action mapping

- `Worsening`
  - avoid new buying unless a user explicitly wants speculative probe logic
- `Active but stabilizing`
  - watch for reclaim and start with small sizing only
- `Easing`
  - allow staged buying if structural damage is not high
- `Mostly priced in`
  - avoid turning a late rebound into a fake "panic entry"

## Leveraged wrapper checklist

For Hong Kong leveraged products and similar wrappers:

- compare wrapper drawdown with underlying drawdown
- confirm the underlying is still liquid and thesis-valid
- check whether the wrapper's move is exaggerated by leverage reset, spread widening, or crowd de-risking
- lower confidence when the wrapper is thinly traded or the underlying session is closed

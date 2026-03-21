---
name: panic-reversion-monitor
description: Monitor how far a stock or leveraged equity product has fallen from its recent high, identify why it fell, track how the selloff event is progressing, and surface panic-reversion windows only when the damage looks temporary rather than structural.
metadata: {"marketbot":{"emoji":"🧯","triggers":["panic coefficient","panic monitor","panic reversion","fear index for stock","event-driven selloff","capitulation bounce","drawdown from recent high","selloff progress","跌离高点","高点回撤","下跌原因","事件进展","恐慌系数","恐慌监控","恐慌反转","错杀修复","恐慌抄底","暴跌后反弹","战争冲击抄底","单股恐慌","杠杆产品监控","07709","自动提醒"],"output":"panic-reversion-monitor-report","risk":"high","freshness":"market-live","tools":["market_snapshot","market_news","market_signal","market_social_sentiment"],"required_tools":["market_snapshot","market_news"],"markets":["a-share","hong-kong","us","mixed"],"asset_classes":["equity","etf"],"task_type":"event-driven-reversion","determinism":"tool-backed","priority":89}}
---

# Panic Reversion Monitor

Use this skill when the user wants to monitor a specific stock, ETF, or leveraged equity product after a sudden selloff by answering four concrete questions:

- how far it has fallen from a recent high
- why it fell
- how the selloff event is progressing
- whether the move now looks like tradable panic or genuine structural damage

This skill is especially useful for names like leveraged Hong Kong products where price can overshoot because of geopolitical shocks, gap moves, and crowd liquidation.

## When to use

- The user asks to monitor `恐慌系数`, `恐慌抄底`, `错杀反弹`, or `暴跌后修复`.
- The user asks how much a symbol has fallen from a recent high, what caused the drop, or whether the event is fading or worsening.
- The user wants alerts for a stock or leveraged product after war, macro shock, regulation headlines, or sector panic.
- The user asks whether a sharp drop is a `good buy window` or just a falling knife.
- The user wants a recurring reminder when a symbol enters a high-panic, low-structural-risk zone.

## Core idea

Do not treat `panic coefficient` as a single raw volatility number. The monitor must start with drawdown and event tracking.

Always produce these core outputs:

- `Recent High Anchor`: what recent high the selloff is being measured from
- `Drawdown`: how much the symbol has fallen from that anchor
- `Selloff Cause`: what actually triggered the drop
- `Event Progress`: `Worsening / Active but stabilizing / Easing / Mostly priced in`
- `Panic Coefficient (0-100)`: how extreme the washout is
- `Structural Damage Risk`: `Low / Medium / High`
- `Reversion State`: `Prime Buy Window / Watch Reclaim / Avoid Knife Catch`

High panic alone is not enough. A buyable setup needs high panic plus manageable structural damage plus early stabilization.

Read [references/scoring-playbook.md](references/scoring-playbook.md) when you need the detailed scoring rubric or the leveraged-product checklist.
Read [references/heartbeat-template.md](references/heartbeat-template.md) when the user wants recurring monitoring in `HEARTBEAT.md`.

## Hard rules

### Recent high anchor selection

Pick the recent high anchor in this order:

1. user-specified swing high
2. highest price in the last `5 trading days` for very short-term panic monitoring
3. highest price in the last `10 trading days` when the selloff spans more than 3 sessions
4. highest price immediately before the event headline if the trigger timing is clear

State explicitly which anchor was used. Do not switch anchors mid-analysis without saying so.

### Drawdown bands

Classify drawdown from the chosen anchor:

- `0-8%`: normal pullback, not panic by default
- `8-15%`: stress
- `15-25%`: high panic watch zone
- `25%+`: extreme panic zone

For leveraged products, use a stricter interpretation:

- `0-12%`: normal high-beta noise
- `12-20%`: stress
- `20-35%`: high panic watch zone
- `35%+`: extreme panic zone

### Event-progress to action mapping

- `Worsening`
  - default action: `Avoid Knife Catch`
  - exception: only allow `Watch Reclaim` if structural damage is low and price is no longer making fresh panic lows
- `Active but stabilizing`
  - default action: `Watch Reclaim`
  - upgrade to `Prime Buy Window` only if panic is high and the tape begins reclaiming
- `Easing`
  - default action: `Prime Buy Window` if structural damage is not high
- `Mostly priced in`
  - default action: focus on follow-through quality; do not chase if most of the rebound already happened

## Workflow

1. Use `market_snapshot` to check:
   - recent high anchor such as 5-day, 10-day, or user-specified swing high
   - current drawdown from that recent high
   - 1-day, 3-day, and 5-day drawdown acceleration
   - rebound off intraday or recent low
   - abnormal volume, turnover, and gap behavior
   - whether the product fell materially more than its underlying
2. Use `market_news` to identify the trigger:
   - exogenous shock such as war, macro fear, broad de-risking
   - sector-specific reset
   - company-specific impairment, dilution, guidance cut, or fraud risk
3. Use `market_news` again to track event progress:
   - is the catalyst still escalating
   - has there been clarification, de-escalation, or partial resolution
   - is the market reaction now lagging the event or still repricing new information
4. If available, use `market_social_sentiment` to judge whether the tape shows capitulation, panic chatter, or one-sided bearish crowding.
5. If available, use `market_signal` only as a confirmation layer, not the sole reason to call a bottom.
6. Score the setup:
   - `Panic Coefficient`
   - `Structural Damage Risk`
   - `Reversion State`
7. Give a staged plan:
   - first probe zone
   - add-on only after stabilization or reclaim
   - invalidation level or thesis break condition

## Decision rules

- `Prime Buy Window`
  Conditions:
  - `Panic Coefficient >= 75`
  - `Structural Damage Risk = Low` or `Medium`
  - selloff was triggered mainly by exogenous shock or crowd liquidation
  - the event is `Active but stabilizing` or `Easing`
  - price has stopped accelerating down and is showing bounce or base-building behavior
- `Watch Reclaim`
  Conditions:
  - `Panic Coefficient >= 60`
  - structural damage is not clearly high
  - panic is real, but either the tape or the event path has not yet stabilized
- `Avoid Knife Catch`
  Conditions:
  - structural damage is high, or
  - the drop is driven by company-specific impairment, or
  - the event is still worsening, or
  - leveraged product mechanics make the rebound thesis unreliable

## Trading-action template

- If `Drawdown` is below the high-panic watch zone, default to `watch`, not `buy`.
- If `Drawdown` is in the high-panic watch zone and `Event Progress = Active but stabilizing`, allow only a small probe.
- If `Drawdown` is in the extreme panic zone and `Event Progress = Easing`, allow staged entries instead of one-shot entries.
- If the rebound from the panic low already exceeds roughly half of the event drop, stop calling it an early panic entry and switch to reclaim-follow-through analysis.

## Leveraged product rules

For instruments like `2x long` products:

- Always inspect the underlying stock first.
- Call out leverage decay, premium/discount, and liquidity risk when relevant.
- If the product drawdown is much worse than the underlying because of forced de-risking but the underlying thesis is intact, that supports a panic-reversion interpretation.
- If the underlying itself is breaking on company-specific bad news, do not label the product as a high-quality panic-buy candidate.

## Monitoring requests

If the user asks for `监控`, `自动提醒`, `提醒`, or `alert`:

1. Treat it as a monitoring task first.
2. Check `HEARTBEAT.md`.
3. If a matching panic monitor already exists for the symbol, reply briefly that it is already configured.
4. Otherwise add a concise task that:
   - checks the target symbol and its underlying if relevant
   - records current drawdown from recent high
   - tracks the latest cause and event-progress state
   - alerts when `Panic Coefficient >= 75`
   - flags `Prime Buy Window` only when structural damage is not high
   - downgrades to `Avoid Knife Catch` if company-specific impairment appears
5. Use the heartbeat template reference as the default shape instead of inventing a new recurring-task format every time.

## Output format

```md
# Panic Reversion Check

- Symbol:
- Underlying:
- Recent High Anchor:
- Current Price:
- Drawdown From High:
- Selloff Cause:
- Event Progress:
- Panic Coefficient:
- Structural Damage Risk:
- Reversion State:
- Why this is or is not a buyable washout:

## Action Plan
- Probe zone:
- Add-on condition:
- Invalidation:
- What to monitor next:

## Risk Notes
- Distinguish exogenous fear from thesis break.
- Leveraged products can overshoot both ways.
- High panic without stabilization is not a buy signal yet.
```

## Rules

- Never describe the setup as guaranteed or "must rebound".
- Never use panic score alone to justify a buy.
- Separate `event shock`, `crowd liquidation`, and `fundamental impairment`.
- For single-stock or leveraged products, prefer staged entries over one-shot bottom calls.
- Always say which recent-high anchor and drawdown band were used.
- If live data is incomplete, mark the setup as `partially verified`.

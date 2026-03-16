---
name: vix-panic-reversion
description: Evaluate the VIX panic-reversion setup where VIX spikes above 35 and exits are considered after volatility normalizes below 20.
metadata: {"marketbot":{"emoji":"😱","triggers":["vix > 35","vix above 35","vix below 20","vix strategy","panic reversion","volatility washout","恐慌抄底","vix抄底","vix策略","波动率回落","恐慌指数","vix高于35","vix低于20","vix 自动提醒","vix监控","vix提醒"],"output":"vix-panic-reversion-report","risk":"high","freshness":"market-live","tools":["market_snapshot","market_macro","market_news","market_signal"],"required_tools":["market_snapshot","market_macro"],"markets":["us","global"],"asset_classes":["equity","etf","macro"],"task_type":"volatility-regime","determinism":"tool-backed","priority":88}}
---

# VIX Panic Reversion

Use this skill when the user wants to evaluate a panic-buying setup based on extreme volatility, usually expressed as:

- enter or scale in when `VIX > 35`
- reduce or exit when `VIX < 20`

Treat this as a regime-based mean-reversion framework, not a guaranteed edge. The user-supplied premise is that the setup worked in most past panic spikes, with 2008 as the main failure case. Do not restate it as "near 100%" or "must win".

## When to use

- The user asks whether a VIX spike is a buy-the-dip signal.
- The user mentions `VIX > 35`, panic, washout, capitulation, or volatility normalization.
- The user wants a rule-based re-entry/exit plan for broad US equity ETFs after panic selling.
- The user asks for a recurring monitor, reminder, or alert when `VIX > 35` or `VIX < 20`.

## Recurring Alert Requests

If the user asks for `自动提醒`, `监控`, `提醒`, or `alert`:

1. Treat it as a monitoring request first, not a long strategy explanation.
2. Check the agent workspace `HEARTBEAT.md`.
3. If a matching VIX monitor task already exists, reply briefly that the monitor is already configured.
4. If it does not exist, add a concise heartbeat task that:
   - checks `VIX`
   - alerts when `VIX > 35`
   - optionally notes normalization when `VIX < 20`
5. After the task is confirmed, reply in one short paragraph. Do not write a long market analysis unless the user asks for it.

## Workflow

1. Use `market_snapshot` to check live readings for `VIX`, `SPY`, and `QQQ`.
2. Use `market_macro` to identify whether the volatility spike is tied to:
   - systemic stress
   - policy shock
   - credit/liquidity stress
   - one-off growth scare
3. Use `market_news` to verify whether the panic is broad-market and not just a single-stock event.
4. Use `market_signal` to judge whether conditions are stabilizing or still accelerating downward.

## Decision Rules

Classify the setup into one of three states:

- `Valid panic-reversion candidate`
  Conditions:
  - `VIX >= 35`
  - broad index drawdown is market-wide
  - no evidence of worsening systemic credit/liquidity failure
  - panic is flattening rather than accelerating
- `Watch only`
  Conditions:
  - `VIX` is elevated but below 35, or
  - `VIX >= 35` but the shock is still intensifying
- `Avoid`
  Conditions:
  - evidence resembles a structural crisis, funding stress, or forced deleveraging regime
  - volatility is high and still rising with no stabilization signs

## Positioning Guidance

- Favor staggered entries over all-in entries.
- Prefer broad ETFs such as `SPY` or `QQQ` over weak single names unless the user explicitly wants stock-level trades.
- If the setup is active, describe scaling bands instead of a single perfect entry.
- If `VIX` cannot be verified live, say the setup is `unverified`.

## Exit Guidance

- Primary normalization trigger: `VIX < 20`
- Also consider partial exits when:
  - panic premium compresses quickly
  - price rebounds into major resistance
  - macro event risk remains unresolved even after volatility cools

## Output Format

```md
# VIX Panic Reversion Check

- Setup state: Valid panic-reversion candidate / Watch only / Avoid
- Live VIX status:
- Broad market status:
- Shock type:
- Why this does or does not qualify:

## Action Plan
- Entry framework:
- Scaling approach:
- Invalidations:
- Exit framework:

## Risk Notes
- This setup is historical and regime-dependent, not guaranteed.
- Structural-crisis conditions can break the pattern.
```

## Rules

- Never describe the strategy as guaranteed, risk-free, or "100% win rate".
- Always state whether the current setup is confirmed by live data or only discussed as a historical template.
- If evidence points to a 2008-style liquidity or systemic event, bias to `Avoid`.

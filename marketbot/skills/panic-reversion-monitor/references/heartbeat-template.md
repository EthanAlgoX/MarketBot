# Panic Reversion Heartbeat Template

Use this template when the user asks for recurring monitoring.

## Generic template

```md
<!-- marketbot:timezone Asia/Shanghai -->

- [ ] Panic reversion monitor for <SYMBOL>
  - Check <SYMBOL> and underlying <UNDERLYING>.
  - Measure drawdown from recent high using <ANCHOR_RULE>.
  - Identify selloff cause: exogenous shock / sector reset / company-specific damage.
  - Track event progress: Worsening / Active but stabilizing / Easing / Mostly priced in.
  - Compute Panic Coefficient and Structural Damage Risk.
  - Alert only when drawdown is in high panic watch zone or extreme panic zone.
  - Mark Prime Buy Window only if event progress is not worsening and structural damage is not high.
  - If rebound has already recovered more than half of the event drop, switch from panic-entry framing to reclaim-follow-through framing.
```

## 07709-style leveraged product template

Use this when the instrument is a leveraged Hong Kong wrapper tied to an underlying stock:

```md
<!-- marketbot:timezone Asia/Shanghai -->

- [ ] Panic reversion monitor for 07709
  - Check 07709 and its underlying equity first.
  - Use the user-specified swing high if provided; otherwise use last 5 trading days, then last 10 trading days, then pre-event high.
  - Record current price, recent high anchor, and drawdown from high.
  - Compare wrapper drawdown with underlying drawdown to detect overshoot from leverage and crowd liquidation.
  - Identify whether the drop was caused by war / macro fear / sector contagion / company-specific impairment.
  - Track whether the event is worsening, stabilizing, easing, or mostly priced in.
  - Compute Panic Coefficient.
  - Set Structural Damage Risk to High if the underlying thesis breaks on company-specific news.
  - Alert when drawdown reaches high panic watch zone or extreme panic zone.
  - Flag Prime Buy Window only when event progress is Active but stabilizing or Easing and price stops making fresh panic lows.
```

## Output fields for recurring alerts

Recurring alerts should mention:

- symbol
- underlying
- recent high anchor
- current price
- drawdown from high
- selloff cause
- event progress
- panic coefficient
- structural damage risk
- reversion state

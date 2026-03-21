<!-- marketbot:timezone Asia/Shanghai -->

- [ ] Panic reversion monitor for 07709
  - Instrument: 南方两倍做多海力士 07709
  - Underlying assumption: 海力士 / SK Hynix. If runtime data shows a different underlying mapping, use the runtime mapping.
  - Use the user-specified swing high if provided; otherwise use last 5 trading days, then last 10 trading days, then pre-event high.
  - Record recent high anchor, current price, and drawdown from high.
  - Compare 07709 drawdown with underlying drawdown to detect overshoot from leverage, spread widening, or crowd liquidation.
  - Identify the selloff cause: war / macro fear / sector contagion / company-specific impairment.
  - Track event progress as one of: Worsening / Active but stabilizing / Easing / Mostly priced in.
  - Compute Panic Coefficient and classify drawdown band using leveraged-product thresholds.
  - Set Structural Damage Risk to High if the underlying thesis breaks on company-specific news.
  - Mark Reversion State as Prime Buy Window only when event progress is Active but stabilizing or Easing and price stops making fresh panic lows.
  - If rebound from the panic low has already recovered more than half of the event drop, switch from panic-entry framing to reclaim-follow-through framing.
  - Alert output must include: symbol, underlying, recent high anchor, current price, drawdown from high, selloff cause, event progress, panic coefficient, structural damage risk, and reversion state.

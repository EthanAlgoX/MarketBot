---
name: market-report
description: Create a structured market analysis report with regime, levels, catalysts, and risks.
metadata: {"marketbot":{"emoji":"📋","triggers":["analysis","outlook","trade plan","bias"],"output":"market-analysis-report","risk":"medium","freshness":"market-live","tools":["market_snapshot","market_news","market_macro","market_signal","market_brief"],"required_tools":["market_snapshot","market_signal"],"markets":["a-share","hong-kong","us","global"],"asset_classes":["equity","crypto","commodity","etf"],"task_type":"orchestration","determinism":"tool-backed","priority":20}}
---

# Market Report

Produce a concise, structured market analysis report for a single asset.

This skill is the default orchestrator for market analysis. When a request is
actually about options structure, earnings interpretation, or pair
co-movement, route to the specialist skill first and then synthesize.

## When to use

- User asks for market analysis, outlook, or a trade plan.
- User requests regime, trend, levels, catalysts, or risk summary.
- You need to convert raw market data into a decision-ready note.

## Preferred marketbot workflow

1. Decide whether a specialist skill should lead:
   - `earnings-readout` for results-driven moves
   - `options-payoff` for strategy and payoff questions
   - `pair-correlation` for relationship or peer-linkage questions
2. Use `market_snapshot` for recent price, momentum, and flow hints.
   - For A-share workflows, prefer TickFlow-backed realtime snapshot when configured.
3. Use `market_news`, `market_social_sentiment`, and `market_macro` when relevant.
   - For A-share and Hong Kong workflows, treat social sentiment as low-confidence unless the runtime exposes a market-native source; default fallback may be synthetic rather than live forum data.
4. Use `market_event_extract` if a headline or catalyst is driving the move.
5. Use `market_signal` or `market_brief` to get a draft signal and scenario view.
6. If the user wants the view persisted for follow-up, call `market_brief` with `thesisMode=create` and a concise `thesisText`.
7. If the core edge or risk depends on a multi-step causal chain, call `logic_chain_visualizer` and include the generated Mermaid block as an optional appendix.
8. Write the final answer in the report format below, separating facts from assumptions.

## Inputs to confirm if missing

- Asset symbol and market (`stocks`, `crypto`, `futures`, `forex`, `etf`)
- Timeframe(s) such as `1h`, `4h`, `1d`
- Risk tolerance (`low`, `medium`, `high`)
- Style (`intraday`, `swing`, `position`)

If those are missing, make the narrowest safe assumption and state it explicitly.

## Output format

```md
# Market Analysis: <ASSET>

## Summary
- Direction/Bias:
- Confidence (0-100):
- Regime:

## Trend & Structure
- Trend (1h/4h/1d):
- Structure notes:

## Key Levels
- Support:
- Resistance:
- Invalidation:

## Catalysts
- Upcoming/Recent:

## Risks
- Primary risks:
- What would change the view:

## Plan
- Suggested action:
- Entry ideas:
- Stop:
- Targets:
- Position size guidance:

> Disclaimer: MarketBot provides research and analysis only, not financial advice.
```

## Style rules

- Keep it concise and actionable.
- Call out missing or stale data explicitly.
- Default to `watch` when evidence is weak.
- Never imply guaranteed returns.
- Do not redo specialist calculations inline when a narrower skill is a better
  fit; synthesize their output instead.

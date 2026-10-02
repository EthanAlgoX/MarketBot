---
name: portfolio-analyzer
description: Calculate cross-market holdings value, currency exposure, concentration, and explicitly assumed stress scenarios with auditable inputs.
metadata: {"marketbot":{"emoji":"📊","triggers":["portfolio","allocation","holdings","diversification","stress test","投资组合","资产配置","持仓组合","分散投资","组合风险","压力测试"],"output":"portfolio-analysis-report","risk":"high","freshness":"end-of-day","tools":["portfolio_risk","market_snapshot","market_macro","market_news"],"required_tools":["portfolio_risk","market_snapshot"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["portfolio"],"determinism":"tool-backed"}}
---

# Portfolio Analyzer

Help a personal investor understand how current holdings and new events affect
their portfolio. Use the user's language. Calculate supported metrics with
`portfolio_risk`; explain the returned values without inventing missing data.

## Inputs and research

1. Extract actual positions: ticker, quantity, price currency, and optional cash.
   Obtain current prices with `market_snapshot` or an available finance MCP.
   Retain the provider and the actual quote observation time when returned.
   A response's retrieval time does not establish the quote's observation time.
2. Confirm a reporting currency. Obtain or ask for explicit FX rates for every
   foreign currency: each rate means **one unit of that currency in the reporting
   currency**. Record source and observation time. Never add USD, CNY, and HKD
   amounts directly or substitute a rate of one for an unknown currency.
3. When the user supplies only weights, do not invent quantities or prices.
   Summarize the supplied allocation as user inputs and ask for holdings or
   market values to produce the tool-backed valuation. Clearly identify which
   figures have not been computed by `portfolio_risk`.
4. Query news and macro context relevant to the held assets. Explain which
   holdings are exposed to an event and which investment assumptions need review.

## Deterministic calculation

Call `portfolio_risk` with `holdings`, `baseCurrency`, optional `cash`, `fxRates`,
and optional `scenarios`. Example shape (all values below are illustrative inputs,
not live market data):

```json
{
  "baseCurrency": "CNY",
  "holdings": [
    {"symbol": "AAPL", "quantity": "10", "price": "200", "currency": "USD", "source": "user supplied"},
    {"symbol": "0700.HK", "quantity": "100", "price": "400", "currency": "HKD", "source": "user supplied"}
  ],
  "cash": [{"currency": "CNY", "amount": "10000"}],
  "fxRates": {"USD": {"rate": "7"}, "HKD": {"rate": "0.9"}},
  "scenarios": [{"name": "Assumed equity drawdown", "shockPct": "-20"}]
}
```

- Preserve decimal strings, currency labels, input provenance, and warnings.
- If the tool returns an error, state the missing or invalid input and repair it
  before presenting total portfolio value or a complete risk assessment.
- Explain position weights, cash share, currency exposure, and concentration.
  HHI is concentration by asset value, not a forecast of portfolio volatility.
- Stress results apply a supplied uniform price shock to holdings, with cash
  and FX fixed. Label the shock as an assumption, never an expected loss or a
  probability estimate. Do not invent a default shock without labelling it.
- This tool models long positions and cash. It does not model derivatives,
  leverage, short selling, taxes, fees, or ETF look-through sector exposure.

## Output

For ongoing tracking requested by the user, save the actual holdings, cash,
reporting currency and explicit rules with `market_watch(action="save",
kind="portfolio", ...)`. Record actual quote/FX observations and evaluate with
their evidence IDs. Partial FX, stale prices, or missing cash on a replacement
portfolio do not produce a new complete valuation. Read the local `outbox`;
acknowledge an alert only after it is received. `marketbot finance schedule`
provides deterministic periodic collection when the Gateway runs; external
delivery requires the user's requested channel and recipient.

Use a compact portfolio review with:

1. Valuation time, reporting currency, input coverage and provenance gaps.
2. Tool-computed total value, holdings weights, cash and currency exposure.
3. Concentration findings and explicit assumptions for any stress scenario.
4. Relevant events, affected holdings, and thesis conditions to monitor next.
5. Missing data and any unsupported analytics requested by the user.

Sharpe, Sortino, correlation, beta, CAGR, volatility, drawdown, and optimized
weights require actual historical series and a separate validated calculation.
Do not derive them from a current snapshot or fill a report template with model
guesses. Report unavailable fields explicitly. Research and scenario explanations
do not authorize trade execution.

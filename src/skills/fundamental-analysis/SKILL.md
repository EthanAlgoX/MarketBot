---
name: fundamental-analysis
description: Assess fundamentals, valuation, and balance-sheet health.
metadata: {"marketbot":{"skillKey":"fundamental-analysis","emoji":"🏢","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch a fundamentals source URL","dispatch":{"kind":"tool","toolName":"http_get","argMode":"raw"}},{"name":"snapshot","description":"Fetch a market snapshot for context","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}}]}}
---
# Fundamental Analysis

Use this skill to evaluate business quality and valuation. Provide conditional assessments only.

## Checklist

- Valuation: P/E, P/S, PEG vs peers
- Growth: revenue/EPS trend, margins
- Balance sheet: debt, cash, liquidity
- Moat/risks: competition, regulation, product risk
- Crypto: token supply, inflation, FDV vs float, value capture

## Fetch a source

```
https://www.sec.gov/ixviewer/documents/2024/0001652044-24-000042
```

## Snapshot (optional)

```json
{"asset":"GOOGL","market":"stocks","timeframes":["1d"],"mode":"auto"}
```

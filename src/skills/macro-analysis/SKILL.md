---
name: macro-analysis
description: Top-down macro regime checklist (rates, FX, liquidity).
metadata: {"marketbot":{"skillKey":"macro-analysis","emoji":"🌍","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch a macro data URL","dispatch":{"kind":"tool","toolName":"http_get","argMode":"raw"}},{"name":"snapshot","description":"Fetch a macro proxy market snapshot","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}}]}}
---
# Macro Analysis

Use this skill to characterize risk-on/off regime. Avoid direct trade calls.

## Checklist

- Rates: US10Y / real yields trend
- USD: DXY direction
- Inflation: CPI/PCE trend
- Growth: GDP/PMI, unemployment
- Volatility: VIX regime

## Fetch a macro source

```
https://fred.stlouisfed.org/series/DGS10
```

## Snapshot (optional)

```json
{"asset":"DXY","market":"forex","timeframes":["1d","1w"],"mode":"auto"}
```

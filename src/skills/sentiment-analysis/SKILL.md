---
name: sentiment-analysis
description: Gauge market mood from headlines and positioning.
metadata: {"marketbot":{"skillKey":"sentiment-analysis","emoji":"🎭","invocation":{"userInvocable":true},"commands":[{"name":"fetch","description":"Fetch a sentiment source URL","dispatch":{"kind":"tool","toolName":"http_get","argMode":"raw"}}]}}
---
# Sentiment Analysis

Use this skill to compare narrative vs price action. Ask for sources if missing.

## Inputs

- Headlines: major outlets, earnings summaries
- Positioning: funding rates, open interest (crypto)
- Fear/greed indices
- Social buzz (only if user provides sources)

## Fetch a source

```
https://finance.yahoo.com/quote/GOOGL
```

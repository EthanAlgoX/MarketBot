---
name: risk-check
description: Generate a risk-focused report from market data.
metadata: {"marketbot":{"skillKey":"risk-check","emoji":"rotating_light","invocation":{"userInvocable":true},"commands":[{"name":"report","description":"Generate a risk-focused report","dispatch":{"kind":"tool","toolName":"report_render","argMode":"raw"}}]}}
---
# Risk Check

Use this skill to generate a risk-focused report from market data.

```json
{"userQuery":"Risk check for SOL","marketData":{...}}
```

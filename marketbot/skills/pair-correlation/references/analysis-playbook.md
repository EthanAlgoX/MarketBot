# Pair Correlation Analysis Playbook

## Metrics

- Correlation: summary of historical co-movement.
- Rolling correlation: shows whether the relationship is stable.
- Beta: relative sensitivity of one asset to another.
- Spread divergence: whether the recent relative move looks stretched.

## Interpretation Guide

- `> 0.80`: strong co-movement
- `0.50 - 0.80`: moderate co-movement
- `< 0.50`: weak relationship
- negative: potential hedge or opposing driver

## Output Guardrails

- Mention the likely driver: same sector, macro factor, commodity link,
  supply-chain linkage, or broad beta.
- If the pair recently decoupled, state whether the decoupling looks temporary
  or thesis-breaking.
- Use qualitative language when exact return history is unavailable.

# MarketBot Skills Optimization Archive

## Goal

Strengthen the `marketbot/skills` layer by adopting the strongest patterns from
`himself65/finance-skills`: narrow task boundaries, deterministic workflows,
reference-backed execution, and consistent output shapes.

This archive focuses on skill design, not runtime or provider refactors.

## Design Principles

1. Prefer specialist skills over broad prompt bundles.
2. Keep orchestration skills thin and delegate deep analysis to narrow skills.
3. Add `references/` for formulas, output contracts, and downgrade rules.
4. Add `scripts/` only where deterministic computation is required repeatedly.
5. Make metadata routing tighter so specialist skills win over broad skills.

## Gaps Identified In MarketBot

- Broad skills such as `market-report`, `market-monitor`, and
  `market-discovery` carry too much analysis responsibility.
- Several common finance workflows do not have dedicated skills:
  options payoff, pair correlation, and earnings readout.
- Existing skills vary in depth: some have references/scripts, many are still
  instruction-only.
- The skills catalog is listed, but not yet organized as a product matrix.

## Skills Added In This Optimization Pass

### 1. `options-payoff`

- Purpose: map single-leg and multi-leg option structures into payoff,
  breakeven, max profit, max loss, and scenario explanations.
- Output: `options-payoff-report`
- Positioning: specialist skill used before or alongside `market-report`.

### 2. `pair-correlation`

- Purpose: analyze co-movement, beta, spread divergence, rolling correlation,
  and pair-trading style research for two or more assets.
- Output: `pair-correlation-report`
- Positioning: specialist skill used by portfolio and watchlist workflows.

### 3. `earnings-readout`

- Purpose: turn a results release into a structured summary covering beat/miss,
  guidance, callouts, market reaction, and follow-up catalysts.
- Output: `earnings-readout-report`
- Positioning: specialist event skill used by `market-report` and
  `catalyst-tracker`.

## Skills Updated In This Optimization Pass

### `market-report`

Reframed as an orchestration skill. It should:

- choose specialist skills when the user asks for options, earnings, or
  correlation-heavy work
- use generic market tools only for the remaining gaps
- synthesize the final answer instead of redoing every deep analysis inline

## Recommended Next Phase

### Phase 2

- Add `sector-breadth`
- Add `macro-regime`
- Add `watchlist-dashboard`
- Add scripts for deterministic correlation and earnings parsing

Status:

- `sector-breadth`: added
- `macro-regime`: added
- `watchlist-dashboard`: pending

### Phase 3

- Extend metadata with `task_type`, `priority`, and `determinism`
- Build a skills capability matrix in `marketbot/skills/README.md`
- Add chart or artifact output conventions for dashboard-like skills

## Notes For Future Implementation

- Keep new skill bodies concise; move formulas and edge cases to references.
- Where execution becomes repetitive, add a local script rather than expanding
  SKILL.md.
- Do not let broad skills absorb specialist triggers unless the specialist is
  unavailable.

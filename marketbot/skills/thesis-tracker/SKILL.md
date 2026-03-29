---
name: thesis-tracker
description: Track an investment thesis across time, news flow, and market updates; classify it as strengthened, weakened, unchanged, or falsified.
metadata: {"marketbot":{"emoji":"🧠","triggers":["thesis tracker","track thesis","signal journal","view tracking","观点跟踪","逻辑跟踪"," thesis update","strengthened or weakened"],"output":"thesis-tracker-report","risk":"medium","freshness":"event-live","tools":["thesis_tracker","market_news","market_snapshot","intel_search"],"required_tools":["thesis_tracker"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["equity","etf","commodity","crypto","macro"],"task_type":"thesis-tracking","determinism":"tool-backed","priority":92}}
---

# Thesis Tracker

Use this skill to persist an investment thesis, revisit it later, and judge
whether new evidence strengthens, weakens, leaves unchanged, or falsifies the
original view.

## When to use

- The user wants to track a thesis over days or weeks instead of getting a
  one-off report.
- A catalyst, earnings event, or macro shock needs to be judged against a
  previously stated view.
- `market-report`, `stock-watch`, or `catalyst-tracker` surfaces a view that
  should become a durable research object.

## Workflow

1. Create the thesis with `thesis_tracker(action="create", ...)`.
2. When updating, gather fresh evidence with:
   - `market_news`
   - `market_snapshot`
   - `intel_search` for prior workspace intel
3. Update the thesis with `thesis_tracker(action="update", thesisId=..., evidence=..., note=...)`.
4. Use the returned verdict and confidence shift to explain whether the thesis
   is:
   - `strengthened`
   - `weakened`
   - `unchanged`
   - `falsified`

## Output format

```md
# Thesis Tracker: <SYMBOL>

## Current Thesis
- Thesis:
- Status:
- Confidence:

## Latest Update
- Verdict:
- Evidence summary:
- Why the status changed:

## Next Things To Watch
- Catalyst 1
- Risk 1
```

## Rules

- Separate the original thesis from new evidence.
- If the evidence is mixed, prefer `unchanged` or `weakened` over dramatic
  reclassification.
- Use `falsified` only when the new facts directly break the core premise.
- If evidence is thin, say confidence is low instead of forcing a strong verdict.

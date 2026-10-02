---
name: thesis-tracker
description: Persist investment hypotheses and review explicit numerical conditions against recorded facts, with declared and verified verdicts distinguished.
metadata: {"marketbot":{"emoji":"🧠","triggers":["thesis tracker","track thesis","signal journal","view tracking","观点跟踪","逻辑跟踪","投资论点","论点检查","证伪条件","thesis update"],"tools":["thesis_tracker","evidence_get","market_snapshot","market_news"],"output":"thesis-review","risk":"medium","freshness":"reference","markets":["a-share","hong-kong","us","global","mixed"],"task_type":"thesis-tracking","priority":80}}
---

# Thesis Tracker: Investment Conditions

For a user asking to track a thesis, save the original hypothesis separately from
new information. Clarify a measurable condition if the premise has no numerical
invalidation criterion; never invent a revenue or price threshold for the user.

1. Gather current financial facts with native market tools. Their results include
   local evidence IDs. Use `evidence_get` to read the original payload and source
   observation time; retrieval time does not establish when a fact was observed.
2. Create using `thesis_tracker(action="create", symbol=..., thesis=..., rules=...)`.
   Each rule contains `id`, `metric`, `operator` (`lt/lte/gt/gte/eq/ne`), `threshold`,
   `effect` (`strengthened/weakened/falsified`), and `maxAgeSeconds`. Thresholds
   use the fact's units. Set age to match the reporting cadence: a quarterly fact
   and an intraday price need different cutoffs. Omission defaults to 86400 seconds.
3. Review persisted rules with `thesis_tracker(action="review", thesisId=...,
   observations=[{"metric":"price","evidenceId":"ev_...","jsonPointer":"/price"}])`.
   The pointer must locate that metric's numeric field in the immutable record.
   Optional value/time assertions must equal stored data. Use the actual returned
   ID; do not construct one or guess a field. `update(rules=...)` revises criteria.
4. Explain `verificationStatus`, `decisionSource`, and each `ruleResults` entry.
   Missing, stale, synthetic, derived, mismatched, or ambiguous inputs are
   inconclusive and do not change status/confidence. A verified falsification
   marks the thesis inactive. Positive results do not reopen a user-closed view.
5. Use `update(evidence=..., note=...)` for narrative observations. Negative
   sentiment cannot falsify a thesis. Explicit user verdict/status/confidence
   is a declaration, marked unverified; it is not a rule-verified decision.

Report the original premise, criteria and units, fact/evidence IDs and source
times, comparison result, remaining gaps, and next check. Confidence is supplied
or explicitly revised; the rule engine does not infer a probability of returns.
An immutable evidence ID establishes reproducibility, not source truth or
independent corroboration. Qualitative premises still need human judgment.

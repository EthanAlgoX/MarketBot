---
name: gsd:transition
description: Mark current phase complete and advance to next phase
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Mark current phase complete and advance to next. This is the natural point where progress tracking and PROJECT.md evolution happen.

"Planning next phase" = "current phase is done"
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/references/git-integration.md
</execution_context>

<context>
**Read these files NOW:**

@.planning/STATE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
</context>

<process>

## Phase 1: Load Project State

Before transition, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
```

Parse current position to verify we're transitioning the right phase.

## Phase 2: Verify Completion

Check current phase has all plan summaries:

```bash
ls .planning/phases/XX-current/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-current/*-SUMMARY.md 2>/dev/null | sort
```

**If all plans complete:**

Check config mode and proceed accordingly.

**If plans incomplete:**

**SAFETY RAIL: always_confirm_destructive applies here.**

Present:

```
Phase [X] has incomplete plans:
- {phase}-01-SUMMARY.md ✓ Complete
- {phase}-02-SUMMARY.md ✗ Missing
- {phase}-03-SUMMARY.md ✗ Missing

⚠️ Safety rail: Skipping plans requires confirmation (destructive action)

Options:
1. Continue current phase (execute remaining plans)
2. Mark complete anyway (skip remaining plans)
3. Review what's left
```

Wait for user decision.

## Phase 3: Cleanup Handoff

Check for lingering handoffs:

```bash
ls .planning/phases/XX-current/.continue-here*.md 2>/dev/null
```

If found, delete them — phase is complete, handoffs are stale.

## Phase 4: Update Roadmap

Update the roadmap file:

- Mark current phase: `[x] Complete`
- Add completion date
- Update plan count to final (e.g., "3/3 plans complete")
- Update Progress table
- Keep next phase as `[ ] Not started`

**Example:**

```markdown
## Phases

- [x] Phase 1: Foundation (completed 2025-01-15)
- [ ] Phase 2: Authentication ← Next
- [ ] Phase 3: Core Features

## Progress

| Phase             | Plans Complete | Status      | Completed  |
| ----------------- | -------------- | ----------- | ---------- |
| 1. Foundation     | 3/3            | Complete    | 2025-01-15 |
| 2. Authentication | 0/2            | Not started | -          |
| 3. Core Features  | 0/1            | Not started | -          |
```

## Phase 5: Evolve Project

Evolve PROJECT.md to reflect learnings from completed phase.

**Read phase summaries:**

```bash
cat .planning/phases/XX-current/*-SUMMARY.md
```

**Assess requirement changes:**

1. **Requirements validated?**
   - Move to Validated with phase reference: `- ✓ [Requirement] — Phase X`

2. **Requirements invalidated?**
   - Move to Out of Scope with reason

3. **Requirements emerged?**
   - Add to Active: `- [ ] [New requirement]`

4. **Decisions to log?**
   - Add to Key Decisions table with outcome

5. **"What This Is" still accurate?**
   - Update if the product has meaningfully changed

**Update "Last updated" footer:**

```markdown
---
*Last updated: [date] after Phase [X]*
```

## Phase 6: Update STATE.md Position

Update Current Position section:

```markdown
Phase: [next] of [total] ([Next phase name])
Plan: Not started
Status: Ready to plan
Last activity: [today] — Phase [X] complete, transitioned to Phase [X+1]

Progress: [updated progress bar]
```

## Phase 7: Update Project Reference

Update Project Reference section in STATE.md:

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [today])

**Core value:** [Current core value]
**Current focus:** [Next phase name]
```

## Phase 8: Review Accumulated Context

**Decisions:**
- Note recent decisions from this phase (3-5 max)
- Full log lives in PROJECT.md

**Blockers/Concerns:**
- If addressed in this phase: Remove from list
- If still relevant: Keep with phase prefix
- Add any new concerns from completed phase

## Phase 9: Update Session Continuity

```markdown
Last session: [today]
Stopped at: Phase [X] complete, ready to plan Phase [X+1]
Resume file: None
```

## Phase 10: Offer Next Phase

**Verify milestone status before presenting next steps.**

**Step 1: Read ROADMAP.md and identify phases in current milestone**

Count total phases and identify the highest phase number.

**Step 2: Route based on milestone status**

**Route A: More phases remain in milestone**

```
## ✓ Phase [X] Complete

---

## ▶ Next Up

**Phase [X+1]: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase [X+1]`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:discuss-phase [X+1]` — gather context first
- `/gsd:research-phase [X+1]` — investigate unknowns
- Review roadmap

---
```

**Route B: Milestone complete (all phases done)**

```
## ✓ Phase {X}: {Phase Name} Complete

🎉 Milestone {version} is 100% complete — all {N} phases finished!

---

## ▶ Next Up

**Complete Milestone {version}** — archive and prepare for next

`/gsd:complete-milestone {version}`

<sub>`/clear` first → fresh context window</sub>

---
```

</process>

<partial_completion>
If user wants to move on but phase isn't fully complete:

```
Phase [X] has incomplete plans:
- {phase}-02-PLAN.md (not executed)
- {phase}-03-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to later phase
3. Stay and finish current phase
```

Respect user judgment — they know if work matters.

**If marking complete with incomplete plans:**
- Update ROADMAP: "2/3 plans complete" (not "3/3")
- Note in transition message which plans were skipped
</partial_completion>

<success_criteria>
- [ ] Current phase plan summaries verified (all exist or user chose to skip)
- [ ] Any stale handoffs deleted
- [ ] ROADMAP.md updated with completion status and plan count
- [ ] PROJECT.md evolved (requirements, decisions, description if needed)
- [ ] STATE.md updated (position, project reference, context, session)
- [ ] Progress table updated
- [ ] User knows next steps
</success_criteria>

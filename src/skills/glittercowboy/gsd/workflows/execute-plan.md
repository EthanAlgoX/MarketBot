---
name: gsd:execute-plan
description: Execute a phase plan (PLAN.md) and create the outcome summary (SUMMARY.md)
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/references/git-integration.md
@/usr/lib/node_modules/clawdbot/skills/gsd/references/deviation-rules.md
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/summary.md
</execution_context>

<context>
Read STATE.md before any operation to load project context.
Read config.json for planning behavior settings.

@.planning/STATE.md
@.planning/config.json

**Conditional Loading:**

**If plan has checkpoints** (detect with: `grep -q 'type="checkpoint' PLAN.md`):
@/usr/lib/node_modules/clawdbot/skills/gsd/workflows/execute-plan-checkpoints.md

**If authentication error encountered during execution:**
@/usr/lib/node_modules/clawdbot/skills/gsd/workflows/execute-plan-auth.md
</context>

<process>

## Phase 1: Resolve Model Profile

Read model profile for agent spawning:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-executor | opus | sonnet | sonnet |

## Phase 2: Load Project State

Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:

- Current position (phase, plan, status)
- Accumulated decisions (constraints on this execution)
- Blockers/concerns (things to watch for)
- Brief alignment status

**If file missing but .planning/ exists:**

```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.

**Load planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

Store `COMMIT_PLANNING_DOCS` for use in git operations.

## Phase 3: Identify Plan

Find the next plan to execute:
- Check roadmap for "In progress" phase
- Find plans in that phase directory
- Identify first plan without corresponding SUMMARY

```bash
cat .planning/ROADMAP.md
ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

**Logic:**

- If `01-01-PLAN.md` exists but `01-01-SUMMARY.md` doesn't → execute 01-01
- If `01-01-SUMMARY.md` exists but `01-02-SUMMARY.md` doesn't → execute 01-02
- Pattern: Find first PLAN file without matching SUMMARY file

**Check for checkpoints:**

```bash
HAS_CHECKPOINTS=$(grep -q 'type="checkpoint' .planning/phases/XX-name/{phase}-{plan}-PLAN.md && echo "true" || echo "false")
```

If `HAS_CHECKPOINTS=true`, load execute-plan-checkpoints.md for checkpoint handling logic.

## Phase 4: Record Start Time

Record execution start time for performance tracking:

```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

## Phase 5: Load Prompt

Read the plan prompt:
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

This IS the execution instructions. Follow it exactly.

**If plan references CONTEXT.md:**
The CONTEXT.md file provides the user's vision for this phase.

## Phase 6: Previous Phase Check

Before executing, check if previous phase had issues:

```bash
ls .planning/phases/*/SUMMARY.md 2>/dev/null | sort -r | head -2 | tail -1
```

If previous phase SUMMARY.md has "Issues Encountered" != "None":

Use AskUserQuestion:

- header: "Previous Issues"
- question: "Previous phase had unresolved items: [summary]. How to proceed?"
- options:
  - "Proceed anyway" - Issues won't block this phase
  - "Address first" - Let's resolve before continuing
  - "Review previous" - Show me the full summary

## Phase 7: Execute

Execute each task in the prompt. **Deviations are normal** - handle them using deviation rules.

1. Read the @context files listed in the prompt

2. For each task:

   **If `type="auto"`:**

   - Work toward task completion
   - **If CLI/API returns authentication error:** Load execute-plan-auth.md
   - **When you discover additional work not in plan:** Apply deviation rules automatically
   - Run the verification
   - Confirm done criteria met
   - **Commit the task** (one commit per task)
   - Track task completion and commit hash for Summary documentation
   - Continue to next task

   **If `type="checkpoint:*"`:**

   - STOP immediately (do not continue to next task)
   - Execute checkpoint_protocol (see execute-plan-checkpoints.md)
   - Wait for user response
   - Only after user confirmation: continue to next task

3. Run overall verification checks from `<verification>` section
4. Confirm all success criteria from `<success_criteria>` section met
5. Document all deviations in Summary

## Phase 8: Task Commit Protocol

After each task completes:

**1. Stage only task-related files:**

```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**2. Commit with proper message:**

Format: `{type}({phase}-{plan}): {task-name-or-description}`

```bash
git commit -m "{type}({phase}-{plan}): {concise task description}

- {key change 1}
- {key change 2}
"
```

**3. Record commit hash:**

```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
```

## Phase 9: Record Completion Time

```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))
```

## Phase 10: Create Summary

Create `{phase}-{plan}-SUMMARY.md` in phase directory.
Use template: @/usr/lib/node_modules/clawdbot/skills/gsd/templates/summary.md

**Title format:** `# Phase [X] Plan [Y]: [Name] Summary`

The one-liner must be SUBSTANTIVE:

- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Authentication implemented"

**Include performance data:**

- Duration
- Started / Completed timestamps
- Tasks completed count
- Files modified count

## Phase 11: Update STATE.md

Update Current Position section:

```markdown
Phase: [current] of [total] ([phase name])
Plan: [just completed] of [total in phase]
Status: [In progress / Phase complete]
Last activity: [today] - Completed {phase}-{plan}-PLAN.md

Progress: [progress bar]
```

## Phase 12: Update ROADMAP

Update the roadmap file:

**If more plans remain in this phase:**
- Update plan count: "2/3 plans complete"
- Keep phase status as "In progress"

**If this was the last plan in the phase:**
- Mark phase complete: status → "Complete"
- Add completion date

## Phase 13: Git Commit Metadata

Commit execution metadata (SUMMARY + STATE + ROADMAP):

**If `COMMIT_PLANNING_DOCS=true`:**

```bash
git add .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
git add .planning/STATE.md
git add .planning/ROADMAP.md
git commit -m "docs({phase}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
- [Task 1 name]
- [Task 2 name]

SUMMARY: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
"
```

## Phase 14: Offer Next

**Verify remaining work before presenting next steps.**

**Step 1: Count plans and summaries in current phase**

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**Route A: More plans remain in this phase**

```
Plan {phase}-{plan} complete.
Summary: .planning/phases/{phase-dir}/{phase}-{plan}-SUMMARY.md

{Y} of {X} plans complete for Phase {Z}.

---

## ▶ Next Up

**{phase}-{next-plan}: [Plan Name]** — [objective]

`/gsd:execute-phase {phase}`

<sub>`/clear` first → fresh context window</sub>

---
```

**Route B: Phase complete, more phases remain**

```
Plan {phase}-{plan} complete.

## ✓ Phase {Z}: {Phase Name} Complete

All {Y} plans finished.

---

## ▶ Next Up

**Phase {Z+1}: {Next Phase Name}** — {Goal}

`/gsd:plan-phase {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---
```

**Route C: Milestone complete**

```
🎉 MILESTONE COMPLETE!

All {N} phases complete! Milestone is 100% done.

---

## ▶ Next Up

**Complete Milestone** — archive and prepare for next

`/gsd:complete-milestone`

---
```

</process>

<success_criteria>
- [ ] All tasks from PLAN.md completed
- [ ] All verifications pass
- [ ] SUMMARY.md created with substantive content
- [ ] STATE.md updated (position, decisions, issues, session)
- [ ] ROADMAP.md updated
- [ ] If codebase map exists: map updated with execution changes
</success_criteria>

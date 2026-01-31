---
name: gsd:pause-work
description: Create context handoff when pausing work mid-phase
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Enables seamless resumption in fresh session with full context restoration.
</objective>

<context>
@.planning/STATE.md
</context>

<process>

## Step 1: Find Current Phase

```bash
# Find most recently modified phase directory
PHASE_DIR=$(ls -td .planning/phases/*/ 2>/dev/null | head -1)
PHASE_NAME=$(basename "$PHASE_DIR")
echo "Current phase: $PHASE_NAME"
```

## Step 2: Gather Complete State

Collect for handoff:

1. **Current position**: Which phase, which plan, which task
2. **Work completed**: What got done this session
3. **Work remaining**: What's left in current plan/phase
4. **Decisions made**: Key decisions and rationale
5. **Blockers/issues**: Anything stuck
6. **Mental context**: The approach, next steps
7. **Files modified**: What's changed but not committed

Ask user for clarifications if needed:
- "What were you working on?"
- "Any blockers or issues?"
- "What should be done next?"

## Step 3: Write Handoff File

Write to `.planning/phases/${PHASE_NAME}/.continue-here.md`:

```markdown
---
phase: {PHASE_NAME}
task: {current_task}
total_tasks: {total}
status: in_progress
last_updated: {timestamp}
---

## Current State

[Where exactly are we? Immediate context]

## Completed Work

- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done]

## Remaining Work

- Task 3: [what's left]
- Task 4: Not started
- Task 5: Not started

## Decisions Made

- Decided to use [X] because [reason]
- Chose [approach] over [alternative] because [reason]

## Blockers

- [Blocker 1]: [status/workaround]

## Context

[Mental state, what were you thinking, the plan]

## Next Action

Start with: [specific first action when resuming]
```

Be specific enough for a fresh Claude to understand immediately.

## Step 4: Commit as WIP

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

if [ "$COMMIT_PLANNING_DOCS" = "true" ]; then
  git add ".planning/phases/${PHASE_NAME}/.continue-here.md"
  git commit -m "wip: ${PHASE_NAME} paused at task ${TASK}/${TOTAL}"
fi
```

## Step 5: Confirm

```
---

## ✓ Handoff Created

**.planning/phases/{PHASE_NAME}/.continue-here.md**

Current state:
- Phase: {PHASE_NAME}
- Task: {X} of {Y}
- Status: in_progress

To resume: `/gsd resume-work`

---
```

</process>

<success_criteria>
- [ ] .continue-here.md created in correct phase directory
- [ ] All sections filled with specific content
- [ ] Committed as WIP
- [ ] User knows location and how to resume
</success_criteria>

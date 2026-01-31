---
name: gsd:resume-work
description: Resume work from previous session with full context restoration
allowed-tools:
  - Read
  - Bash
  - Write
---

<objective>
Restore complete project context and resume work seamlessly from previous session.

Handles:
- STATE.md loading
- Checkpoint detection (.continue-here files)
- Incomplete work detection (PLAN without SUMMARY)
- Status presentation
- Context-aware next action routing
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

## Step 1: Verify Project Exists

```bash
if [ ! -d .planning ]; then
  echo "No project found. Run /gsd new-project to start."
  exit 1
fi
```

## Step 2: Load STATE.md

```bash
if [ -f .planning/STATE.md ]; then
  cat .planning/STATE.md
else
  echo "STATE.md missing - will reconstruct from artifacts"
fi
```

If missing: Reconstruct from ROADMAP.md, SUMMARY.md files, etc.

## Step 3: Check for Checkpoints

```bash
# Find any .continue-here.md files
CHECKPOINTS=$(find .planning/phases -name ".continue-here.md" 2>/dev/null)
if [ -n "$CHECKPOINTS" ]; then
  echo "Found checkpoints:"
  echo "$CHECKPOINTS"
fi
```

If checkpoint found:
- Read the checkpoint file
- Present the captured state
- Offer to continue from checkpoint

## Step 4: Check for Incomplete Work

```bash
# Find PLAN.md files without matching SUMMARY.md
for plan in .planning/phases/*/*-PLAN.md; do
  summary="${plan/-PLAN.md/-SUMMARY.md}"
  if [ ! -f "$summary" ]; then
    echo "Incomplete: $plan"
  fi
done
```

## Step 5: Present Status

```
---

## Project Status

**Project:** {from PROJECT.md}
**Current Phase:** {from STATE.md}

### Checkpoint Found (if any)

{Content from .continue-here.md}

### Incomplete Work (if any)

- Phase X, Plan Y: Not executed

### Recent Activity

{From STATE.md or recent SUMMARY.md}

---
```

## Step 6: Offer Next Actions

**If checkpoint exists:**

```
**▶ Resume from Checkpoint**

{Next action from .continue-here.md}

Ready to continue? (yes to proceed)

---

**Or:**
- `/gsd progress` — full status overview
- `/gsd execute-phase {N}` — execute incomplete plans
```

**If no checkpoint but incomplete work:**

```
**▶ Continue Work**

Incomplete plans found in Phase {N}.

`/gsd execute-phase {N}` — execute remaining plans

---
```

**If nothing pending:**

```
**▶ What's Next**

All current work complete.

`/gsd progress` — see what's next

---
```

## Step 7: Update Session Continuity

If resuming from checkpoint, update STATE.md:

```markdown
### Session Continuity

- Resumed: {timestamp}
- From checkpoint: {phase}/.continue-here.md
- Previous session: {info from checkpoint}
```

</process>

<success_criteria>
- [ ] Project existence verified
- [ ] STATE.md loaded or reconstructed
- [ ] Checkpoints detected and presented
- [ ] Incomplete work identified
- [ ] Clear status presented
- [ ] Appropriate next action offered
</success_criteria>

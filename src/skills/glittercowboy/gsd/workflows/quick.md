---
name: gsd:quick
description: Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

<objective>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking) while skipping optional agents (research, plan-checker, verifier).

Quick mode is the same system with a shorter path:
- Spawns gsd-planner (quick mode) + gsd-executor(s)
- Skips gsd-phase-researcher, gsd-plan-checker, gsd-verifier
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

Use when: You know exactly what to do and the task is small enough to not need research or verification.
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-planner.md
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-executor.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<process>

## Step 0: Resolve Model Profile

Read model profile for agent spawning:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner | opus | opus | sonnet |
| gsd-executor | opus | sonnet | sonnet |

---

## Step 1: Pre-flight validation

Check that an active GSD project exists:

```bash
if [ ! -f .planning/ROADMAP.md ]; then
  echo "Quick mode requires an active project with ROADMAP.md."
  echo "Run /gsd new-project first."
  exit 1
fi
```

If validation fails, stop immediately with the error message.

Quick tasks can run mid-phase - validation only checks ROADMAP.md exists, not phase status.

---

## Step 2: Get task description

Ask user: "What do you want to do?"

Store response as `$DESCRIPTION`.

If empty, re-prompt: "Please provide a task description."

Generate slug from description:
```bash
slug=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
```

---

## Step 3: Calculate next quick task number

Ensure `.planning/quick/` directory exists and find the next sequential number:

```bash
# Ensure .planning/quick/ exists
mkdir -p .planning/quick

# Find highest existing number and increment
last=$(ls -1d .planning/quick/[0-9][0-9][0-9]-* 2>/dev/null | sort -r | head -1 | xargs -I{} basename {} | grep -oE '^[0-9]+')

if [ -z "$last" ]; then
  next_num="001"
else
  next_num=$(printf "%03d" $((10#$last + 1)))
fi
```

---

## Step 4: Create quick task directory

Create the directory for this quick task:

```bash
QUICK_DIR=".planning/quick/${next_num}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report to user:
```
Creating quick task ${next_num}: ${DESCRIPTION}
Directory: ${QUICK_DIR}
```

---

## Step 5: Spawn planner (quick mode)

Read STATE.md content for context:

```bash
STATE_CONTENT=$(cat .planning/STATE.md 2>/dev/null)
```

Spawn gsd-planner with quick mode context:

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-planner.md for your role and instructions.

<planning_context>

**Mode:** quick
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

**Project State:**
${STATE_CONTENT}

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
- No research phase, no checker phase
- Target ~30% context usage (simple, focused)
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
    label="Quick plan: ${DESCRIPTION}",
    model="{planner_model}",
    cleanup="keep"
)
```

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`
2. Report: "Plan created: ${QUICK_DIR}/${next_num}-PLAN.md"

If plan not found, error: "Planner failed to create ${next_num}-PLAN.md"

---

## Step 6: Spawn executor

Read plan content:

```bash
PLAN_CONTENT=$(cat "${QUICK_DIR}/${next_num}-PLAN.md")
```

Spawn gsd-executor with plan:

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-executor.md for your role and instructions.

Execute quick task ${next_num}.

<plan>
${PLAN_CONTENT}
</plan>

<project_state>
${STATE_CONTENT}
</project_state>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
    label="Execute: ${DESCRIPTION}",
    model="{executor_model}",
    cleanup="keep"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
2. Extract commit hash from executor output
3. Report completion status

---

## Step 7: Update STATE.md

Update STATE.md with quick task completion record.

**7a. Check if "Quick Tasks Completed" section exists:**

Read STATE.md and check for `### Quick Tasks Completed` section.

**7b. If section doesn't exist, create it:**

Insert after `### Blockers/Concerns` section:

```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
```

**7c. Append new row to table:**

```markdown
| ${next_num} | ${DESCRIPTION} | $(date +%Y-%m-%d) | ${commit_hash} | [${next_num}-${slug}](./quick/${next_num}-${slug}/) |
```

Use Edit tool to make these changes atomically.

---

## Step 8: Final commit and completion

Stage and commit quick task artifacts:

```bash
# Stage quick task artifacts
git add ${QUICK_DIR}/${next_num}-PLAN.md
git add ${QUICK_DIR}/${next_num}-SUMMARY.md
git add .planning/STATE.md

# Commit with quick task format
git commit -m "docs(quick-${next_num}): ${DESCRIPTION}

Quick task completed."
```

Get final commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion output:

```
---

## ✓ Quick Task Complete

**Quick Task ${next_num}:** ${DESCRIPTION}

Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Commit: ${commit_hash}

---

Ready for next task: `/gsd quick`
```

</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] User provides task description
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Next number calculated (001, 002, 003...)
- [ ] Directory created at `.planning/quick/NNN-slug/`
- [ ] `${next_num}-PLAN.md` created by planner
- [ ] `${next_num}-SUMMARY.md` created by executor
- [ ] STATE.md updated with quick task row
- [ ] Artifacts committed
</success_criteria>

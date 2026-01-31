---
name: gsd:execute-plan-checkpoints
description: Checkpoint handling extension for execute-plan workflow
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Checkpoint handling extension for execute-plan.md. Load this file when a plan contains checkpoints.

**Detection:**
```bash
grep -q 'type="checkpoint' .planning/phases/XX-name/{phase}-{plan}-PLAN.md && echo "has_checkpoints"
```
</objective>

<execution_context>
This is an extension to execute-plan.md, loaded when plans have checkpoints.
</execution_context>

<context>
Current plan context from execute-plan.md
</context>

<process>

## Phase 1: Parse Segments

**Intelligent segmentation: Parse plan into execution segments.**

Plans are divided into segments by checkpoints. Each segment is routed to optimal execution context (subagent or main).

**1. Check for checkpoints:**

```bash
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**2. Analyze execution strategy:**

**If NO checkpoints found:**

- **Fully autonomous plan** - spawn single subagent for entire plan
- Subagent gets fresh 200k context, executes all tasks, creates SUMMARY, commits
- Main context: Just orchestration (~5% usage)

**If checkpoints found, parse into segments:**

Segment = tasks between checkpoints

**Segment routing rules:**

```
IF segment has no prior checkpoint:
  → SUBAGENT (first segment, nothing to depend on)

IF segment follows checkpoint:human-verify:
  → SUBAGENT (verification is just confirmation)

IF segment follows checkpoint:decision OR checkpoint:human-action:
  → MAIN CONTEXT (next tasks need the decision/result)
```

**3. Execution patterns:**

**Pattern A: Fully autonomous (no checkpoints)**
```
Spawn subagent → execute all tasks → SUMMARY → commit → report back
```

**Pattern B: Segmented with verify-only checkpoints**
```
Segment 1: Spawn subagent → execute → report back
Checkpoint: Main context → verify → continue
Segment 2: Spawn NEW subagent → execute → report back
Aggregate results → SUMMARY → commit
```

**Pattern C: Decision-dependent (must stay in main)**
```
Execute entirely in main context
No segmentation benefit
```

## Phase 2: Init Agent Tracking

Before spawning any subagents, set up tracking infrastructure:

```bash
# Create agent history file if doesn't exist
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi

# Clear any stale current-agent-id
rm -f .planning/current-agent-id.txt
```

**Check for interrupted agents:**

```bash
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

If interrupted agent found:
- Present to user: "Previous session was interrupted. Resume agent [ID] or start fresh?"

## Phase 3: Checkpoint Protocol

When encountering `type="checkpoint:*"`:

**Display checkpoint clearly:**

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Type]                                   ║
╚═══════════════════════════════════════════════════════╝

Progress: {X}/{Y} tasks complete
Task: [task name]

[Display task-specific content based on type]

────────────────────────────────────────────────────────
→ YOUR ACTION: [Resume signal instruction]
────────────────────────────────────────────────────────
```

**For checkpoint:human-verify (90% of checkpoints):**

```
Built: [what was automated - deployed, built, configured]

How to verify:
  1. [Step 1 - exact command/URL]
  2. [Step 2 - what to check]
  3. [Step 3 - expected behavior]

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**For checkpoint:decision (9% of checkpoints):**

```
Decision needed: [decision]

Context: [why this matters]

Options:
1. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

2. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

[Resume signal - e.g., "Select: option-id"]
```

**For checkpoint:human-action (1% - rare):**

```
I automated: [what Claude already did via CLI/API]

Need your help with: [the ONE thing with no CLI/API]

Instructions:
[Single unavoidable step]

I'll verify after: [verification]

[Resume signal - e.g., "Type 'done' when complete"]
```

**After displaying:** WAIT for user response. Do NOT hallucinate completion.

## Phase 4: Segment Execution

**For segmented plans (Pattern B):**

Execute segment-by-segment:

```
For each autonomous segment:
  Spawn subagent with prompt: "Execute tasks [X-Y] from plan. Do NOT create SUMMARY or commit."

  Wait for subagent completion
  Track agent_id in current-agent-id.txt
  Update agent-history.json

For each checkpoint:
  Execute in main context
  Wait for user interaction
  Continue to next segment

After all segments complete:
  Aggregate all results
  Create SUMMARY.md
  Commit with all changes
```

## Phase 5: Return for Orchestrator

**When spawned by an orchestrator and hitting a checkpoint:**

Return to the orchestrator with structured checkpoint state:

```markdown
## CHECKPOINT REACHED

**Type:** {type}
**Plan:** {phase}-{plan}
**Progress:** {X}/{Y} tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | {name} | {hash} | {files} |

### Current Task

**Task {N}:** {name}
**Status:** blocked
**Blocked by:** {reason}

### Checkpoint Details

{User-facing content}

### Awaiting

{What needed from user}
```

The orchestrator will:
1. Parse your structured return
2. Present checkpoint details to the user
3. Spawn a FRESH continuation agent

</process>

<success_criteria>
- [ ] Plan analyzed for checkpoint structure
- [ ] Execution pattern determined (A/B/C)
- [ ] Agent tracking initialized
- [ ] Checkpoints displayed with clear instructions
- [ ] User response awaited before continuing
- [ ] Segments executed with fresh subagents
- [ ] Results aggregated correctly
</success_criteria>

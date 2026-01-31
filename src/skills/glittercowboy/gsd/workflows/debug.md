---
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: "[issue description]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
---

<objective>
Debug issues using scientific method with subagent isolation.

**Orchestrator role:** Gather symptoms, spawn gsd-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh context per investigation. Main context stays lean for user interaction.
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-debugger.md
</execution_context>

<context>
User's issue: $ARGUMENTS

Check for active sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>

## 0. Resolve Model Profile

Read model profile for agent spawning:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-debugger | opus | sonnet | sonnet |

## 1. Check Active Sessions

If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (if new issue)

Ask user for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Spawn gsd-debugger Agent

Generate slug from issue description:
```bash
slug=$(echo "$ISSUE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-30)
```

Fill prompt and spawn:

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-debugger.md for your role and instructions.

<objective>
Investigate issue: {slug}

**Summary:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/{slug}.md
</debug_file>
",
    label="Debug {slug}",
    model="{debugger_model}",
    cleanup="keep"
)
```

## 4. Handle Agent Return

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" - spawn fix subagent
  - "Plan fix" - suggest /gsd plan-phase --gaps
  - "Manual fix" - done

**If `## DEBUG COMPLETE`:**
- Display fix applied and verification
- Show files changed and commit hash

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" - spawn new agent with additional context
  - "Manual investigation" - done
  - "Add more context" - gather more symptoms, spawn again

## 5. Spawn Continuation Agent (After Checkpoint)

When user responds to checkpoint, spawn fresh agent:

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-debugger.md for your role and instructions.

<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: .planning/debug/{slug}.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
",
    label="Continue debug {slug}",
    model="{debugger_model}",
    cleanup="keep"
)
```

</process>

<offer_next>
After debug completes:

```
---

## 🔧 Debug Complete

**Issue:** {slug}
**Root Cause:** {from debug file}
**Fix:** {applied or suggested}

---

**Next:**
- `/gsd progress` — check project status
- `/gsd quick` — quick ad-hoc task

---
```
</offer_next>

<success_criteria>
- [ ] Active sessions checked
- [ ] Symptoms gathered (if new)
- [ ] gsd-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Root cause confirmed before fixing
- [ ] Debug file persists for resume after context reset
</success_criteria>

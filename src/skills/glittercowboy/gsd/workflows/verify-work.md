---
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
---

<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose and prepare fix plans.

Output: {phase}-UAT.md tracking all test results. If issues found: diagnosed gaps ready for /gsd plan-phase --gaps
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-debugger.md
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-planner.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

## Step 1: Determine Phase

```bash
PHASE=$ARGUMENTS

if [ -z "$PHASE" ]; then
  # Check for active UAT sessions
  ACTIVE_UAT=$(find .planning/phases -name "*-UAT.md" -newer .planning/STATE.md 2>/dev/null | head -1)
  if [ -n "$ACTIVE_UAT" ]; then
    echo "Found active UAT: $ACTIVE_UAT"
    # Extract phase from path
  fi
fi

# Normalize and find phase directory
PADDED_PHASE=$(printf "%02d" ${PHASE} 2>/dev/null || echo "${PHASE}")
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE}-* 2>/dev/null | head -1)
```

If no phase determined: Ask user which phase to verify.

## Step 2: Find SUMMARY.md Files

```bash
SUMMARIES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
if [ -z "$SUMMARIES" ]; then
  echo "No SUMMARY.md files found. Phase may not be executed yet."
  echo "Run /gsd execute-phase ${PHASE} first."
  exit 1
fi
```

## Step 3: Extract Testable Deliverables

Read each SUMMARY.md and extract user-observable outcomes:

- Features that can be tested manually
- Behaviors that should work
- UI elements that should appear
- API endpoints that should respond

Create test list (internal, not shown to user yet).

## Step 4: Create/Update UAT.md

Create `${PHASE_DIR}/${PADDED_PHASE}-UAT.md`:

```markdown
# Phase {N} - User Acceptance Testing

**Started:** {date}
**Status:** in_progress

## Tests

| # | Test | Expected | Result | Notes |
|---|------|----------|--------|-------|
| 1 | {test description} | {expected behavior} | pending | |
| 2 | {test description} | {expected behavior} | pending | |

## Issues Found

(none yet)

---
*UAT session for phase {N}*
```

## Step 5: Present Tests One at a Time

For each test:

```
**Test {N}/{total}:** {test description}

Expected: {expected behavior}

Did it work? (yes/no, or describe what happened)
```

Wait for plain text response.

**Interpreting responses:**
- "yes", "y", "works", "good" → PASS
- Anything else → ISSUE (infer severity from description)

## Step 6: Update UAT.md After Each Response

On PASS:
- Update result to "✓ pass"

On ISSUE:
- Update result to "✗ fail"
- Add to Issues Found section with user's description
- Infer severity: critical (blocks usage), major (degrades experience), minor (cosmetic)

**Batch writes:** Update file on issue, every 5 passes, or completion.

## Step 7: On Completion

After all tests:

```bash
# Update status
sed -i 's/Status: in_progress/Status: complete/' "${PHASE_DIR}/${PADDED_PHASE}-UAT.md"

# Commit
git add "${PHASE_DIR}/${PADDED_PHASE}-UAT.md"
git commit -m "docs(${PHASE}): complete UAT

{N}/{M} tests passed
{X} issues found"
```

## Step 8: Route Based on Results

**If all tests pass:**

```
---

## ✓ Phase {N} Verified

**{N}/{N} tests passed**

UAT complete ✓

**▶ Next Up**

`/gsd plan-phase {N+1}` — plan next phase

---
```

**If issues found:**

```
---

## ⚠ Phase {N} Issues Found

**{passed}/{total} tests passed**
**{issues} issues found**

### Issues

{List from UAT.md}

**▶ Next Up**

`/gsd plan-phase {N} --gaps` — create fix plans

---
```

</process>

<anti_patterns>
- Don't present full checklist upfront — one test at a time
- Don't ask severity — infer from description
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log as gaps, fix after
</anti_patterns>

<success_criteria>
- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] UAT.md updated and committed
- [ ] Clear routing based on pass/fail results
</success_criteria>

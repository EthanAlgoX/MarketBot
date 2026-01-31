---
name: gsd:verify-phase
description: Verify phase goal achievement through goal-backward analysis
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---

<objective>
Verify phase goal achievement through goal-backward analysis. Check that the codebase actually delivers what the phase promised, not just that tasks were completed.

This workflow is executed by a verification subagent spawned from execute-phase.md.

**Core Principle: Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — a file was created — but the goal "working chat interface" was not achieved.

Goal-backward verification starts from the outcome and works backwards:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/references/verification-patterns.md
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/verification-report.md
</execution_context>

<context>
Phase number: $ARGUMENTS

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

## Phase 1: Load Context

**Gather all verification context:**

```bash
# Phase directory (match both zero-padded and unpadded)
PADDED_PHASE=$(printf "%02d" ${PHASE_ARG} 2>/dev/null || echo "${PHASE_ARG}")
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE_ARG}-* 2>/dev/null | head -1)

# Phase goal from ROADMAP
grep -A 5 "Phase ${PHASE_NUM}" .planning/ROADMAP.md

# Requirements mapped to this phase
grep -E "^| ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null

# All SUMMARY files (claims to verify)
ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null

# All PLAN files (for must_haves in frontmatter)
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

**Extract phase goal:** Parse ROADMAP.md for this phase's goal/description.

## Phase 2: Establish Must-Haves

**Option A: Must-haves in PLAN frontmatter**

Check if any PLAN.md has `must_haves`:

```bash
grep -l "must_haves:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

If found, extract and use:
```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
  key_links:
    - from: "Chat.tsx"
      to: "api/chat"
      via: "fetch in useEffect"
```

**Option B: Derive from phase goal**

If no must_haves, derive using goal-backward process:

1. **State the goal:** From ROADMAP.md
2. **Derive truths:** What must be TRUE? (3-7 observable behaviors)
3. **Derive artifacts:** What must EXIST? (concrete files)
4. **Derive key links:** What must be CONNECTED? (critical wiring)

## Phase 3: Verify Truths

**For each observable truth, determine if codebase enables it.**

**Verification status:**
- ✓ VERIFIED: All supporting artifacts pass all checks
- ✗ FAILED: Supporting artifacts missing, stub, or unwired
- ? UNCERTAIN: Can't verify programmatically

**For each truth:**
1. Identify supporting artifacts
2. Check artifact status
3. Check wiring status
4. Determine truth status

## Phase 4: Verify Artifacts

**For each required artifact, verify three levels:**

### Level 1: Existence
```bash
[ -f "$path" ] && echo "EXISTS" || echo "MISSING"
```

### Level 2: Substantive

**Line count check:**
```bash
lines=$(wc -l < "$path" 2>/dev/null || echo 0)
```

Minimum lines by type:
- Component: 15+ lines
- API route: 10+ lines
- Schema model: 5+ lines

**Stub pattern check:**
```bash
grep -c -E "TODO|FIXME|placeholder|not implemented" "$path"
```

### Level 3: Wired

**Import check:**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx" | wc -l
```

**Usage check:**
```bash
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import" | wc -l
```

### Final artifact status

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

## Phase 5: Verify Wiring

**Verify key links between artifacts.**

### Pattern: Component → API
```bash
grep -E "fetch\(['\"].*$api_path|axios\.(get|post).*$api_path" "$component"
```

### Pattern: API → Database
```bash
grep -E "prisma\.$model|db\.$model" "$route"
```

### Pattern: Form → Handler
```bash
grep -E "onSubmit=\{|handleSubmit" "$component"
```

## Phase 6: Verify Requirements

**Check requirements coverage if REQUIREMENTS.md exists.**

```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement:
1. Identify which truths/artifacts support it
2. Determine status based on supporting infrastructure

## Phase 7: Scan Anti-Patterns

Identify files modified in this phase:
```bash
grep -E "^\- \`" "$PHASE_DIR"/*-SUMMARY.md | sed 's/.*`\([^`]*\)`.*/\1/' | sort -u
```

Run anti-pattern detection:
- TODO/FIXME comments
- Placeholder content
- Empty implementations
- Console.log only implementations

Categorize findings:
- 🛑 Blocker: Prevents goal achievement
- ⚠️ Warning: Indicates incomplete
- ℹ️ Info: Notable but not problematic

## Phase 8: Identify Human Verification

Flag items that need human verification:

**Always needs human:**
- Visual appearance
- User flow completion
- Real-time behavior
- External service integration
- Performance feel
- Error message clarity

## Phase 9: Determine Status

**Status: passed**
- All truths VERIFIED
- All artifacts pass level 1-3
- All key links WIRED
- No blocker anti-patterns

**Status: gaps_found**
- One or more truths FAILED
- OR artifacts MISSING/STUB
- OR key links NOT_WIRED
- OR blocker anti-patterns found

**Status: human_needed**
- All automated checks pass
- BUT items flagged for human verification

**Calculate score:**
```
score = (verified_truths / total_truths)
```

## Phase 10: Generate Fix Plans

**If gaps_found, recommend fix plans.**

1. **Identify gap clusters:**
   - API stub + component not wired → "Wire frontend to backend"
   - Multiple artifacts missing → "Complete core implementation"

2. **Generate plan recommendations:**
```markdown
### {phase}-{next}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task to fix gap 1}
2. {Task to fix gap 2}
3. Re-verify phase goal

**Estimated scope:** {Small / Medium}
```

## Phase 11: Create Report

Generate VERIFICATION.md:

```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections:
1. Frontmatter
2. Goal Achievement table
3. Required Artifacts table
4. Key Link Verification table
5. Requirements Coverage
6. Anti-Patterns Found
7. Human Verification Required
8. Gaps Summary
9. Recommended Fix Plans
10. Verification Metadata

## Phase 12: Return to Orchestrator

**Return format:**

```markdown
## Verification Complete

**Status:** {passed | gaps_found | human_needed}
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

{If passed:}
All must-haves verified. Phase goal achieved. Ready to proceed.

{If gaps_found:}
### Gaps Found
{N} critical gaps blocking goal achievement

### Recommended Fixes
{N} fix plans recommended

{If human_needed:}
### Human Verification Required
{N} items need human testing
```

The orchestrator will:
- If `passed`: Continue to update_roadmap
- If `gaps_found`: Create and execute fix plans, then re-verify
- If `human_needed`: Present items to user

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>

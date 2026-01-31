---
name: gsd:audit-milestone
description: Audit milestone completion against original intent
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
---

<objective>
Verify milestone achieved its definition of done.
Checks requirements coverage, cross-phase integration, E2E flows.
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-integration-checker.md
</execution_context>

<process>

## Step 1: Determine Scope

```bash
# Get all phase directories
ls -d .planning/phases/*/
```

- Parse version from arguments or detect current
- Identify all phases in scope
- Extract milestone definition of done

## Step 2: Read Phase Verifications

For each phase:
```bash
cat .planning/phases/*-*/*-VERIFICATION.md
```

Extract:
- Status (passed/gaps_found)
- Critical gaps
- Tech debt
- Requirements coverage

Flag unverified phases as blockers.

## Step 3: Spawn Integration Checker

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-integration-checker.md

Check cross-phase integration and E2E flows for milestone.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}

Verify wiring and flows.",
    label="Integration check",
    cleanup="keep"
)
```

## Step 4: Check Requirements Coverage

For each requirement in REQUIREMENTS.md:
- Find owning phase
- Check verification status
- Mark: satisfied | partial | unsatisfied

## Step 5: Create Audit Report

Write `.planning/v{version}-MILESTONE-AUDIT.md`:

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:
  requirements: [...]
  integration: [...]
tech_debt:
  - phase: XX-name
    items: [...]
---
```

## Step 6: Route Based on Status

**If passed:**
```
## ✓ Audit Passed

All requirements met, integration verified.

**▶ Next:** `/gsd complete-milestone {version}`
```

**If gaps_found:**
```
## ⚠ Gaps Found

{N} critical issues need resolution.

**▶ Next:** `/gsd plan-phase --gaps` for affected phases
```

**If tech_debt:**
```
## ⚡ Tech Debt Found

No blockers, but {N} items deferred.

**▶ Options:**
- `/gsd complete-milestone` — accept debt
- Address debt first
```

</process>

<success_criteria>
- [ ] All phases checked for VERIFICATION.md
- [ ] Integration checker spawned
- [ ] Requirements coverage calculated
- [ ] Audit report created
- [ ] Clear routing based on status
</success_criteria>

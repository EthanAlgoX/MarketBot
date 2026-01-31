---
name: gsd:remove-phase
description: Remove a future phase from roadmap and renumber subsequent phases
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Remove an unstarted future phase and renumber all subsequent phases.
Git commit serves as historical record.
</objective>

<process>

## Step 1: Parse Arguments

```bash
if [ -z "$ARGUMENTS" ]; then
  echo "ERROR: Phase number required"
  echo "Usage: /gsd remove-phase <phase-number>"
  exit 1
fi
TARGET=$ARGUMENTS
```

## Step 2: Validate Phase Exists

```bash
grep -q "Phase ${TARGET}:" .planning/ROADMAP.md || {
  echo "ERROR: Phase ${TARGET} not found"
  exit 1
}
```

## Step 3: Validate Future Phase

```bash
# Get current phase from STATE.md
CURRENT=$(grep "Phase:" .planning/STATE.md | grep -oE "[0-9]+" | head -1)
if [ "$TARGET" -le "$CURRENT" ]; then
  echo "ERROR: Can only remove future phases (current: $CURRENT)"
  exit 1
fi
```

## Step 4: Check No Completed Work

```bash
if ls .planning/phases/${TARGET}-*/*-SUMMARY.md 2>/dev/null | grep -q .; then
  echo "ERROR: Phase has completed work (SUMMARY.md exists)"
  exit 1
fi
```

## Step 5: Gather Info & Confirm

Extract phase name, list what will be renumbered:

```
Removing Phase {TARGET}: {Name}

This will:
- Delete: .planning/phases/{TARGET}-{slug}/
- Renumber subsequent phases

Proceed? (yes to confirm)
```

## Step 6: Delete Phase Directory

```bash
rm -rf .planning/phases/${TARGET}-*/
```

## Step 7: Renumber Subsequent Phases

For each phase > TARGET (in reverse order):
```bash
# Rename directories: 18 → 17, 19 → 18, etc.
for dir in $(ls -d .planning/phases/*/ | sort -rV); do
  # Extract phase number, rename if > TARGET
done
```

## Step 8: Update ROADMAP.md

- Remove phase section
- Renumber all subsequent phases
- Update dependency references

## Step 9: Update STATE.md

Update phase count and progress.

## Step 10: Commit

```bash
git add .planning/
git commit -m "chore: remove phase ${TARGET} (${PHASE_NAME})"
```

## Step 11: Confirm

```
---

## ✓ Phase {TARGET} Removed

**{Name}** deleted and subsequent phases renumbered.

Commit: chore: remove phase {TARGET}

**▶ Next:** `/gsd progress`

---
```

</process>

<success_criteria>
- [ ] Phase validated as future/unstarted
- [ ] Directory deleted
- [ ] Subsequent phases renumbered
- [ ] ROADMAP.md and STATE.md updated
- [ ] Changes committed
</success_criteria>

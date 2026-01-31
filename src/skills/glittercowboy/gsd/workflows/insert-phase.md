---
name: gsd:insert-phase
description: Insert urgent work as decimal phase (e.g., 7.1) between existing phases
argument-hint: "<after> <description>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Insert a decimal phase for urgent work discovered mid-milestone.
Uses decimal numbering (7.1, 7.2) to preserve logical sequence.
</objective>

<process>

## Step 1: Parse Arguments

```bash
if [ $# -lt 2 ]; then
  echo "ERROR: Both phase number and description required"
  echo "Usage: /gsd insert-phase <after> <description>"
  echo "Example: /gsd insert-phase 7 Fix critical auth bug"
  exit 1
fi

AFTER_PHASE=$1
shift
DESCRIPTION="$*"
```

## Step 2: Verify Target Phase Exists

```bash
grep -q "Phase ${AFTER_PHASE}:" .planning/ROADMAP.md || {
  echo "ERROR: Phase ${AFTER_PHASE} not found"
  exit 1
}
```

## Step 3: Find Next Decimal

```bash
# Find existing decimals (7.1, 7.2, etc.)
EXISTING=$(grep -oE "Phase ${AFTER_PHASE}\.[0-9]+" .planning/ROADMAP.md | grep -oE "\.[0-9]+" | sort -n | tail -1)
if [ -z "$EXISTING" ]; then
  NEXT_DECIMAL=1
else
  NEXT_DECIMAL=$((${EXISTING#.} + 1))
fi
DECIMAL_PHASE="${AFTER_PHASE}.${NEXT_DECIMAL}"
PADDED=$(printf "%02d.%d" $AFTER_PHASE $NEXT_DECIMAL)
```

## Step 4: Generate Slug

```bash
slug=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

## Step 5: Create Phase Directory

```bash
mkdir -p ".planning/phases/${PADDED}-${slug}"
```

## Step 6: Update ROADMAP.md

Insert after target phase with (INSERTED) marker:

```markdown
### Phase {N.M}: {Description} (INSERTED)

**Goal:** [Urgent work - to be planned]
**Depends on:** Phase {N}

Plans:
- [ ] TBD (run /gsd plan-phase {N.M})
```

## Step 7: Update STATE.md

```
- Phase {N.M} inserted after Phase {N}: {description} (URGENT)
```

## Step 8: Confirm

```
---

## ✓ Phase {N.M} Inserted

**{description}** (URGENT)
After: Phase {N}
Directory: .planning/phases/{PADDED}-{slug}/

**▶ Next:** `/gsd plan-phase {N.M}`

---
```

</process>

<success_criteria>
- [ ] Decimal phase created
- [ ] ROADMAP.md updated with (INSERTED) marker
- [ ] Phase inserted in correct position
- [ ] User informed of next steps
</success_criteria>

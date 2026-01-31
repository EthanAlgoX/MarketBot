---
name: gsd:add-phase
description: Add phase to end of current milestone in roadmap
argument-hint: "<description>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Add a new integer phase to the end of the current milestone in the roadmap.
Automatically calculates next phase number based on existing phases.
</objective>

<process>

## Step 1: Parse Arguments

```bash
if [ -z "$ARGUMENTS" ]; then
  echo "ERROR: Phase description required"
  echo "Usage: /gsd add-phase <description>"
  exit 1
fi
DESCRIPTION="$ARGUMENTS"
```

## Step 2: Load Roadmap

```bash
if [ ! -f .planning/ROADMAP.md ]; then
  echo "ERROR: No roadmap found. Run /gsd new-project first."
  exit 1
fi
```

## Step 3: Calculate Next Phase Number

Find highest integer phase, add 1:

```bash
# Extract phase numbers, find max integer
LAST_PHASE=$(grep -oE "Phase [0-9]+" .planning/ROADMAP.md | grep -oE "[0-9]+" | sort -n | tail -1)
NEXT_PHASE=$((LAST_PHASE + 1))
PADDED=$(printf "%02d" $NEXT_PHASE)
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

Add new phase entry at end of current milestone:

```markdown
### Phase {N}: {Description}

**Goal:** [To be planned]
**Depends on:** Phase {N-1}

Plans:
- [ ] TBD (run /gsd plan-phase {N})
```

## Step 7: Update STATE.md

Add to "Roadmap Evolution" section:
```
- Phase {N} added: {description}
```

## Step 8: Confirm

```
---

## ✓ Phase {N} Added

**{description}**
Directory: .planning/phases/{PADDED}-{slug}/

**▶ Next:** `/gsd plan-phase {N}`

---
```

</process>

<success_criteria>
- [ ] Phase directory created
- [ ] ROADMAP.md updated
- [ ] STATE.md updated
- [ ] User informed of next steps
</success_criteria>

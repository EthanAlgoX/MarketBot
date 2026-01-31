---
name: gsd:new-milestone
description: Start a new milestone cycle — update PROJECT.md and route to requirements
argument-hint: "[milestone name]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Start a new milestone through unified flow: questioning → research → requirements → roadmap.
Brownfield equivalent of new-project. Project exists, this adds next milestone.
</objective>

<process>

## Step 1: Load Context

```bash
cat .planning/PROJECT.md
cat .planning/MILESTONES.md 2>/dev/null
cat .planning/STATE.md
```

- Extract what shipped previously
- Note pending todos and blockers

## Step 2: Gather Milestone Goals

If no arguments, ask: "What do you want to build next?"

Explore:
- Target features
- Priorities
- Constraints
- Scope boundaries

## Step 3: Determine Version

Parse last version from MILESTONES.md:
- v1.0 → suggest v1.1
- Or v2.0 for major changes

Confirm with user.

## Step 4: Update PROJECT.md

Add section:

```markdown
## Current Milestone: v{X.Y} {Name}

**Goal:** {One sentence}

**Target features:**
- {Feature 1}
- {Feature 2}
```

## Step 5: Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Status: Defining requirements
Last activity: {today} — Milestone v{X.Y} started
```

## Step 6: Commit

```bash
git add .planning/PROJECT.md .planning/STATE.md
git commit -m "docs: start milestone v{X.Y} {Name}"
```

## Step 7: Research Decision

Ask: "Research domain for new features?"
- Yes → spawn 4 parallel researchers (focus on NEW features only)
- No → proceed to requirements

## Step 8: Route to Requirements

Continue with requirements definition (same as new-project Phase 7).

## Step 9: Route to Roadmap

Spawn gsd-roadmapper with:
- Phase numbering continues from last milestone
- Focus on NEW requirements only

## Step 10: Done

```
---

## ✓ Milestone v{X.Y} Initialized

**{Name}**

{N} phases | {M} requirements

**▶ Next:** `/gsd plan-phase {first-phase}`

---
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with new milestone
- [ ] STATE.md reset for new milestone
- [ ] Research completed (if selected)
- [ ] Requirements defined
- [ ] Roadmap created (continues phase numbering)
</success_criteria>

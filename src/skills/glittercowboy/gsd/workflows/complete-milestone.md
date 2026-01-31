---
name: gsd:complete-milestone
description: Archive completed milestone and prepare for next version
argument-hint: "<version>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Archive milestone, create git tag, prepare for next version.
Creates historical record in .planning/milestones/.
</objective>

<process>

## Step 0: Pre-flight Check

```bash
# Check for audit
if [ ! -f ".planning/v${VERSION}-MILESTONE-AUDIT.md" ]; then
  echo "⚠ No audit found. Run /gsd audit-milestone first."
fi
```

## Step 1: Verify Readiness

```bash
# Check all phases have SUMMARY.md
for dir in .planning/phases/*/; do
  if ! ls "$dir"*-SUMMARY.md 2>/dev/null | grep -q .; then
    echo "Phase $(basename $dir) incomplete"
  fi
done
```

Present milestone stats, confirm.

## Step 2: Gather Stats

- Count phases, plans, tasks
- Calculate timeline from git log
- Extract key accomplishments from SUMMARYs

## Step 3: Archive Milestone

Create `.planning/milestones/v{version}-ROADMAP.md`:
- Full phase details from ROADMAP.md

Create `.planning/milestones/v{version}-REQUIREMENTS.md`:
- Requirements with outcomes

## Step 4: Update ROADMAP.md

Collapse completed milestone to one-line:

```markdown
## Completed: v{version}

See [v{version}-ROADMAP.md](./milestones/v{version}-ROADMAP.md)
```

## Step 5: Delete REQUIREMENTS.md

```bash
rm .planning/REQUIREMENTS.md
# Fresh one created by /gsd new-milestone
```

## Step 6: Update PROJECT.md

Add "Current State" section with shipped version.

## Step 7: Commit and Tag

```bash
git add .planning/
git commit -m "chore: archive v{version} milestone"
git tag -a "v{version}" -m "{milestone summary}"
```

## Step 8: Done

```
---

## 🎉 Milestone v{version} Complete

Archived to: .planning/milestones/
Git tag: v{version}

**▶ Next:** `/gsd new-milestone` — start next version

---
```

</process>

<success_criteria>
- [ ] All phases verified complete
- [ ] Milestone archived
- [ ] ROADMAP.md collapsed
- [ ] REQUIREMENTS.md deleted
- [ ] Git tag created
</success_criteria>

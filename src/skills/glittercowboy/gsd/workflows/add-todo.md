---
name: gsd:add-todo
description: Capture idea or task as todo from current conversation context
argument-hint: "[optional description]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work.

Enables "thought → capture → continue" flow without losing context or derailing current work.
</objective>

<context>
@.planning/STATE.md
</context>

<process>

## Step 1: Ensure Directory Structure

```bash
mkdir -p .planning/todos/pending .planning/todos/done
```

## Step 2: Check Existing Areas

```bash
ls .planning/todos/pending/*.md 2>/dev/null | xargs -I {} grep "^area:" {} 2>/dev/null | cut -d' ' -f2 | sort -u
```

Note existing areas for consistency.

## Step 3: Extract Content

**With arguments:** Use as the title/focus.
- `/gsd add-todo Add auth token refresh` → title = "Add auth token refresh"

**Without arguments:** Ask user: "What todo do you want to capture?"

Formulate:
- `title`: 3-10 word descriptive title (action verb preferred)
- `problem`: What's wrong or why this is needed
- `solution`: Approach hints or "TBD" if just an idea
- `files`: Relevant paths mentioned

## Step 4: Infer Area

Infer area from file paths or content:

| Pattern | Area |
|---------|------|
| `src/api/*`, `api/*` | `api` |
| `src/components/*`, `src/ui/*` | `ui` |
| `src/auth/*`, `auth/*` | `auth` |
| `src/db/*`, `database/*` | `database` |
| `tests/*`, `__tests__/*` | `testing` |
| `docs/*` | `docs` |
| `.planning/*` | `planning` |
| No files or unclear | `general` |

## Step 5: Check for Duplicates

```bash
grep -l -i "[key words from title]" .planning/todos/pending/*.md 2>/dev/null
```

If potential duplicate found:
- Read the existing todo
- Ask: "Similar todo exists: [title]. Skip, replace, or add anyway?"

## Step 6: Create Todo File

```bash
timestamp=$(date "+%Y-%m-%dT%H:%M")
date_prefix=$(date "+%Y-%m-%d")
slug=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)
```

Write to `.planning/todos/pending/${date_prefix}-${slug}.md`:

```markdown
---
created: {timestamp}
title: {title}
area: {area}
files:
  - {file:lines}
---

## Problem

{problem description - enough context for future Claude to understand}

## Solution

{approach hints or "TBD"}
```

## Step 7: Update STATE.md

If `.planning/STATE.md` exists:

```bash
TODO_COUNT=$(ls .planning/todos/pending/*.md 2>/dev/null | wc -l)
```

Update "### Pending Todos" section with new count.

## Step 8: Commit

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

if [ "$COMMIT_PLANNING_DOCS" = "true" ]; then
  git add ".planning/todos/pending/${date_prefix}-${slug}.md"
  [ -f .planning/STATE.md ] && git add .planning/STATE.md
  git commit -m "docs: capture todo - ${TITLE}

Area: ${AREA}"
fi
```

## Step 9: Confirm

```
---

## ✓ Todo Saved

**.planning/todos/pending/{filename}**

**{title}**
Area: {area}
Files: {count} referenced

---

Would you like to:

1. Continue with current work
2. Add another todo
3. View all todos (`/gsd check-todos`)

---
```

</process>

<anti_patterns>
- Don't create todos for work in current plan
- Don't create elaborate solution sections — captures ideas, not plans
- Don't block on missing information — "TBD" is fine
</anti_patterns>

<success_criteria>
- [ ] Directory structure exists
- [ ] Todo file created with valid frontmatter
- [ ] Problem section has enough context
- [ ] No duplicates (checked and resolved)
- [ ] Area consistent with existing todos
- [ ] STATE.md updated if exists
- [ ] Todo committed to git
</success_criteria>

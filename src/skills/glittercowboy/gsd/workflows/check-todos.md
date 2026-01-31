---
name: gsd:check-todos
description: List pending todos and select one to work on
argument-hint: "[area filter]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Enables reviewing captured ideas and deciding what to work on next.
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

## Step 1: Check for Todos

```bash
TODO_COUNT=$(ls .planning/todos/pending/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Pending todos: $TODO_COUNT"
```

If count is 0:

```
No pending todos.

Todos are captured during work sessions with `/gsd add-todo`.

---

Would you like to:

1. Continue with current phase (`/gsd progress`)
2. Add a todo now (`/gsd add-todo`)

---
```

Exit.

## Step 2: Parse Area Filter

Check for area filter in arguments:
- `/gsd check-todos` → show all
- `/gsd check-todos api` → filter to area:api only

## Step 3: List Todos

```bash
for file in .planning/todos/pending/*.md; do
  created=$(grep "^created:" "$file" | cut -d' ' -f2)
  title=$(grep "^title:" "$file" | cut -d':' -f2- | xargs)
  area=$(grep "^area:" "$file" | cut -d' ' -f2)
  echo "$created|$title|$area|$file"
done | sort
```

Apply area filter if specified. Display as numbered list:

```
## Pending Todos

1. **Add auth token refresh** (api, 2d ago)
2. **Fix modal z-index issue** (ui, 1d ago)
3. **Refactor database connection pool** (database, 5h ago)

---

Reply with a number to view details, or:
- `/gsd check-todos [area]` to filter by area
- `q` to exit

---
```

Format age as relative time (Xd ago, Xh ago).

## Step 4: Handle Selection

Wait for user to reply with a number.

If valid: load selected todo, proceed.
If invalid: "Invalid selection. Reply with a number (1-{N}) or `q` to exit."

## Step 5: Load Full Context

Read the todo file completely. Display:

```
## {title}

**Area:** {area}
**Created:** {date} ({relative time} ago)
**Files:** {list or "None"}

### Problem

{problem section content}

### Solution

{solution section content}
```

## Step 6: Check Roadmap Match

```bash
ls .planning/ROADMAP.md 2>/dev/null && echo "Roadmap exists"
```

If roadmap exists:
- Check if todo's area matches an upcoming phase
- Note any match for action options

## Step 7: Offer Actions

**If todo maps to a roadmap phase:**

```
This todo relates to **Phase {N}: {name}**.

What would you like to do?

1. **Work on it now** — move to done, start working
2. **Add to phase plan** — include when planning Phase {N}
3. **Brainstorm approach** — think through before deciding
4. **Put it back** — return to list
```

**If no roadmap match:**

```
What would you like to do?

1. **Work on it now** — move to done, start working
2. **Create a quick task** — `/gsd quick` with this scope
3. **Brainstorm approach** — think through before deciding
4. **Put it back** — return to list
```

## Step 8: Execute Action

**Work on it now:**
```bash
mv ".planning/todos/pending/{filename}" ".planning/todos/done/"
```
Update STATE.md todo count. Present problem/solution context. Begin work.

**Add to phase plan:**
Note todo reference. Keep in pending. Return to list.

**Create quick task:**
Route to `/gsd quick` with todo context.

**Brainstorm approach:**
Keep in pending. Start discussion about problem and approaches.

**Put it back:**
Return to list.

## Step 9: Update STATE.md

After any action that changes todo count:

```bash
TODO_COUNT=$(ls .planning/todos/pending/*.md 2>/dev/null | wc -l)
```

Update STATE.md "### Pending Todos" section.

## Step 10: Commit if Moved

If todo was moved to done/:

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

if [ "$COMMIT_PLANNING_DOCS" = "true" ]; then
  git add ".planning/todos/done/{filename}"
  [ -f .planning/STATE.md ] && git add .planning/STATE.md
  git commit -m "docs: start work on todo - {title}"
fi
```

</process>

<anti_patterns>
- Don't delete todos — move to done/ when work begins
- Don't start work without moving to done/ first
</anti_patterns>

<success_criteria>
- [ ] All pending todos listed with title, area, age
- [ ] Area filter applied if specified
- [ ] Selected todo's full context loaded
- [ ] Roadmap context checked for phase match
- [ ] Appropriate actions offered
- [ ] Selected action executed
- [ ] STATE.md updated if todo count changed
- [ ] Changes committed to git
</success_criteria>

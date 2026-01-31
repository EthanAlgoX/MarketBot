---
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
---

<objective>
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-codebase-mapper.md
</execution_context>

<context>
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**This command can run:**
- Before /gsd new-project (brownfield codebases) - creates codebase map first
- After /gsd new-project (greenfield codebases) - updates codebase map as code evolves
- Anytime to refresh codebase understanding
</context>

<when_to_use>
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
</when_to_use>

<process>

## Step 1: Check for Existing Codebase Map

```bash
if [ -d .planning/codebase ]; then
  echo "Codebase map already exists:"
  ls -la .planning/codebase/
  echo ""
  echo "Options: refresh (overwrite), skip, or view"
fi
```

If exists: Ask user to refresh, skip, or view existing.

## Step 2: Create Directory Structure

```bash
mkdir -p .planning/codebase
```

## Step 3: Resolve Model Profile

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-codebase-mapper | sonnet | sonnet | haiku |

## Step 4: Spawn 4 Parallel Mapper Agents

Display:
```
Mapping codebase with 4 parallel agents...
  → tech (STACK.md, INTEGRATIONS.md)
  → arch (ARCHITECTURE.md, STRUCTURE.md)
  → quality (CONVENTIONS.md, TESTING.md)
  → concerns (CONCERNS.md)
```

Spawn all 4 in parallel:

```
sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-codebase-mapper.md for your role and instructions.

<focus>tech</focus>

Analyze the codebase technology stack and external integrations.
Write directly to:
- .planning/codebase/STACK.md
- .planning/codebase/INTEGRATIONS.md

Return confirmation only (not document contents).
",
    label="Map codebase: tech",
    model="{mapper_model}",
    cleanup="keep"
)

sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-codebase-mapper.md for your role and instructions.

<focus>arch</focus>

Analyze the codebase architecture and file structure.
Write directly to:
- .planning/codebase/ARCHITECTURE.md
- .planning/codebase/STRUCTURE.md

Return confirmation only (not document contents).
",
    label="Map codebase: arch",
    model="{mapper_model}",
    cleanup="keep"
)

sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-codebase-mapper.md for your role and instructions.

<focus>quality</focus>

Analyze the codebase coding conventions and testing patterns.
Write directly to:
- .planning/codebase/CONVENTIONS.md
- .planning/codebase/TESTING.md

Return confirmation only (not document contents).
",
    label="Map codebase: quality",
    model="{mapper_model}",
    cleanup="keep"
)

sessions_spawn(
    task="First, read /usr/lib/node_modules/clawdbot/skills/gsd/agents/gsd-codebase-mapper.md for your role and instructions.

<focus>concerns</focus>

Analyze the codebase for technical debt and issues.
Write directly to:
- .planning/codebase/CONCERNS.md

Return confirmation only (not document contents).
",
    label="Map codebase: concerns",
    model="{mapper_model}",
    cleanup="keep"
)
```

## Step 5: Verify All Documents Created

After agents complete:

```bash
echo "Verifying codebase documents..."
for doc in STACK INTEGRATIONS ARCHITECTURE STRUCTURE CONVENTIONS TESTING CONCERNS; do
  if [ -f ".planning/codebase/${doc}.md" ]; then
    lines=$(wc -l < ".planning/codebase/${doc}.md")
    echo "✓ ${doc}.md (${lines} lines)"
  else
    echo "✗ ${doc}.md MISSING"
  fi
done
```

If any missing: Report which agents failed.

## Step 6: Commit Codebase Map

```bash
git add .planning/codebase/
git commit -m "docs: map existing codebase

Created 7 codebase documents:
- STACK.md, INTEGRATIONS.md (tech)
- ARCHITECTURE.md, STRUCTURE.md (arch)
- CONVENTIONS.md, TESTING.md (quality)
- CONCERNS.md (concerns)"
```

## Step 7: Offer Next Steps

```
---

## ✓ Codebase Mapped

**.planning/codebase/** created with 7 documents:

| Document | Lines | Focus |
|----------|-------|-------|
| STACK.md | {N} | Languages, frameworks, dependencies |
| INTEGRATIONS.md | {N} | External services, APIs |
| ARCHITECTURE.md | {N} | Patterns, layers, data flow |
| STRUCTURE.md | {N} | Directory layout, key files |
| CONVENTIONS.md | {N} | Coding standards, style |
| TESTING.md | {N} | Test setup, patterns |
| CONCERNS.md | {N} | Tech debt, issues |

**▶ Next Up**

`/gsd new-project` — initialize project with codebase context

---
```

</process>

<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written by mapper agents
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] Codebase map committed
- [ ] User knows next steps
</success_criteria>

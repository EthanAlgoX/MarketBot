---
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
Extract implementation decisions that downstream agents need — researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked.

**How it works:**
1. Analyze the phase to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide research and planning

**Output:** `{phase}-CONTEXT.md` — decisions clear enough that downstream agents can act without asking the user again
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/context.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

**Load project state:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md
</context>

<process>

## Step 1: Validate Phase

```bash
PHASE=$ARGUMENTS
if [ -z "$PHASE" ]; then
  echo "ERROR: Phase number required. Usage: /gsd discuss-phase 3"
  exit 1
fi

# Normalize phase number
PADDED_PHASE=$(printf "%02d" ${PHASE} 2>/dev/null || echo "${PHASE}")

# Check roadmap for phase
grep -E "Phase ${PHASE}:|Phase ${PADDED_PHASE}:" .planning/ROADMAP.md
```

If not found: Error with available phases.

## Step 2: Check for Existing CONTEXT.md

```bash
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE}-* 2>/dev/null | head -1)
ls "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null
```

**If CONTEXT.md exists:**
- Show current contents
- Ask: "Update this context, view and continue, or skip?"
- If skip → offer `/gsd plan-phase`

## Step 3: Analyze Phase for Gray Areas

Read the phase goal from ROADMAP.md. Analyze what kind of work this is:

**Domain detection:**
- Something users SEE → layout, density, interactions, states
- Something users CALL → responses, errors, auth, versioning
- Something users RUN → output format, flags, modes, error handling
- Something users READ → structure, tone, depth, flow
- Something being ORGANIZED → criteria, grouping, naming, exceptions

**Generate 3-4 phase-specific gray areas:**

Don't use generic categories. Generate questions specific to THIS phase:

Bad: "UI decisions"
Good: "How dense should the dashboard layout be? (compact vs spacious)"

Bad: "Error handling"
Good: "What happens when the payment fails mid-checkout?"

## Step 4: Present Gray Areas

Show the gray areas:

```
## Gray Areas for Phase {N}: {Name}

I've identified some decisions that would help planning:

1. **{Area 1}** — {brief description}
2. **{Area 2}** — {brief description}
3. **{Area 3}** — {brief description}

Which would you like to discuss? (numbers, or "all")
```

## Step 5: Deep-Dive Each Selected Area

For each selected area:

1. Ask 4 probing questions about the area
2. After answers, ask: "More questions about {area}, or move to next?"
3. If more → ask 4 more, repeat
4. If next → move to next area

**Probing question types:**
- "What should happen when...?"
- "How should this look/feel/behave?"
- "What's the priority between X and Y?"
- "Any specific examples you have in mind?"

## Step 6: Handle Scope Creep

**CRITICAL: Scope guardrail**

If user suggests capabilities outside the phase:

```
That sounds like its own phase. I'll capture it for later:
→ "{user's idea}"

For this phase, let's focus on {phase goal from ROADMAP}.
```

Track deferred ideas to include in CONTEXT.md.

## Step 7: Write CONTEXT.md

Create `${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md`:

```markdown
# Phase {N}: {Name} - Context

**Gathered:** {date}

## Decisions

{For each area discussed, capture the decisions made}

### {Area 1}
- {Decision 1}
- {Decision 2}

### {Area 2}
- {Decision 1}

## Claude's Discretion

{Things user didn't specify — Claude can decide during planning}

- {Item 1}
- {Item 2}

## Deferred Ideas

{Scope creep captured but not acted on}

- {Idea 1} — suggested during discussion
- {Idea 2}

---
*Context gathered for phase planning*
```

## Step 8: Commit and Offer Next Steps

```bash
git add "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
git commit -m "docs(${PHASE}): gather phase context

Discussed: {areas discussed}
Decisions captured for planning."
```

Offer next steps:

```
---

## ✓ Context Gathered

**Phase {N}: {Name}**
Context: ${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md

**▶ Next Up**

`/gsd plan-phase {N}` — create execution plans

---
```

</process>

<success_criteria>
- [ ] Gray areas identified through intelligent analysis
- [ ] User chose which areas to discuss
- [ ] Each selected area explored until satisfied
- [ ] Scope creep redirected to deferred ideas
- [ ] CONTEXT.md captures decisions, not vague vision
- [ ] User knows next steps
</success_criteria>

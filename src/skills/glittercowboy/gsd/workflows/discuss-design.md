---
name: gsd:discuss-design
description: Design phase-specific UI through conversation, then generate mockups
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Task
  - WebFetch
  - AskUserQuestion
---

<objective>
Design phase-specific UI elements through conversation before planning. Creates mockups for visual review, ensuring design decisions are made before implementation time is spent.

**When to use:**
- Before planning a phase with UI components
- When you want to visualize before coding
- When UI decisions need iteration
- To create component mockups for review
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/references/ui-principles.md
@/usr/lib/node_modules/clawdbot/skills/gsd/references/framework-patterns.md
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/phase-design.md
@/usr/lib/node_modules/clawdbot/skills/gsd/agents/design-specialist.md
</execution_context>

<context>
Phase number: $ARGUMENTS

@.planning/DESIGN-SYSTEM.md (if exists)
@.planning/ROADMAP.md
</context>

<process>

## Phase 1: Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DISCUSS DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Phase 2: Parse Phase

Extract phase number from argument.

If no phase provided:
```bash
# List available phases
ls -d .planning/phases/*/ 2>/dev/null | head -10
```

Ask via AskUserQuestion:
- header: "Phase"
- question: "Which phase are you designing for?"
- options: [list phases found, or freeform input]

Load phase details from ROADMAP.md:
```bash
grep -A 20 "^## Phase ${PHASE_NUM}" .planning/ROADMAP.md
```

## Phase 3: Load Design System

Check for project design system:

```bash
if [[ -f ".planning/DESIGN-SYSTEM.md" ]]; then
  echo "Design system found - loading as context"
  # Read and summarize key points
else
  echo "No design system - will use ui-principles defaults"
fi
```

If design system exists, load and summarize key constraints:
- Color palette
- Typography scale
- Component patterns
- Framework-specific notes

## Phase 4: Detect Framework

```bash
if [[ -f "package.json" ]]; then
  if grep -q '"next"' package.json; then
    FRAMEWORK="nextjs"
  elif grep -q '"react"' package.json; then
    FRAMEWORK="react"
  fi
elif ls *.xcodeproj 2>/dev/null || [[ -f "Package.swift" ]]; then
  FRAMEWORK="swift"
elif [[ -f "requirements.txt" ]]; then
  FRAMEWORK="python"
else
  FRAMEWORK="html"
fi
```

State: "I'll create {FRAMEWORK} mockups for this phase."

## Phase 5: Phase Context

Display phase summary:

```
## Phase {number}: {name}

**Goal:** {phase goal from roadmap}

**Relevant requirements:**
{requirements that involve UI}
```

Ask inline (freeform):
"What UI elements does this phase need? Describe the screens, components, or interactions you're envisioning."

Wait for response.

## Phase 6: Visual References

Ask via AskUserQuestion:
- header: "References"
- question: "Do you have visual references for this specific phase?"
- options:
  - "Yes, images/screenshots" - I'll provide files
  - "Yes, URLs" - I'll share example sites
  - "Both" - Images and URLs
  - "No, use design system" - Work from existing system

**If references provided:**
Analyze and extract:
- Specific component patterns
- Layout approaches
- Interaction patterns

"From your references, I see: [analysis]"

## Phase 7: Component Discovery

Based on user description, identify components needed.

For each component, ask follow-up questions:
- "For the {component}, what states should it have?"
- "What data does it display?"
- "What actions can users take?"

Use 4-then-check pattern:
After ~4 questions, ask:
- header: "More?"
- question: "More questions about {component}, or move on?"
- options:
  - "More questions" - I want to clarify further
  - "Move on" - I've said enough

Continue until all components understood.

## Phase 8: Layout Discussion

Ask about layout:
- "How should these components be arranged?"
- "What's the primary action on this screen?"
- "How does it behave on mobile?"

Probe for:
- Content hierarchy
- Navigation patterns
- Responsive behavior

## Phase 9: Interaction Discussion

For interactive components:
- "What happens when user clicks {action}?"
- "How should loading states look?"
- "What error states are possible?"

Document:
- User flows
- State transitions
- Feedback patterns

## Phase 10: Design Summary

Present design summary:

```
## Design Summary: Phase {number}

### Components
{list with brief specs}

### Layout
{layout description}

### Interactions
{key interactions}

### States
{loading, error, empty states}
```

Ask via AskUserQuestion:
- header: "Ready?"
- question: "Ready to generate mockups?"
- options:
  - "Generate mockups" - Create the visual files
  - "Adjust design" - I want to change something
  - "Add more" - I have more components to discuss

## Phase 11: Generate Mockups

Create phase directory:
```bash
PHASE_DIR=".planning/phases/${PHASE_NUM}-${PHASE_NAME}"
mkdir -p "$PHASE_DIR/mockups"
```

Spawn design specialist agent:

Task(
  prompt="@/usr/lib/node_modules/clawdbot/skills/gsd/agents/design-specialist.md

  <context>
  **Phase:** {phase_number} - {phase_name}
  **Framework:** {detected_framework}
  **Design System:** @.planning/DESIGN-SYSTEM.md

  **Components to create:**
  {component_specs}

  **Layout:**
  {layout_description}

  **States:**
  {state_requirements}
  </context>

  Create mockups in: {PHASE_DIR}/mockups/",
  subagent_type="general-purpose",
  model="sonnet",
  description="Generate phase mockups"
)

## Phase 12: Review Mockups

After mockups generated, present for review:

```
## Mockups Created

{list of files}

### Preview

Run:
{preview command based on framework}
```

Ask via AskUserQuestion:
- header: "Review"
- question: "Review the mockups. What's the verdict?"
- options:
  - "Approved" - These look good, proceed
  - "Iterate" - I want changes
  - "Major revision" - Start fresh on specific components

**If "Iterate":**
Ask what changes needed, update mockups, re-present.

Loop until "Approved".

## Phase 13: Create Design Doc

Generate phase design document:

Write `.planning/phases/{phase}/${PHASE}-DESIGN.md` using template:
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/phase-design.md

Include:
- All component specs
- Layout decisions
- State definitions
- Mockup file references
- Implementation notes

## Phase 14: Present Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DESIGN COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Phase {number}: {name}

**Components designed:** {count}
**Mockups created:** {count}
**Status:** Approved

### Files

| File | Purpose |
|------|---------|
| {PHASE}-DESIGN.md | Design specifications |
{mockup_files}

───────────────────────────────────────────────────────────────

## What's Next

The design is ready for implementation.

Option 1: Plan the phase
  /gsd:plan-phase {phase_number}

Option 2: View mockups
  {preview_command}

Option 3: Edit design
  Open .planning/phases/{phase}/${PHASE}-DESIGN.md

The planner will automatically load {PHASE}-DESIGN.md as context.

───────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] Phase requirements understood
- [ ] Design system loaded (if exists)
- [ ] All UI components identified
- [ ] Component specs complete with states
- [ ] Layout documented
- [ ] Mockups generated in framework-appropriate format
- [ ] User approved mockups
- [ ] {PHASE}-DESIGN.md created
- [ ] User knows next steps
</success_criteria>

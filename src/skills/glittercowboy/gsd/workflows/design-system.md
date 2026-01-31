---
name: gsd:design-system
description: Establish project-wide design foundation through conversation
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
  - AskUserQuestion
---

<objective>
Create a project-wide design system through conversational discovery. This establishes the visual foundation that all UI work in the project respects.

**When to use:**
- Starting a new project with UI
- Before first UI phase
- When visual direction needs definition
- When suggested after /gsd:new-project
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/references/ui-principles.md
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/design-system.md
</execution_context>

<context>
@.planning/DESIGN-SYSTEM.md (if exists)
</context>

<process>

## Phase 1: Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Phase 2: Check Existing

Check if design system exists:

```bash
if [[ -f ".planning/DESIGN-SYSTEM.md" ]]; then
  echo "EXISTS"
else
  echo "NEW"
fi
```

**If exists:**
Ask via AskUserQuestion:
- header: "Existing"
- question: "A design system already exists. What would you like to do?"
- options:
  - "Review and update" - Refine the existing system
  - "Start fresh" - Replace with new design system
  - "Cancel" - Keep current system

If "Cancel" → exit workflow

## Phase 3: Detect Framework

Detect project framework for context:

```bash
if [[ -f "package.json" ]]; then
  if grep -q '"next"' package.json; then
    echo "Next.js (React)"
  elif grep -q '"react"' package.json; then
    echo "React"
  fi
elif ls *.xcodeproj 2>/dev/null || [[ -f "Package.swift" ]]; then
  echo "SwiftUI"
elif [[ -f "requirements.txt" ]]; then
  echo "Python"
else
  echo "HTML/CSS"
fi
```

Store framework for later reference.

## Phase 4: Visual References

Ask via AskUserQuestion:
- header: "References"
- question: "Do you have visual references to guide the design direction?"
- options:
  - "Yes, I have images/screenshots" - I'll provide files or paste images
  - "Yes, I have website URLs" - I'll share sites I like
  - "Both" - I have images and URLs
  - "No, start from description" - I'll describe what I want

**If user provides references:**
- For images: Use Read tool to analyze, extract:
  - Color palette
  - Typography style
  - Spacing patterns
  - Component styles
  - Overall aesthetic

- For URLs: Use WebFetch to analyze, extract:
  - Visual patterns
  - Design language
  - Component approaches

Summarize findings:
"From your references, I see: [summary of extracted aesthetic patterns]"

## Phase 5: Aesthetic Direction

Ask inline (freeform):

"What's the overall vibe you're going for? Describe the feeling you want users to have."

Wait for response.

Then probe with AskUserQuestion:
- header: "Style"
- question: "Which best describes your target aesthetic?"
- options:
  - "Clean & minimal" - Lots of whitespace, subtle, typography-focused
  - "Bold & energetic" - High contrast, strong colors, dynamic
  - "Warm & friendly" - Rounded corners, soft colors, approachable
  - "Dark & sophisticated" - Dark mode primary, elegant, professional

Follow up based on selection to refine.

## Phase 6: Color Exploration

Ask via AskUserQuestion:
- header: "Colors"
- question: "Do you have brand colors, or should we create a palette?"
- options:
  - "I have brand colors" - I'll provide hex values
  - "Create from scratch" - Help me build a palette
  - "Derive from references" - Use colors from my visual references

**If brand colors provided:**
Collect primary, secondary, accent colors.

**If creating from scratch:**
Ask about:
- Preferred hue family (blues, greens, purples, etc.)
- Saturation preference (vibrant vs muted)
- Build complementary palette

**If deriving from references:**
Extract dominant colors from provided images/URLs.

Present proposed palette for approval.

## Phase 7: Typography

Ask via AskUserQuestion:
- header: "Typography"
- question: "Font preference?"
- options:
  - "System fonts" - Native OS fonts (fast, reliable)
  - "Inter / Clean sans" - Modern, highly legible
  - "Custom / I have fonts" - I'll specify fonts
  - "Suggest based on aesthetic" - Match to my chosen style

Build type scale based on selection.

## Phase 8: Component Style

Ask via AskUserQuestion:
- header: "Components"
- question: "Component style preference?"
- options:
  - "Rounded & soft" - Large border radius, gentle shadows
  - "Sharp & precise" - Small or no radius, crisp edges
  - "Mixed" - Rounded buttons, sharp cards (or vice versa)

Determine:
- Border radius scale
- Shadow approach
- Border usage

## Phase 9: Spacing System

Based on aesthetic choices, propose spacing system:

"Based on your [aesthetic] direction, I recommend:
- Base unit: [4px or 8px]
- Scale: [list values]
- Section spacing: [value]"

Ask if adjustments needed.

## Phase 10: Generate Design System

Generate `.planning/DESIGN-SYSTEM.md` using template:
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/design-system.md

Include:
- All discovered aesthetic preferences
- Color palette with tokens
- Typography scale with framework-specific values
- Spacing system
- Component patterns appropriate to detected framework
- Implementation notes for the framework

## Phase 11: Present Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DESIGN SYSTEM CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary

**Aesthetic:** {description}
**Framework:** {framework}
**Primary color:** {primary}

## File Created

`.planning/DESIGN-SYSTEM.md`

───────────────────────────────────────────────────────────────

## What's Next

This design system will be automatically loaded when you:
- Run `/gsd:discuss-design {phase}` for phase-specific UI
- Plan phases with UI components

To view or edit:
```bash
cat .planning/DESIGN-SYSTEM.md
```

───────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] User's aesthetic vision understood
- [ ] Visual references analyzed (if provided)
- [ ] Color palette defined
- [ ] Typography system established
- [ ] Spacing scale determined
- [ ] Component patterns documented
- [ ] DESIGN-SYSTEM.md created
- [ ] User knows how system integrates with GSD
</success_criteria>

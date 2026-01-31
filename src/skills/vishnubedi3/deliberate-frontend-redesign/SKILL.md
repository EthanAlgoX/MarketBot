---
name: deliberate-frontend-redesign
description: >
  Generates a deliberately designed frontend aesthetic that avoids generic UI patterns.
  Use when the user explicitly requests to redesign a frontend by invoking this skill by name.
  Trigger keywords: use deliberate-frontend-redesign, redesign frontend, redesign interface.
---

## Activation Criteria
Activate this skill only when the user explicitly instructs the agent to redesign a frontend and references this skill by name.

Do not activate this skill for:
- General design discussions
- Critiques without a redesign request
- Implementation-only tasks such as writing code or CSS
- Requests for inspiration, trends, or examples

## Execution Steps
1. Identify the provided context for the frontend, including any existing interface description, product type, or constraints.
2. Establish a single, committed aesthetic direction without referencing popular UI styles or industry norms.
3. Define the frontend design across the following dimensions:
   - Typography: select typefaces with strong character and intentional tone, avoiding common UI fonts.
   - Color & Theme: commit to a dominant palette with deliberate contrast and controlled restraint.
   - Layout & Composition: define structure with tension, hierarchy, and asymmetry where appropriate.
   - Backgrounds & Depth: specify atmospheric or structural background treatments that reinforce the aesthetic.
   - Motion or Stillness: declare whether motion is used or avoided, and define its role clearly.
4. Produce the design as a concrete, declarative specification describing visual decisions and their outcomes.
5. Avoid referencing trends, competitors, or familiar product aesthetics.
6. Output the design description directly, without explanation or justification.

## Ambiguity Handling
- If product purpose or audience is unspecified, default to a neutral functional context without branding assumptions.
- If no existing interface is provided, design from a blank slate.
- Do not infer business goals, emotional tone, or user demographics beyond what is explicitly stated.

## Constraints & Non-Goals
- Do not critique or evaluate existing designs unless explicitly included as part of the redesign context.
- Do not propose multiple stylistic options.
- Do not explain design theory or rationale.
- Do not produce code, mockups, or asset files.
- Do not reference prohibited visual patterns, brands, or aesthetic categories.

## Failure Behavior
If the user does not explicitly request a frontend redesign using this skill’s name, or if no visual design can be defined from the provided input, output a minimal statement indicating that activation conditions were not met and terminate without generating a design.

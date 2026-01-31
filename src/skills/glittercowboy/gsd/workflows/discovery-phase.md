---
name: gsd:discovery-phase
description: Execute discovery at the appropriate depth level before planning
argument-hint: "<depth: verify|standard|deep>"
allowed-tools:
  - Read
  - Write
  - Bash
  - WebSearch
  - WebFetch
  - AskUserQuestion
---

<objective>
Execute discovery at the appropriate depth level.
Produces DISCOVERY.md (for Level 2-3) that informs PLAN.md creation.

Called from plan-phase.md's mandatory_discovery step with a depth parameter.

NOTE: For comprehensive ecosystem research ("how do experts build this"), use /gsd:research-phase instead, which produces RESEARCH.md.

**Depth Levels:**

| Level | Name         | Time      | Output                                       | When                                      |
| ----- | ------------ | --------- | -------------------------------------------- | ----------------------------------------- |
| 1     | Quick Verify | 2-5 min   | No file, proceed with verified knowledge     | Single library, confirming current syntax |
| 2     | Standard     | 15-30 min | DISCOVERY.md                                 | Choosing between options, new integration |
| 3     | Deep Dive    | 1+ hour   | Detailed DISCOVERY.md with validation gates  | Architectural decisions, novel problems   |
</objective>

<execution_context>
@/usr/lib/node_modules/clawdbot/skills/gsd/templates/discovery.md
</execution_context>

<context>
**Source Hierarchy - MANDATORY: Context7 BEFORE WebSearch**

Claude's training data is 6-18 months stale. Always verify.

1. **Context7 MCP FIRST** - Current docs, no hallucination
2. **Official docs** - When Context7 lacks coverage
3. **WebSearch LAST** - For comparisons and trends only

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>

## Phase 1: Determine Depth

Check the depth parameter passed from plan-phase.md:
- `depth=verify` → Level 1 (Quick Verification)
- `depth=standard` → Level 2 (Standard Discovery)
- `depth=deep` → Level 3 (Deep Dive)

Route to appropriate level workflow below.

## Phase 2a: Level 1 Quick Verify (2-5 minutes)

For: Single known library, confirming syntax/version still correct.

**Process:**

1. Resolve library in Context7:

   ```
   mcp__context7__resolve-library-id with libraryName: "[library]"
   ```

2. Fetch relevant docs:

   ```
   mcp__context7__get-library-docs with:
   - context7CompatibleLibraryID: [from step 1]
   - topic: [specific concern]
   ```

3. Verify:

   - Current version matches expectations
   - API syntax unchanged
   - No breaking changes in recent versions

4. **If verified:** Return to plan-phase.md with confirmation. No DISCOVERY.md needed.

5. **If concerns found:** Escalate to Level 2.

**Output:** Verbal confirmation to proceed, or escalation to Level 2.

## Phase 2b: Level 2 Standard (15-30 minutes)

For: Choosing between options, new external integration.

**Process:**

1. **Identify what to discover:**

   - What options exist?
   - What are the key comparison criteria?
   - What's our specific use case?

2. **Context7 for each option:**

   ```
   For each library/framework:
   - mcp__context7__resolve-library-id
   - mcp__context7__get-library-docs (mode: "code" for API, "info" for concepts)
   ```

3. **Official docs** for anything Context7 lacks.

4. **WebSearch** for comparisons:

   - "[option A] vs [option B] {current_year}"
   - "[option] known issues"
   - "[option] with [our stack]"

5. **Cross-verify:** Any WebSearch finding → confirm with Context7/official docs.

6. **Create DISCOVERY.md** using template structure:

   - Summary with recommendation
   - Key findings per option
   - Code examples from Context7
   - Confidence level (should be MEDIUM-HIGH for Level 2)

7. Return to plan-phase.md.

**Output:** `.planning/phases/XX-name/DISCOVERY.md`

## Phase 2c: Level 3 Deep Dive (1+ hour)

For: Architectural decisions, novel problems, high-risk choices.

**Process:**

1. **Scope the discovery** using template:

   - Define clear scope
   - Define include/exclude boundaries
   - List specific questions to answer

2. **Exhaustive Context7 research:**

   - All relevant libraries
   - Related patterns and concepts
   - Multiple topics per library if needed

3. **Official documentation deep read:**

   - Architecture guides
   - Best practices sections
   - Migration/upgrade guides
   - Known limitations

4. **WebSearch for ecosystem context:**

   - How others solved similar problems
   - Production experiences
   - Gotchas and anti-patterns
   - Recent changes/announcements

5. **Cross-verify ALL findings:**

   - Every WebSearch claim → verify with authoritative source
   - Mark what's verified vs assumed
   - Flag contradictions

6. **Create comprehensive DISCOVERY.md:**

   - Full structure from template
   - Quality report with source attribution
   - Confidence by finding
   - If LOW confidence on any critical finding → add validation checkpoints

7. **Confidence gate:** If overall confidence is LOW, present options before proceeding.

8. Return to plan-phase.md.

**Output:** `.planning/phases/XX-name/DISCOVERY.md` (comprehensive)

## Phase 3: Identify Unknowns

**For Level 2-3:** Define what we need to learn.

Ask: What do we need to learn before we can plan this phase?

- Technology choices?
- Best practices?
- API patterns?
- Architecture approach?

## Phase 4: Create Discovery Scope

Use template structure.

Include:

- Clear discovery objective
- Scoped include/exclude lists
- Source preferences (official docs, Context7, current year)
- Output structure for DISCOVERY.md

## Phase 5: Execute Discovery

Run the discovery:
- Use web search for current info
- Use Context7 MCP for library docs
- Prefer current year sources
- Structure findings per template

## Phase 6: Create Discovery Output

Write `.planning/phases/XX-name/DISCOVERY.md`:
- Summary with recommendation
- Key findings with sources
- Code examples if applicable
- Metadata (confidence, dependencies, open questions, assumptions)

## Phase 7: Confidence Gate

After creating DISCOVERY.md, check confidence level.

If confidence is LOW:
Use AskUserQuestion:

- header: "Low Confidence"
- question: "Discovery confidence is LOW: [reason]. How would you like to proceed?"
- options:
  - "Dig deeper" - Do more research before planning
  - "Proceed anyway" - Accept uncertainty, plan with caveats
  - "Pause" - I need to think about this

If confidence is MEDIUM:
Inline: "Discovery complete (medium confidence). [brief reason]. Proceed to planning?"

If confidence is HIGH:
Proceed directly, just note: "Discovery complete (high confidence)."

## Phase 8: Open Questions Gate

If DISCOVERY.md has open_questions:

Present them inline:
"Open questions from discovery:

- [Question 1]
- [Question 2]

These may affect implementation. Acknowledge and proceed? (yes / address first)"

If "address first": Gather user input on questions, update discovery.

## Phase 9: Offer Next

```
Discovery complete: .planning/phases/XX-name/DISCOVERY.md
Recommendation: [one-liner]
Confidence: [level]

What's next?

1. Discuss phase context (/gsd:discuss-phase [current-phase])
2. Create phase plan (/gsd:plan-phase [current-phase])
3. Refine discovery (dig deeper)
4. Review discovery
```

NOTE: DISCOVERY.md is NOT committed separately. It will be committed with phase completion.

</process>

<success_criteria>
**Level 1 (Quick Verify):**
- [ ] Context7 consulted for library/topic
- [ ] Current state verified or concerns escalated
- [ ] Verbal confirmation to proceed (no files)

**Level 2 (Standard):**
- [ ] Context7 consulted for all options
- [ ] WebSearch findings cross-verified
- [ ] DISCOVERY.md created with recommendation
- [ ] Confidence level MEDIUM or higher
- [ ] Ready to inform PLAN.md creation

**Level 3 (Deep Dive):**
- [ ] Discovery scope defined
- [ ] Context7 exhaustively consulted
- [ ] All WebSearch findings verified against authoritative sources
- [ ] DISCOVERY.md created with comprehensive analysis
- [ ] Quality report with source attribution
- [ ] If LOW confidence findings → validation checkpoints defined
- [ ] Confidence gate passed
- [ ] Ready to inform PLAN.md creation
</success_criteria>

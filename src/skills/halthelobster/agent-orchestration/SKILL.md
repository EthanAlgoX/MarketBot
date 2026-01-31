---
name: agent-orchestration
version: 2.0.0
description: "Master the art of spawning and managing sub-agents. Write prompts that actually work, track running agents, and learn from every outcome. Part of the Hal Stack 🦞"
author: halthelobster
---

# Agent Orchestration 🦞

**By Hal Labs** — Part of the Hal Stack

Your agents fail because your prompts suck. This skill fixes that.

---

## The Core Problem

You're not prompting. **You're praying.**

Most prompts are wishes tossed into the void:

```
❌ "Research the best vector databases and write a report"
```

You type something reasonable. The output is mid. You rephrase. Still mid. You add keywords. Somehow worse. You blame the model.

Here's what you don't understand: **A language model is a pattern-completion engine.** It generates the most statistically probable output given your input.

Vague input → generic output. Not because the model is dumb. Because generic is what's most probable when you give it nothing specific to work with.

**The model honored exactly what you asked for. You just didn't realize how little you gave it.**

---

## The Core Reframe

A prompt is not a request. **A prompt is a contract.**

Every contract must answer four non-negotiables:

| Element | Question |
|---------|----------|
| **Role** | Who is the model role-playing as? |
| **Task** | What exactly must it accomplish? |
| **Constraints** | What rules must be followed? |
| **Output** | What does "done" look like? |

Miss one, the model fills the gap with assumptions. Assumptions are where hallucinations are born.

---

## The 5-Layer Architecture

Effective prompts share a specific structure. This maps to how models actually process information.

### Layer 1: Identity

Who is the model in this conversation?

Not "helpful assistant" but a specific role with specific expertise:

```markdown
You are a senior product marketer who specializes in B2B SaaS positioning.
You have 15 years of experience converting technical features into emotional benefits.
You write in short sentences. You never use jargon without explaining it.
```

The model doesn't "become" this identity—it accesses different clusters of training data, different stylistic patterns, different reasoning approaches.

**Identity matters.** Miss this and you get generic output.

### Layer 2: Context

What does the model need to know to do this task exceptionally well?

Context must be:
- **Ordered** — Most important first
- **Scoped** — Only what's relevant
- **Labeled** — What's rules vs. editable vs. historical

```markdown
## Context

### Rules (never change)
- Design system: Tailwind, shadcn components
- Voice: Professional but warm, never corporate

### Current State (may evolve)
- Landing page exists at /landing
- Using Next.js 14 with App Router

### Historical (for reference)
- Originally built with Create React App, migrated Jan 2025
```

**Without labels, the model treats everything as equally optional.** Then it rewrites your core logic halfway through.

### Layer 3: Task

What specific action must be taken?

Not "write something about X" but precise instructions:

```markdown
## Task
Produce a 500-word product description that:
- Emphasizes time-saving benefits for busy executives
- Opens with the primary pain point
- Includes 3 specific use cases
- Ends with a clear call to action
```

The more precisely you define the task, the more precisely the model executes.

### Layer 4: Process ⚡

**This is where most prompts fail.**

You're asking for output. You should be asking for **how the output is formed.**

❌ Bad:
```
Write me a marketing page.
```

✅ Good:
```markdown
## Process
1. First, analyze the target audience and identify their primary pain points
2. Then, define the positioning that addresses those pain points
3. Then, write the page
4. Show your reasoning at each step
5. Do not skip steps
6. Audit your work before reporting done
```

**You don't want answers. You want how the answer is formed.**

Think like a director. You're not asking for a scene—you're directing how the scene gets built.

### Layer 5: Output

What does "done" actually look like?

If you don't specify, you get whatever format the model defaults to.

```markdown
## Output Format
Return a JSON object with:
- `headline`: string (max 60 chars)
- `subheadline`: string (max 120 chars)  
- `body`: string (markdown formatted)
- `cta`: string (action verb + benefit)

Do not include explanations, notes, or commentary. Only the JSON.
```

**Miss one layer, the structure wobbles. Miss two, it collapses.**

---

## Model Selection

**Prompt portability is a myth.**

Different models are different specialists. You wouldn't give identical instructions to your exec assistant, designer, and backend dev.

| Model Type | Best For | Watch Out For |
|------------|----------|---------------|
| Claude Opus | Complex reasoning, nuanced writing, long context | Expensive, can be verbose |
| Claude Sonnet | Balanced tasks, code, analysis | Less creative than Opus |
| GPT-4 | Broad knowledge, structured output | Can be sycophantic |
| Smaller models | Quick tasks, simple queries | Limited reasoning depth |

**Adapt your prompts per model:**
- Some prefer structured natural language
- Some need explicit step sequencing
- Some collapse under verbose prompts
- Some ignore constraints unless repeated
- Some excel at analysis but suck at creativity

**The person who writes model-specific prompts will outperform the person with "better ideas" every time.**

---

## Constraints Are Instructions

Vagueness isn't flexibility. **It's cowardice.**

You hedge because being specific feels risky. But the model doesn't read your mind.

**Constraints are not limitations. Constraints are instructions.**

```markdown
## Constraints
- Never alter the existing design system
- Always maintain the established voice/tone
- Never change the data model without explicit approval
- Max 3 API calls per operation
- If unsure, ask rather than assume
```

Every conversation starts at zero. The model doesn't have accumulated context from working with you. **Consistency comes from instruction, not memory.**

---

## Canonical Documentation

If you don't have docs, you're gambling.

| Document | Purpose |
|----------|---------|
| PRD | What we're building and why |
| Design System | Visual rules and components |
| Constraints Doc | What must never change |
| Context Doc | Current state and history |

**The rule:** Reference docs in your prompts.

```markdown
The attached PRD is the source of truth. Do not contradict it.
The design system in /docs/design.md must be followed exactly.
```

Without explicit anchoring, the model assumes everything is mutable—including your core decisions.

> "Good prompting isn't writing better sentences. It's anchoring the model to reality."

---

## The Complete Template

```markdown
## Identity
You are a [specific role] with [specific expertise].
[Behavioral traits and style]

## Context

### Rules (never change)
- [Constraint 1]
- [Constraint 2]

### Current State
- [Relevant background]

### Reference Docs
- [Doc 1]: [what it contains]
- [Doc 2]: [what it contains]

## Task
[Specific, measurable objective]

## Process
1. First, [analysis step]
2. Then, [planning step]
3. Then, [execution step]
4. Finally, [verification step]

Show your reasoning at each step.

## User Stories
1. As [user], I want [goal], so that [benefit]
2. As [user], I want [goal], so that [benefit]

## Output Format
[Exact specification of deliverable]

## Constraints
- [Limit 1]
- [Limit 2]
- [What NOT to do]

## Error Handling
- If [situation]: [action]
- If blocked: [escalation]

## Before Reporting Done
1. Review each user story
2. Verify the output satisfies it
3. If not, iterate until it does
4. Only then report complete
```

---

## Ralph Mode

For complex tasks where first attempts often fail:

```markdown
## Mode: Ralph
Keep trying until it works. Don't give up on first failure.

If something breaks:
1. Debug and understand why
2. Try a different approach  
3. Research how others solved similar problems
4. Iterate until user stories are satisfied

You have [N] attempts before escalating.
```

**When to use:**
- Build tasks with multiple components
- Integration work
- Anything where first-try success is unlikely

---

## Agent Tracking

**Every spawned agent gets tracked. No orphans.**

Maintain `notes/areas/active-agents.md`:

```markdown
## Currently Running

| Label | Task | Spawned | Expected | Status |
|-------|------|---------|----------|--------|
| research-x | Competitor analysis | 9:00 AM | 15m | 🏃 Running |

## Completed Today

| Label | Task | Runtime | Result |
|-------|------|---------|--------|
| builder-v2 | Dashboard update | 8m | ✅ Complete |
```

**Heartbeat check:**
```
1. Run sessions_list --activeMinutes 120
2. Compare to tracking file
3. Investigate any missing/stalled agents
4. Log completions to LEARNINGS.md
```

---

## The Learnings Loop

Every agent outcome is data. Capture it.

Maintain `LEARNINGS.md`:

```markdown
## What Works
- User stories + acceptance loop
- Ralph mode for complex builds
- Explicit output formats
- Process layer with reasoning steps

## What Doesn't Work
- Lazy task dumps
- Missing success criteria
- No scope limits
- Vague constraints

## Experiment Log
### [Date]: [Agent Label]
**Approach:** [What you tried]
**Outcome:** [What happened]  
**Lesson:** [What you learned]
```

---

## Role Library

Build reusable role definitions:

```markdown
# Role Library

## Research Analyst
You are a senior research analyst with 10 years experience in technology markets.
You are thorough but efficient. You cite sources. You distinguish fact from speculation.
You present findings in structured formats with clear recommendations.

## Technical Writer  
You are a technical writer who specializes in developer documentation.
You write clearly and concisely. You use examples liberally.
You assume the reader is smart but unfamiliar with this specific system.

## Code Reviewer
You are a senior engineer conducting code review.
You focus on correctness, maintainability, and security.
You explain your reasoning. You suggest specific improvements, not vague feedback.
```

---

## Quick Reference

### The 4 Non-Negotiables
1. **Role** — Who is the model?
2. **Task** — What must it do?
3. **Constraints** — What rules apply?
4. **Output** — What does done look like?

### The 5 Layers
1. **Identity** — Specific role and expertise
2. **Context** — Ordered, scoped, labeled
3. **Task** — Precise objective
4. **Process** — How to approach (most overlooked!)
5. **Output** — Exact format specification

### Pre-Spawn Checklist
- [ ] Identity assigned?
- [ ] Context labeled (rules/state/history)?
- [ ] Task specific and measurable?
- [ ] Process described (not just output)?
- [ ] User stories defined?
- [ ] Output format specified?
- [ ] Constraints explicit?
- [ ] Error handling included?
- [ ] Added to tracking file?

---

## The Final Truth

The gap between "AI doesn't work for me" and exceptional results isn't intelligence or access.

**One group treats prompting as conversation. The other treats it as engineering a system command.**

The model matches your level of rigor.

- Vague inputs → generic outputs
- Structured inputs → structured outputs  
- Clear thinking → clear results

You don't need to be smarter. You need to be clearer.

**Clarity is a system, not a talent.**

---

*Part of the Hal Stack 🦞*

---

**Got a skill idea?** Email: halthelobster@protonmail.com

---

*"You're not prompting, you're praying. Start engineering."*

---
name: gsd:new-project-full
description: Initialize a new project with deep context gathering and PROJECT.md (extended version)
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>

Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

This is the most leveraged moment in any project. Deep questioning here means better plans, better execution, better outcomes. One command takes you from idea to ready-for-planning.

**Creates:**
- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

**After this command:** Run `/gsd plan-phase 1` to start execution.

</objective>

<execution_context>

Need to port:
- references/questioning.md
- references/ui-brand.md
- templates/project.md
- templates/requirements.md

</execution_context>

<process>

[Full workflow from original - to be continued in next message due to length]

</process>

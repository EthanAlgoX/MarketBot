---
name: gsd
description: Get Shit Done - Full project planning and execution workflow. Handles project initialization with deep context gathering, automated research, roadmap creation, phase planning, and execution with verification.
user-invocable: true
---

<objective>
GSD (Get Shit Done) provides a complete workflow for taking projects from idea to execution through systematic planning, research, and phase-based development.

**Full workflow port from Claude Code** - Includes:
- Deep questioning and context gathering
- Automated domain research (4 parallel researchers)
- Requirements definition and scoping
- Roadmap creation with phase structure
- Phase planning with research and verification
- Wave-based parallel execution
- Goal-backward verification

This is the complete GSD system, not a simplified version.
</objective>

<intake>
What would you like to do?

**Core workflow commands:**
- **new-project** - Initialize a new project with deep context gathering, research, requirements, and roadmap
- **plan-phase [N]** - Create execution plans for a phase (with optional research)
- **execute-phase [N]** - Execute all plans in a phase with wave-based parallelization
- **progress** - Check project status and intelligently route to next action
- **debug [issue]** - Systematic debugging with persistent state across context resets
- **quick** - Execute ad-hoc tasks with GSD guarantees but skip optional agents
- **discuss-phase [N]** - Gather context through adaptive questioning before planning
- **verify-work [N]** - Validate built features through conversational UAT
- **map-codebase** - Analyze existing codebase for brownfield projects
- **pause-work** - Create handoff when pausing mid-phase
- **resume-work** - Resume from previous session with full context
- **add-todo [desc]** - Capture idea or task for later
- **check-todos [area]** - List and work on pending todos
- **add-phase <desc>** - Add phase to end of milestone
- **insert-phase <after> <desc>** - Insert urgent decimal phase
- **remove-phase <N>** - Remove future phase and renumber
- **new-milestone [name]** - Start new milestone cycle
- **complete-milestone <ver>** - Archive milestone and tag
- **audit-milestone [ver]** - Verify milestone completion
- **settings** - Configure workflow toggles and model profile

**Flags:**
- `plan-phase [N] --research` - Force re-research before planning
- `plan-phase [N] --skip-research` - Skip research, plan directly
- `plan-phase [N] --gaps` - Gap closure mode (after verification finds issues)
- `plan-phase [N] --skip-verify` - Skip plan verification loop
- `execute-phase [N] --gaps-only` - Execute only gap closure plans

**Usage:**
- `/gsd new-project` - Start a new project
- `/gsd plan-phase 1` - Plan phase 1
- `/gsd execute-phase 1` - Execute phase 1
- `/gsd progress` - Check where you are and what's next
- `/gsd debug "button doesn't work"` - Start debugging session
- `/gsd quick` - Quick ad-hoc task without full ceremony
- Or just tell me what you want and I'll guide you through GSD

**What GSD does:**
1. **Deep questioning** - Understand what you're building through conversation
2. **Research** - 4 parallel researchers investigate domain (stack, features, architecture, pitfalls)
3. **Requirements** - Define v1 scope through feature selection
4. **Roadmap** - Derive phases from requirements (not imposed structure)
5. **Phase planning** - Create executable plans with tasks, dependencies, verification
6. **Execution** - Run plans in parallel waves with per-task commits
7. **Verification** - Check must_haves against actual codebase
</intake>

<routing>
Based on user input, route to appropriate workflow:

| Intent | Workflow |
|--------|----------|
| "new project", "initialize", "start project" | workflows/new-project.md |
| "new-project" (explicit) | workflows/new-project.md |
| "plan phase", "plan-phase", "create plan" | workflows/plan-phase.md |
| "execute phase", "execute-phase", "start work" | workflows/execute-phase.md |
| "progress", "status", "where am I" | workflows/progress.md |
| "debug", "investigate", "bug", "issue" | workflows/debug.md |
| "quick", "quick task", "ad-hoc" | workflows/quick.md |
| "discuss phase", "discuss-phase", "context" | workflows/discuss-phase.md |
| "verify", "verify-work", "UAT", "test" | workflows/verify-work.md |
| "map codebase", "map-codebase", "analyze code" | workflows/map-codebase.md |
| "pause", "pause-work", "stop work" | workflows/pause-work.md |
| "resume", "resume-work", "continue" | workflows/resume-work.md |
| "add todo", "add-todo", "capture" | workflows/add-todo.md |
| "check todos", "check-todos", "todos", "list todos" | workflows/check-todos.md |
| "add phase", "add-phase" | workflows/add-phase.md |
| "insert phase", "insert-phase", "urgent phase" | workflows/insert-phase.md |
| "remove phase", "remove-phase", "delete phase" | workflows/remove-phase.md |
| "new milestone", "new-milestone", "next milestone" | workflows/new-milestone.md |
| "complete milestone", "complete-milestone", "archive" | workflows/complete-milestone.md |
| "audit milestone", "audit-milestone", "audit" | workflows/audit-milestone.md |
| "settings", "config", "configure" | workflows/settings.md |

</routing>

<architecture>
## Workflow Files

Located in `workflows/`:
- **new-project.md** - Full project initialization workflow
- **plan-phase.md** - Phase planning with research and verification
- **execute-phase.md** - Wave-based execution orchestrator
- **progress.md** - Status check and intelligent routing to next action
- **debug.md** - Systematic debugging with persistent state
- **quick.md** - Ad-hoc tasks with GSD guarantees, skip optional agents
- **discuss-phase.md** - Gather context through adaptive questioning
- **verify-work.md** - Conversational UAT to validate built features
- **map-codebase.md** - Parallel codebase analysis for brownfield projects
- **pause-work.md** - Create handoff when pausing mid-phase
- **resume-work.md** - Resume with full context restoration
- **add-todo.md** - Capture ideas/tasks for later
- **check-todos.md** - List and work on pending todos
- **add-phase.md** - Add phase to end of milestone
- **insert-phase.md** - Insert urgent decimal phase
- **remove-phase.md** - Remove future phase and renumber
- **new-milestone.md** - Start new milestone cycle
- **complete-milestone.md** - Archive milestone and tag
- **audit-milestone.md** - Verify milestone completion
- **settings.md** - Configure workflow toggles

## Agent Files

Located in `agents/`:
- **gsd-project-researcher.md** - Research domain ecosystem (stack, features, architecture, pitfalls)
- **gsd-phase-researcher.md** - Research how to implement a specific phase
- **gsd-research-synthesizer.md** - Synthesize parallel research into cohesive SUMMARY.md
- **gsd-roadmapper.md** - Create roadmap from requirements and research
- **gsd-planner.md** - Create detailed execution plans for a phase
- **gsd-plan-checker.md** - Verify plans will achieve phase goal before execution
- **gsd-executor.md** - Execute a single plan with task-by-task commits
- **gsd-verifier.md** - Verify phase goal achieved by checking must_haves against codebase
- **gsd-debugger.md** - Investigate bugs using scientific method with persistent state
- **gsd-codebase-mapper.md** - Analyze existing codebase for brownfield projects
- **gsd-integration-checker.md** - Verify cross-phase integration and E2E flows

## Reference Files

Located in `references/`:
- **questioning.md** - Deep questioning techniques and context checklist
- **ui-brand.md** - UI/UX principles and brand guidelines

## Templates

Located in `templates/`:
- **project.md** - PROJECT.md template
- **requirements.md** - REQUIREMENTS.md template
- **research-project/** - Research output templates (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)

## Workflow Pattern

GSD uses orchestrator + subagent pattern:
1. **Orchestrator** (workflow) - Stays in main context, spawns subagents, routes flow
2. **Subagents** (agents) - Fresh context, focused task, return structured result
3. **Iteration** - Verification loops (planner → checker → planner) until quality gates pass

This allows:
- Lean orchestrator context (~15%)
- Fresh context per subagent (100%)
- Parallel execution (4 researchers, multiple plans in wave)
- Verification before wasting execution time
</architecture>

<success_criteria>
- User can initialize new projects via `/gsd new-project`
- Full workflow executes: questioning → research → requirements → roadmap
- Phase planning includes research and verification loop
- Phase execution uses wave-based parallelization
- Verification checks must_haves against actual code
- `.planning/` directory structure created with all artifacts
- Clear next steps provided at each stage
</success_criteria>

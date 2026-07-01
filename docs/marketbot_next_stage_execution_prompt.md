# Next Stage Execution Prompt

Use Nano BOT as the reference architecture and continue the MarketBot refactor until the finance-focused agent has a clear separation between generic agent execution and market-domain orchestration.

## Mission

Refactor MarketBot so the low-level ReAct/tool loop is represented by an explicit runner contract, while MarketBot-specific behavior remains in the turn orchestrator and market domain layers.

MarketBot must stay CLI-first in this stage. Improve `marketbot agent`, `marketbot gateway`,
and CLI/admin command reliability before introducing any Web dashboard, desktop client, or
full TUI surface.

## Required Outcomes

- Introduce an explicit `AgentRunSpec` / `AgentRunResult` / runner abstraction for MarketBot.
- Keep `AgentLoop` as a transport/session facade, not the owner of the execution-loop contract.
- Keep `MarketTurnOrchestrator` as the finance-domain turn pipeline.
- Keep compatibility wrappers for existing tests and CLI/channel integrations.
- Add tests for the new runner contract and for executor integration.
- Validate with targeted pytest suites and Python compile checks.
- Add or preserve CLI smoke coverage for commands that do not require external credentials.

## Architectural Guardrails

- Do not rewrite the market domain data tools unless needed for the runner boundary.
- Do not expand the product surface beyond CLI/gateway/chat delivery in this stage.
- Do not remove existing compatibility methods until tests and callers are migrated.
- Prefer typed result objects over raw tuples at new boundaries.
- Preserve current behavior for direct publish fallbacks, planned tasks, skill fallback, explainability metadata, and session persistence.
- Keep user-facing investment policy in prompt/tool contract/domain layers, not inside the generic runner.

## Completion Criteria

- The code has a reusable generic runner boundary.
- User and system turns go through `MarketTurnOrchestrator`.
- `AgentExecutor` and legacy `_run_agent_loop` compatibility both delegate through the runner.
- Targeted tests pass.
- Remaining full-suite blockers are documented if external dependencies prevent execution.

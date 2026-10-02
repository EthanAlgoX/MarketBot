# MarketBot Architecture Refactor

MarketBot is a finance-focused agent. Its model/tool runner handles generic execution, while orchestration, hooks, context, skills, and financial domain services implement product behavior.

## Target Shape

MarketBot remains CLI-first for this refactor cycle. `marketbot agent` is the primary
interactive product surface, `marketbot gateway` is the long-running delivery surface
for chat channels and scheduled jobs, and no Web dashboard, desktop client, or full TUI
surface is in scope.

```mermaid
flowchart TD
    A["Inbound message"] --> B["AgentLoop dispatch and session lock"]
    B --> C["MessageProcessor prepares history and prompt"]
    C --> D["MarketTurnOrchestrator"]
    D --> E{"Route mode"}
    E -->|direct_react| F["AgentExecutor / tool_runtime"]
    E -->|planned_task| G["PlanRuntime"]
    F --> H["Skill fallback policy"]
    G --> H
    H --> I["Market response finalization"]
    I --> J["Explainability, saved reports, metadata"]
    J --> K["Session persistence"]
    K --> L["Outbound message"]
```

## Layer Responsibilities

- `AgentLoop`: transport-facing runtime. It owns bus consumption, per-session locking, stop/cancel behavior, MCP/tool registration, and compatibility methods.
- `MessageProcessor`: turn preparation. It owns slash commands, history windows, memory consolidation scheduling, and prompt construction.
- `MarketTurnOrchestrator`: MarketBot's domain-aware turn kernel. It owns route execution, planned-task dispatch, skill fallback, daily-opportunity normalization, response finalization, metadata, and persistence.
- `AgentExecutor` and `tool_runtime`: generic ReAct/tool execution. These should stay product-agnostic so execution improvements remain separate from market policy.
- `ContextBuilder` and skills: financial analysis guidance, runtime metadata, market skill routing, and tool-contract loading.
- `marketbot.domain.market`: market capability plugins, source routing, and financial data semantics.

## Product Surface

- `marketbot agent`: primary local CLI interaction for ad hoc financial analysis.
- `marketbot gateway`: channel, cron, heartbeat, and outbound delivery runtime.
- `marketbot status`, `marketbot intel`, `marketbot skills`, and related subcommands: operator/admin surfaces.
- Chat integrations: delivery and conversation endpoints behind the gateway, not separate products.
- Web dashboard, desktop client, and full-screen TUI: explicitly deferred until the CLI product is stable.

## Execution Design Principles

- Keep the low-level runner generic and reusable.
- Keep turn lifecycle state explicit instead of scattering it across helper functions.
- Treat runtime context as metadata, with clear boundaries.
- Make tool contracts stable prompt assets, not ad hoc instructions.
- Preserve product-specific policy in a separate orchestration layer.

## MarketBot-Specific Policy

- Live market analysis must prefer fresh market-tool evidence over memory or old chat context.
- Broad opportunity scans should not silently use saved holdings or watchlists.
- Final investment outputs should separate facts, assumptions, confidence, risks, suggested action, and invalidation.
- Provider/API failures are operational details and should stay out of user-facing investment analysis unless debugging is requested.
- Skill fallback and data reliability metadata should remain visible to downstream reporting and chat integrations.

## Next Refactor Targets

- Move the existing runner facade's remaining product-specific policies into domain hooks; its structured result object is already present, but the low-level tool runtime still contains request policies.
- Move request policy constants into declarative profiles keyed by route type.
- Add a first-class market evidence bundle so reports can cite which tools produced each fact.
- Introduce typed turn state for active route, selected skills, fallback, data reliability, and report artifacts.

## 2026-10-03 Finance Update

MarketBot now has finance defaults,
a reusable read-only finance MCP surface, and a deterministic `portfolio_risk`
domain calculation. The generic execution paths enforce an empty tool scope as
deny-all and pass earlier plan evidence to subsequent steps. Financial task
plans prioritize domain tools over the generic file/browser catalog.

Current product scope, concrete gaps and comparable open-source mechanisms are
documented in [the financial agent direction](marketbot_financial_agent_direction.md).

"""Generic agent execution runner for MarketBot.

The runner is intentionally product-agnostic: it owns the execution-loop
contract and delegates market-specific policy to the loop/tool runtime that
already contains those hooks. Product orchestration lives in
``turn_orchestrator``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from marketbot.agent import tool_runtime


@dataclass(slots=True)
class AgentRunSpec:
    """Configuration for one tool-capable agent execution."""

    initial_messages: list[dict[str, Any]]
    on_progress: Callable[..., Awaitable[None]] | None = None


@dataclass(slots=True)
class AgentRunResult:
    """Structured result from one agent execution."""

    final_content: str | None
    tools_used: list[str] = field(default_factory=list)
    messages: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    stop_reason: str = "completed"
    error: str | None = None

    def as_legacy_tuple(self) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        """Return the historical tuple shape used by older MarketBot call sites."""
        return self.final_content, self.tools_used, self.messages, self.usage


class MarketAgentRunner:
    """Run MarketBot's low-level ReAct/tool loop behind a typed contract."""

    def __init__(self, loop: Any):
        self.loop = loop

    async def run(self, spec: AgentRunSpec) -> AgentRunResult:
        """Execute a run spec and return a structured result."""
        final_content, tools_used, messages, usage = await tool_runtime.run_agent_loop(
            self.loop,
            spec.initial_messages,
            on_progress=spec.on_progress,
        )
        return AgentRunResult(
            final_content=final_content,
            tools_used=tools_used or [],
            messages=messages,
            usage=usage or {},
        )

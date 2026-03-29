"""Execution helpers that scope the existing ReAct loop."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Awaitable, Callable

from marketbot.agent.plan_models import StepResult


def classify_execution_outcome(
    *,
    final_content: str | None,
    messages: list[dict[str, Any]],
    tools_used: list[str],
) -> str:
    """Infer a coarse execution outcome from output and tool-result health."""
    content = str(final_content or "").strip().lower()
    if not content:
        return "failure"
    if "maximum number of tool call iterations" in content or "encountered an error calling the ai model" in content:
        return "failure"

    tool_results = [
        str(item.get("content") or "")
        for item in messages
        if isinstance(item, dict) and str(item.get("role") or "") == "tool"
    ]
    if not tool_results:
        return "success"

    def _has_error(result: str) -> bool:
        text = str(result or "").strip()
        if not text:
            return False
        if text.startswith("Error"):
            return True
        if text.startswith("{") or text.startswith("["):
            try:
                import json

                payload = json.loads(text)
            except Exception:
                return False
            if isinstance(payload, dict) and payload.get("error"):
                return True
        return False

    error_count = sum(1 for result in tool_results if _has_error(result))
    if error_count == 0:
        return "success"
    if error_count >= len(tool_results):
        return "failure"
    if not tools_used and error_count:
        return "failure"
    return "partial"


class AgentExecutor:
    """Thin wrapper around the existing loop runtime with tool scoping hooks."""

    def __init__(self, loop: Any):
        self.loop = loop

    @contextmanager
    def _tool_scope(self, allowed_tools: set[str] | None):
        previous = getattr(self.loop, "_active_allowed_tools", None)
        self.loop._active_allowed_tools = set(allowed_tools) if allowed_tools else None
        try:
            yield
        finally:
            self.loop._active_allowed_tools = previous

    async def execute_messages(
        self,
        messages: list[dict[str, Any]],
        *,
        on_progress: Callable[..., Awaitable[None]] | None = None,
        allowed_tools: set[str] | None = None,
    ) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        """Execute one round of messages, optionally restricting exposed tools."""
        with self._tool_scope(allowed_tools):
            return await self.loop._run_agent_loop(messages, on_progress=on_progress)

    async def execute_step(
        self,
        *,
        session: Any,
        step: Any,
        channel: str,
        chat_id: str,
        history: list[dict[str, Any]],
        on_progress: Callable[..., Awaitable[None]] | None = None,
    ) -> StepResult:
        """Execute one plan step with a scoped tool whitelist."""
        scoped_instruction = (
            f"Current step: {step.title}\n\n"
            f"Instruction: {step.instruction}\n\n"
            f"Success criteria: {step.success_criteria}\n\n"
            f"Allowed tools for this step: {', '.join(step.allowed_tools) if step.allowed_tools else '(none)'}"
        )
        messages = self.loop.processor.build_messages(
            session=session,
            current_message=scoped_instruction,
            channel=channel,
            chat_id=chat_id,
        )
        final_content, tools_used, all_msgs, usage = await self.execute_messages(
            messages,
            on_progress=on_progress,
            allowed_tools=set(step.allowed_tools),
        )
        outcome = classify_execution_outcome(
            final_content=final_content,
            messages=all_msgs,
            tools_used=tools_used,
        )
        status = "completed" if outcome == "success" else ("partial" if outcome == "partial" else "failed")
        return StepResult(
            step_id=step.id,
            status=status,
            summary=final_content or "",
            raw_output=final_content or "",
            tool_calls=tools_used,
            needs_replan=(outcome == "failure" and not tools_used and bool(step.allowed_tools)),
            messages=all_msgs,
            usage=usage or {},
        )

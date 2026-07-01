"""Domain-aware turn orchestration for MarketBot.

This module is the product-layer execution pipeline: it keeps market routing,
planning, skill fallback, response finalization, and persistence in one place,
while the low-level ReAct/tool loop stays behind ``AgentExecutor`` and
``tool_runtime``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.session.manager import Session


@dataclass(slots=True)
class TurnExecutionRequest:
    """Inputs needed to execute one already-prepared MarketBot turn."""

    msg: InboundMessage
    session: Session
    history: list[dict[str, Any]]
    initial_messages: list[dict[str, Any]]
    channel: str
    chat_id: str
    request_text: str
    default_route_mode: str
    append_inline_explainability: bool
    empty_fallback: str | None = None
    media: list[str] | None = None
    normalize_daily_report: bool = False
    on_progress: Callable[[str], Awaitable[None]] | None = None


@dataclass(slots=True)
class TurnExecutionResult:
    """Finalized turn output plus metadata."""

    final_content: str | None
    metadata: dict[str, Any]
    explainability: dict[str, Any] | None
    external_skill_suggestions: list[dict[str, str]]
    report_path: Path | None
    tools_used: list[str]
    all_messages: list[dict[str, Any]]
    usage: dict[str, int]


class MarketTurnOrchestrator:
    """Run one MarketBot turn through the full domain-aware pipeline."""

    def __init__(self, loop: Any):
        self.loop = loop

    async def execute(self, request: TurnExecutionRequest) -> TurnExecutionResult:
        """Execute, fallback, finalize, persist, and return one turn."""
        self._reset_turn_state()
        progress_cb = request.on_progress or self._default_progress_callback(request)
        final_content, tools_used, all_msgs, usage = await self._execute_primary(
            request,
            progress_cb=progress_cb,
        )
        final_content, tools_used, all_msgs, usage = await self._retry_with_fallback_if_needed(
            request,
            final_content=final_content,
            tools_used=tools_used,
            all_msgs=all_msgs,
            usage=usage,
            progress_cb=progress_cb,
        )
        if request.normalize_daily_report:
            final_content = self.loop._normalize_daily_opportunity_report(final_content)
        final_content, explainability, suggestions, report_path = self.loop._finalize_response_content(
            final_content,
            all_msgs=all_msgs,
            channel=request.channel,
            request_text=request.request_text,
            append_inline_explainability=request.append_inline_explainability,
            empty_fallback=request.empty_fallback,
        )
        record_result = self.loop._record_completed_turn(
            session=request.session,
            history_len=len(request.history),
            all_msgs=all_msgs,
            usage=usage,
            request_text=request.request_text,
            final_content=final_content,
            tools_used=tools_used,
        )
        if hasattr(record_result, "__await__"):
            await record_result
        metadata = self.loop._build_response_metadata(
            msg_metadata=request.msg.metadata,
            usage=usage,
            explainability=explainability,
            external_skill_suggestions=suggestions,
            report_path=report_path,
        )
        return TurnExecutionResult(
            final_content=final_content,
            metadata=metadata,
            explainability=explainability,
            external_skill_suggestions=suggestions,
            report_path=report_path,
            tools_used=tools_used or [],
            all_messages=all_msgs,
            usage=usage or {},
        )

    def _reset_turn_state(self) -> None:
        self.loop._last_skill_fallback = None
        self.loop._last_plan_summary = None
        self.loop._last_plan_path = None

    def _default_progress_callback(
        self,
        request: TurnExecutionRequest,
    ) -> Callable[[str], Awaitable[None]] | None:
        if request.msg.channel == "system":
            return None
        return self.loop._build_bus_progress_callback(msg=request.msg)

    def _route_mode(self, default: str) -> str:
        return str((getattr(self.loop, "_last_route_decision", {}) or {}).get("mode") or default)

    async def _execute_primary(
        self,
        request: TurnExecutionRequest,
        *,
        progress_cb: Callable[[str], Awaitable[None]] | None,
    ) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        route_mode = self._route_mode(request.default_route_mode)
        if route_mode == "planned_task":
            return await self._execute_plan(request, progress_cb=progress_cb, route_mode=route_mode)
        return await _execute_with_compat(
            self.loop,
            request.initial_messages,
            on_progress=progress_cb,
        )

    async def _execute_plan(
        self,
        request: TurnExecutionRequest,
        *,
        progress_cb: Callable[[str], Awaitable[None]] | None,
        route_mode: str,
    ) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        plan = self.loop.planner.create_plan(
            request_text=request.request_text,
            visible_tools=self.loop._visible_tool_names(),
            route_mode=route_mode,
        )
        self.loop._last_plan_summary = {
            "id": plan.id,
            "mode": plan.mode,
            "stepCount": len(plan.steps),
            "steps": [step.title for step in plan.steps],
        }
        return await self.loop.plan_runtime.run_plan(
            loop=self.loop,
            plan=plan,
            session=request.session,
            channel=request.channel,
            chat_id=request.chat_id,
            on_progress=progress_cb,
        )

    async def _retry_with_fallback_if_needed(
        self,
        request: TurnExecutionRequest,
        *,
        final_content: str | None,
        tools_used: list[str] | None,
        all_msgs: list[dict[str, Any]],
        usage: dict[str, int] | None,
        progress_cb: Callable[[str], Awaitable[None]] | None,
    ) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        initial_outcome = self.loop._classify_skill_outcome(
            final_content=final_content,
            all_msgs=all_msgs,
        )
        primary_name = self._primary_skill_name()
        retry_skills, retry_content, retry_tools, retry_msgs, retry_usage = await self.loop._retry_turn_with_fallback(
            session=request.session,
            current_message=request.request_text,
            media=request.media,
            channel=request.channel,
            chat_id=request.chat_id,
            on_progress=progress_cb,
            outcome=initial_outcome,
        )
        if not retry_skills:
            return final_content, tools_used or [], all_msgs, usage or {}

        final_name = self._primary_skill_name() or retry_skills[0]
        self.loop._last_skill_fallback = {
            "used": True,
            "primarySkill": primary_name,
            "fallbackSkills": list(retry_skills),
            "selectedFallback": retry_skills[0],
            "finalSkill": final_name,
        }
        return (
            retry_content,
            retry_tools or [],
            retry_msgs or [],
            self.loop._merge_usage(usage or {}, retry_usage),
        )

    def _primary_skill_name(self) -> str:
        routing = self.loop.processor.get_last_skill_routing() or {}
        selected = routing.get("selected") or []
        if selected and isinstance(selected[0], dict):
            return str(selected[0].get("name") or "").strip()
        return ""


async def _execute_with_compat(
    loop: Any,
    messages: list[dict[str, Any]],
    *,
    on_progress: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
    """Run through the shared executor when present, otherwise fall back to legacy loop."""
    executor = getattr(loop, "executor", None)
    if executor is not None:
        return await executor.execute_messages(messages, on_progress=on_progress)
    try:
        return await loop._run_agent_loop(messages, on_progress=on_progress)
    except TypeError:
        return await loop._run_agent_loop(messages)


def to_outbound_message(
    result: TurnExecutionResult,
    *,
    channel: str,
    chat_id: str,
    fallback_content: str,
) -> OutboundMessage:
    """Convert a turn result to an outbound bus message."""
    return OutboundMessage(
        channel=channel,
        chat_id=chat_id,
        content=result.final_content or fallback_content,
        metadata=result.metadata,
    )

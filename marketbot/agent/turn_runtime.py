"""Turn preparation and response finalization helpers for AgentLoop."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Awaitable, Callable

from marketbot.agent import response_postprocess
from marketbot.agent.tools.message import MessageTool
from marketbot.agent.turn_orchestrator import (
    MarketTurnOrchestrator,
    TurnExecutionRequest,
    to_outbound_message,
)
from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.session.manager import Session


def build_response_metadata(
    loop,
    *,
    msg_metadata: dict[str, Any] | None,
    usage: dict[str, Any] | None,
    explainability: dict[str, Any] | None,
    external_skill_suggestions: list[dict[str, str]] | None,
    report_path: Path | None,
) -> dict[str, Any]:
    """Build outbound metadata for completed turns."""
    metadata = dict(msg_metadata or {})
    if getattr(loop, "_last_route_decision", None):
        metadata["route_decision"] = dict(loop._last_route_decision)
    if getattr(loop, "_last_plan_summary", None):
        metadata["plan"] = dict(loop._last_plan_summary)
    if getattr(loop, "_last_plan_path", None):
        metadata["plan_path"] = str(loop._last_plan_path)
    if usage:
        metadata["usage"] = usage
    if skill_routing := loop.processor.get_last_skill_routing():
        metadata["skill_routing"] = skill_routing
    if getattr(loop, "_last_skill_fallback", None):
        metadata["skill_fallback"] = dict(loop._last_skill_fallback)
        if isinstance(metadata.get("skill_routing"), dict):
            routing = dict(metadata["skill_routing"])
            routing["fallbackExecution"] = dict(loop._last_skill_fallback)
            metadata["skill_routing"] = routing
    if explainability:
        metadata["explainability"] = explainability
    if external_skill_suggestions:
        metadata["skill_install_suggestions"] = external_skill_suggestions
    if report_path is not None:
        metadata["saved_report_path"] = str(report_path)
    return metadata


def finalize_response_content(
    loop,
    final_content: str | None,
    *,
    all_msgs: list[dict[str, Any]],
    channel: str,
    request_text: str,
    append_inline_explainability: bool,
    empty_fallback: str | None = None,
) -> tuple[str | None, dict[str, Any] | None, list[dict[str, str]], Path | None]:
    """Apply response post-processing shared by system and normal message flows."""
    content = final_content
    if content is None and empty_fallback is not None:
        content = empty_fallback
    explainability = loop._build_chat_explainability(all_msgs, channel=channel)
    if append_inline_explainability:
        content = loop._append_chat_explainability(content, explainability)
    if response_postprocess.is_publish_result_message(content):
        explainability = None
    external_skill_suggestions = loop._build_external_skill_install_suggestions()
    content = loop._append_external_skill_suggestions(content, external_skill_suggestions)
    report_path = loop._persist_local_report_if_needed(content, request_text=request_text)
    content = loop._append_saved_report_path(content, report_path)
    return content, explainability, external_skill_suggestions, report_path


async def record_completed_turn(
    loop,
    *,
    session: Session,
    history_len: int,
    all_msgs: list[dict[str, Any]],
    usage: dict[str, Any] | None,
    request_text: str,
    final_content: str | None,
    tools_used: list[str],
) -> None:
    """Persist usage metadata and session history for a completed turn."""
    if usage:
        session.metadata["last_usage"] = usage
    await loop._record_skill_outcome(
        request_text=request_text,
        all_msgs=all_msgs,
        final_content=final_content,
        tools_used=tools_used,
    )
    loop._save_turn(session, all_msgs, 1 + history_len)
    await loop.sessions.save_async(session)


def prepare_system_turn(
    loop,
    *,
    session: Session,
    channel: str,
    chat_id: str,
    current_message: str,
    message_id: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Prepare session history and prompt messages for a system-triggered turn."""
    loop._set_tool_context(channel, chat_id, message_id)
    history = loop.processor.get_recent_history(session)
    messages = loop.processor.build_messages(
        session=session,
        current_message=current_message,
        channel=channel,
        chat_id=chat_id,
    )
    return history, messages


async def prepare_user_turn(
    loop,
    *,
    session: Session,
    msg: InboundMessage,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Prepare session state and prompt messages for a user turn."""
    await loop.processor.schedule_consolidation(session)
    loop._set_tool_context(msg.channel, msg.chat_id, msg.metadata.get("message_id"))
    if message_tool := loop.tools.get("message"):
        if isinstance(message_tool, MessageTool):
            message_tool.start_turn()
    history = loop.processor.get_recent_history(session)
    messages = loop.processor.build_messages(
        session=session,
        current_message=msg.content,
        media=msg.media if msg.media else None,
        channel=msg.channel,
        chat_id=msg.chat_id,
    )
    return history, messages


def preview_message_content(content: str) -> str:
    """Build a short log preview for message content."""
    return content[:80] + "..." if len(content) > 80 else content


def build_bus_progress_callback(
    loop,
    *,
    msg: InboundMessage,
) -> Callable[[str], Awaitable[None]]:
    """Create a progress publisher bound to the current inbound message."""

    async def _bus_progress(content: str, *, tool_hint: bool = False) -> None:
        meta = dict(msg.metadata or {})
        meta["_progress"] = True
        meta["_tool_hint"] = tool_hint
        await loop.bus.publish_outbound(
            OutboundMessage(
                channel=msg.channel,
                chat_id=msg.chat_id,
                content=content,
                metadata=meta,
            )
        )

    return _bus_progress


async def run_user_turn(
    loop,
    *,
    msg: InboundMessage,
    session: Session,
    history: list[dict[str, Any]],
    initial_messages: list[dict[str, Any]],
    on_progress: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[str | None, dict[str, Any]]:
    """Execute a normal user turn and return finalized content plus metadata."""
    result = await MarketTurnOrchestrator(loop).execute(
        TurnExecutionRequest(
            msg=msg,
            session=session,
            history=history,
            initial_messages=initial_messages,
            channel=msg.channel,
            chat_id=msg.chat_id,
            request_text=msg.content,
            default_route_mode="direct_react",
            append_inline_explainability=(msg.channel == "cli"),
            empty_fallback="I've completed processing but have no response to give.",
            media=msg.media if msg.media else None,
            normalize_daily_report=True,
            on_progress=on_progress,
        )
    )
    return result.final_content, result.metadata


async def run_system_turn(
    loop,
    *,
    msg: InboundMessage,
    session: Session,
    history: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    channel: str,
    chat_id: str,
) -> OutboundMessage:
    """Execute a system-triggered turn and return the outbound response."""
    result = await MarketTurnOrchestrator(loop).execute(
        TurnExecutionRequest(
            msg=msg,
            session=session,
            history=history,
            initial_messages=messages,
            channel=channel,
            chat_id=chat_id,
            request_text=msg.content,
            default_route_mode="scheduled_task",
            append_inline_explainability=True,
        )
    )
    return to_outbound_message(
        result,
        channel=channel,
        chat_id=chat_id,
        fallback_content="Background task completed.",
    )

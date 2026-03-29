"""Message building and history helpers for MessageProcessor."""

from __future__ import annotations

from typing import Any


def build_messages(
    processor: Any,
    *,
    session: Any,
    current_message: str,
    routing_message: str | None = None,
    skill_names: list[str] | None = None,
    media: list[str] | None = None,
    channel: str | None = None,
    chat_id: str | None = None,
) -> list[dict[str, Any]]:
    """Build prompt messages from session state and current user input."""
    history = processor.get_recent_history(session)
    original_message = routing_message if routing_message is not None else current_message
    current_message = processor.rewrite_sensitive_market_shortcuts(current_message)
    messages = processor.context.build_messages(
        history=history,
        current_message=current_message,
        routing_message=original_message,
        skill_names=skill_names,
        media=media,
        channel=channel,
        chat_id=chat_id,
    )
    if routing := processor.context.get_last_skill_routing():
        session.metadata["last_skill_routing"] = routing
    return messages


def get_recent_history(processor: Any, session: Any) -> list[dict[str, Any]]:
    """Return a bounded recent history window tuned for token efficiency."""
    return session.get_history(
        max_messages=processor.memory_window,
        max_turns=processor.history_turn_window,
    )


def get_last_skill_routing(processor: Any) -> dict[str, Any] | None:
    """Expose structured skill-routing metadata for downstream renderers."""
    return processor.context.get_last_skill_routing()

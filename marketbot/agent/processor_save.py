"""Session message persistence helpers for MessageProcessor."""

from __future__ import annotations

from datetime import datetime
from typing import Any


def save_session_messages(
    *,
    session: Any,
    messages: list[dict[str, Any]],
    skip: int,
    runtime_context_tag: str,
    tool_result_max_chars: int,
) -> None:
    """Normalize and append turn messages into the session history."""
    for message in messages[skip:]:
        entry = normalize_session_entry(
            message,
            runtime_context_tag=runtime_context_tag,
            tool_result_max_chars=tool_result_max_chars,
        )
        if entry is None:
            continue
        entry.setdefault("timestamp", datetime.now().isoformat())
        session.messages.append(entry)
    session.updated_at = datetime.now()


def normalize_session_entry(
    message: dict[str, Any],
    *,
    runtime_context_tag: str,
    tool_result_max_chars: int,
) -> dict[str, Any] | None:
    """Normalize a single message before persisting it into session history."""
    entry = dict(message)
    role, content = entry.get("role"), entry.get("content")
    if role == "assistant" and not content and not entry.get("tool_calls"):
        return None
    if role == "tool" and isinstance(content, str) and len(content) > tool_result_max_chars:
        entry["content"] = content[:tool_result_max_chars] + "\n... (truncated)"
        return entry
    if role != "user":
        return entry

    normalized = normalize_user_content(content, runtime_context_tag=runtime_context_tag)
    if normalized is None:
        return None
    entry["content"] = normalized
    return entry


def normalize_user_content(
    content: Any,
    *,
    runtime_context_tag: str,
) -> Any | None:
    """Remove runtime metadata noise and inline images from persisted user content."""
    if isinstance(content, str) and content.startswith(runtime_context_tag):
        parts = content.split("\n\n", 1)
        if len(parts) > 1 and parts[1].strip():
            return parts[1]
        return None
    if isinstance(content, list):
        filtered = []
        for chunk in content:
            if (
                chunk.get("type") == "text"
                and isinstance(chunk.get("text"), str)
                and chunk["text"].startswith(runtime_context_tag)
            ):
                continue
            if chunk.get("type") == "image_url" and chunk.get("image_url", {}).get("url", "").startswith("data:image/"):
                filtered.append({"type": "text", "text": "[image]"})
            else:
                filtered.append(chunk)
        return filtered or None
    return content

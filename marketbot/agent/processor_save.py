"""Session message persistence helpers for MessageProcessor."""

from __future__ import annotations

from datetime import datetime
from typing import Any

_RUNTIME_CONTEXT_END = "[/Runtime Context]"


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
    if isinstance(content, str):
        return _strip_runtime_context(content, runtime_context_tag)
    if isinstance(content, list):
        filtered = []
        for chunk in content:
            if not isinstance(chunk, dict):
                filtered.append(chunk)
                continue
            if (
                chunk.get("type") == "text"
                and isinstance(chunk.get("text"), str)
            ):
                text = _strip_runtime_context(chunk["text"], runtime_context_tag)
                if text:
                    next_chunk = dict(chunk)
                    next_chunk["text"] = text
                    filtered.append(next_chunk)
                continue
            if chunk.get("type") == "image_url" and chunk.get("image_url", {}).get("url", "").startswith("data:image/"):
                filtered.append({"type": "text", "text": "[image]"})
            else:
                filtered.append(chunk)
        return filtered or None
    return content


def _strip_runtime_context(text: str, runtime_context_tag: str) -> str | None:
    """Strip MarketBot runtime metadata from either prefix or suffix position."""
    if runtime_context_tag not in text:
        return text

    before, runtime_and_after = text.split(runtime_context_tag, 1)
    if _RUNTIME_CONTEXT_END in runtime_and_after:
        _, after = runtime_and_after.split(_RUNTIME_CONTEXT_END, 1)
        cleaned = (before + after).strip()
        return cleaned or None

    # Backward compatibility for older sessions where runtime metadata was
    # prepended and separated from the user message by a blank line.
    if before.strip():
        return before.strip()
    parts = runtime_and_after.split("\n\n", 1)
    if len(parts) > 1 and parts[1].strip():
        return parts[1].strip()
    return None

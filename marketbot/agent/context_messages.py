"""Message and runtime metadata helpers for ContextBuilder."""

import base64
import mimetypes
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from marketbot.utils.helpers import detect_image_mime


def build_runtime_context(tag: str, channel: str | None, chat_id: str | None) -> str:
    """Build untrusted runtime metadata block for injection before the user message."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M (%A)")
    tz = time.strftime("%Z") or "UTC"
    lines = [f"Current Time: {now} ({tz})"]
    if channel and chat_id:
        lines += [f"Channel: {channel}", f"Chat ID: {chat_id}"]
    return tag + "\n" + "\n".join(lines)


def build_user_content(text: str, media: list[str] | None) -> str | list[dict[str, Any]]:
    """Build user message content with optional base64-encoded images."""
    text = augment_user_text(text)
    if not media:
        return text

    images = []
    for path in media:
        file_path = Path(path)
        if not file_path.is_file():
            continue
        raw = file_path.read_bytes()
        mime = detect_image_mime(raw) or mimetypes.guess_type(path)[0]
        if not mime or not mime.startswith("image/"):
            continue
        b64 = base64.b64encode(raw).decode()
        images.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})

    if not images:
        return text
    return images + [{"type": "text", "text": text}]


def augment_user_text(text: str) -> str:
    """Add narrow runtime hints for requests that need deterministic command planning."""
    raw = str(text or "")
    lower = raw.lower()
    intel_terms = ("intel digest", "daily digest", "资讯日报", "情报摘要")
    recurring_terms = ("schedule", "every morning", "自动", "定时", "每天", "每日")
    if any(term in lower for term in intel_terms) and any(term in lower for term in recurring_terms):
        return raw + "\n\n" + "Planning note: for the latest scheduled intel digest, prefer " + "`marketbot intel schedule-latest-daily`."
    return raw


def add_tool_result(
    messages: list[dict[str, Any]],
    tool_call_id: str,
    tool_name: str,
    result: str,
) -> list[dict[str, Any]]:
    """Add a tool result to the message list."""
    messages.append({"role": "tool", "tool_call_id": tool_call_id, "name": tool_name, "content": result})
    return messages


def add_assistant_message(
    messages: list[dict[str, Any]],
    content: str | None,
    tool_calls: list[dict[str, Any]] | None = None,
    reasoning_content: str | None = None,
    thinking_blocks: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Add an assistant message to the message list."""
    message: dict[str, Any] = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = tool_calls
    if reasoning_content is not None:
        message["reasoning_content"] = reasoning_content
    if thinking_blocks:
        message["thinking_blocks"] = thinking_blocks
    messages.append(message)
    return messages

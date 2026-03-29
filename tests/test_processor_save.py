from marketbot.agent.context import ContextBuilder
from marketbot.agent.processor_save import normalize_session_entry, save_session_messages
from marketbot.session.manager import Session


def test_normalize_session_entry_drops_runtime_only_user_message() -> None:
    runtime = ContextBuilder._RUNTIME_CONTEXT_TAG + "\nCurrent Time: now (UTC)"

    entry = normalize_session_entry(
        {"role": "user", "content": runtime},
        runtime_context_tag=ContextBuilder._RUNTIME_CONTEXT_TAG,
        tool_result_max_chars=500,
    )

    assert entry is None


def test_normalize_session_entry_keeps_image_placeholder() -> None:
    runtime = ContextBuilder._RUNTIME_CONTEXT_TAG + "\nCurrent Time: now (UTC)"

    entry = normalize_session_entry(
        {
            "role": "user",
            "content": [
                {"type": "text", "text": runtime},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
            ],
        },
        runtime_context_tag=ContextBuilder._RUNTIME_CONTEXT_TAG,
        tool_result_max_chars=500,
    )

    assert entry is not None
    assert entry["content"] == [{"type": "text", "text": "[image]"}]


def test_save_session_messages_truncates_large_tool_result() -> None:
    session = Session(key="cli:test")

    save_session_messages(
        session=session,
        messages=[{"role": "tool", "content": "A" * 600}],
        skip=0,
        runtime_context_tag=ContextBuilder._RUNTIME_CONTEXT_TAG,
        tool_result_max_chars=500,
    )

    assert "... (truncated)" in session.messages[0]["content"]

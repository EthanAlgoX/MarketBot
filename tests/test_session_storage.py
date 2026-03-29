from datetime import datetime
from pathlib import Path

from marketbot.session import storage


def test_session_path_normalizes_key(tmp_path: Path) -> None:
    path = storage.session_path(tmp_path, "telegram:chat-1")

    assert path == tmp_path / "telegram_chat-1.jsonl"


def test_save_and_load_session_jsonl_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "session.jsonl"
    created_at = datetime(2026, 3, 29, 9, 0, 0)
    updated_at = datetime(2026, 3, 29, 9, 5, 0)
    messages = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]

    storage.save_session_jsonl(
        path,
        key="telegram:test",
        created_at=created_at,
        updated_at=updated_at,
        metadata={"channel": "telegram"},
        last_consolidated=1,
        messages=messages,
    )

    payload = storage.load_session_jsonl(path)

    assert payload["messages"] == messages
    assert payload["metadata"] == {"channel": "telegram"}
    assert payload["created_at"] == created_at
    assert payload["updated_at"] == updated_at
    assert payload["last_consolidated"] == 1


def test_load_session_index_reads_metadata_line(tmp_path: Path) -> None:
    path = tmp_path / "session.jsonl"
    storage.save_session_jsonl(
        path,
        key="telegram:test",
        created_at=datetime(2026, 3, 29, 9, 0, 0),
        updated_at=datetime(2026, 3, 29, 9, 5, 0),
        metadata={},
        last_consolidated=0,
        messages=[{"role": "user", "content": "hi"}],
    )

    data = storage.load_session_index(path)

    assert data is not None
    assert data["key"] == "telegram:test"
    assert data["_type"] == "metadata"

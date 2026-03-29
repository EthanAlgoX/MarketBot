import asyncio
import json
from datetime import datetime
from pathlib import Path

from marketbot.session.manager import Session, SessionManager
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


def test_session_manager_save_async_persists_session(tmp_path: Path) -> None:
    manager = SessionManager(tmp_path)
    session = Session(key="telegram:async")
    session.add_message("user", "hi")

    asyncio.run(manager.save_async(session))

    reloaded = manager.get_or_create("telegram:async")
    assert reloaded.messages[-1]["content"] == "hi"
    assert manager._cache["telegram:async"] is session


def test_session_manager_appends_only_new_messages(tmp_path: Path) -> None:
    manager = SessionManager(tmp_path)
    session = Session(key="telegram:append")
    session.add_message("user", "first")
    manager.save(session)

    path = manager._get_session_path(session.key)
    first_lines = path.read_text(encoding="utf-8").splitlines()
    assert len(first_lines) == 2

    session.add_message("assistant", "second")
    manager.save(session)

    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 4
    assert json.loads(lines[-1])["content"] == "second"

    reloaded = manager.invalidate(session.key) or manager.get_or_create("telegram:append")
    assert [item["content"] for item in reloaded.messages] == ["first", "second"]


def test_session_manager_compacts_after_many_metadata_appends(tmp_path: Path) -> None:
    manager = SessionManager(tmp_path)
    session = Session(key="telegram:compact")
    session.add_message("user", "seed")
    manager.save(session)

    for i in range(8):
        session.metadata["tick"] = i
        manager.save(session)

    path = manager._get_session_path(session.key)
    lines = path.read_text(encoding="utf-8").splitlines()
    metadata_lines = [json.loads(line) for line in lines if json.loads(line).get("_type") == "metadata"]

    assert len(metadata_lines) == 1
    assert metadata_lines[0]["metadata"]["tick"] == 7


def test_session_manager_stats_reports_stored_and_cached_counts(tmp_path: Path) -> None:
    manager = SessionManager(tmp_path)
    session = Session(key="telegram:stats")
    session.add_message("user", "hi")
    manager.save(session)

    stats = manager.stats()

    assert stats["storedSessions"] == 1
    assert stats["storedBytes"] > 0
    assert stats["legacySessions"] == 0
    assert stats["cachedSessions"] == 1
    assert stats["cachedMessages"] == 1
    assert stats["compactMetadataThreshold"] == 8

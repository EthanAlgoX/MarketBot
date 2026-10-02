import asyncio
import hashlib
import json
import multiprocessing
import threading
from copy import deepcopy
from datetime import datetime
from pathlib import Path

import pytest

from marketbot.session import storage
from marketbot.session.manager import Session, SessionManager


def test_session_path_normalizes_key(tmp_path: Path) -> None:
    path = storage.session_path(tmp_path, "telegram:chat-1")

    digest = hashlib.sha256(b"telegram:chat-1").hexdigest()
    assert path == tmp_path / f"telegram_chat-1-{digest}.jsonl"


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


def _write_session(path, key, content="private history"):
    storage.save_session_jsonl(path, key=key, created_at=datetime.now(), updated_at=datetime.now(), metadata={}, last_consolidated=0, messages=[{"role": "user", "content": content}])


def test_distinct_keys_with_same_legacy_filename_keep_separate_histories(tmp_path):
    manager = SessionManager(tmp_path)
    manager.legacy_sessions_dir = tmp_path / "legacy-global"
    first_key, second_key = "a:b_c", "a_b:c"
    first = manager.get_or_create(first_key)
    first.add_message("user", "first account")
    manager.save(first)
    second = manager.get_or_create(second_key)
    second.add_message("user", "second account")
    manager.save(second)
    assert manager._get_session_path(first_key) != manager._get_session_path(second_key)
    manager.invalidate(first_key)
    manager.invalidate(second_key)
    assert manager.get_or_create(first_key).messages[0]["content"] == "first account"
    assert manager.get_or_create(second_key).messages[0]["content"] == "second account"


@pytest.mark.parametrize("global_location", [False, True])
def test_matching_legacy_session_is_migrated_only_after_identity_validation(tmp_path, global_location):
    manager = SessionManager(tmp_path / "workspace")
    manager.legacy_sessions_dir = tmp_path / "legacy-global"
    source_directory = manager.legacy_sessions_dir if global_location else manager.sessions_dir
    source_directory.mkdir(parents=True, exist_ok=True)
    legacy = storage.legacy_session_path(source_directory, "telegram:legacy")
    _write_session(legacy, "telegram:legacy")
    session = manager.get_or_create("telegram:legacy")
    assert session.messages[0]["content"] == "private history"
    assert manager._get_session_path(session.key).exists()
    assert not legacy.exists()


def test_colliding_legacy_file_is_preserved_and_never_imported(tmp_path):
    manager = SessionManager(tmp_path)
    manager.legacy_sessions_dir = tmp_path / "legacy-global"
    legacy = storage.legacy_session_path(manager.sessions_dir, "a:b_c")
    _write_session(legacy, "a:b_c", "private first account")
    original = legacy.read_bytes()
    second = manager.get_or_create("a_b:c")
    assert second.messages == []
    manager.save(second)
    assert legacy.read_bytes() == original
    assert manager.get_or_create("a:b_c").messages[0]["content"] == "private first account"


def test_missing_legacy_identity_is_not_guessed_from_filename(tmp_path):
    manager = SessionManager(tmp_path)
    manager.legacy_sessions_dir = tmp_path / "legacy-global"
    legacy = storage.legacy_session_path(manager.sessions_dir, "telegram:unknown")
    original = '{"_type":"metadata","metadata":{}}\n{"role":"user","content":"unknown owner"}\n'
    legacy.write_text(original)
    assert manager.get_or_create("telegram:unknown").messages == []
    assert legacy.read_text() == original


@pytest.mark.parametrize("content", ["{broken\n", '{"_type":"metadata","key":"another:account"}\n', ""])
def test_corrupt_or_conflicting_canonical_file_cannot_be_replaced(tmp_path, content):
    manager = SessionManager(tmp_path)
    path = manager._get_session_path("telegram:protected")
    path.write_text(content)
    with pytest.raises(storage.SessionStorageError):
        manager.get_or_create("telegram:protected")
    with pytest.raises(storage.SessionStorageError):
        manager.save(Session(key="telegram:protected"))
    assert path.read_text() == content
    assert "telegram:protected" not in manager._cache


def test_every_metadata_record_must_prove_the_same_identity(tmp_path):
    path = tmp_path / "mixed.jsonl"
    _write_session(path, "account:first")
    original = path.read_text()
    metadata = storage.build_metadata_line(key="account:second", created_at=datetime.now(), updated_at=datetime.now(), metadata={}, last_consolidated=0)
    path.write_text(original + json.dumps(metadata) + "\n")
    with pytest.raises(storage.SessionIdentityError):
        storage.load_session_jsonl(path, expected_key="account:second")
    with pytest.raises(storage.SessionIdentityError):
        storage.load_session_index(path)


def test_invalid_save_or_append_preserves_complete_existing_file(tmp_path):
    path = tmp_path / "protected.jsonl"
    _write_session(path, "account:one")
    original = path.read_bytes()
    for writer in (storage.save_session_jsonl, storage.append_session_jsonl):
        with pytest.raises(storage.SessionStorageError):
            writer(path, key="account:one", created_at=datetime.now(), updated_at=datetime.now(), metadata={}, last_consolidated=0, messages=[{"role": "user", "content": "valid first"}, {"invalid": object()}])
        assert path.read_bytes() == original
    assert not list(tmp_path.glob(".session-*.jsonl"))


def test_long_unicode_identity_has_bounded_path_and_is_persistable(tmp_path):
    manager = SessionManager(tmp_path)
    key = "telegram:" + "研究会话" * 200
    session = manager.get_or_create(key)
    session.add_message("user", "hi")
    manager.save(session)
    assert len(manager._get_session_path(key).name.encode("utf-8")) < 255
    assert manager.get_or_create(key).messages[0]["content"] == "hi"


def test_history_and_async_save_snapshots_do_not_share_nested_objects(tmp_path, monkeypatch):
    manager = SessionManager(tmp_path)
    session = Session(key="telegram:snapshot", messages=[{"role": "user", "content": "hi"}, {"role": "assistant", "tool_calls": [{"function": {"arguments": {"price": 100}}}]}], metadata={"plan": {"steps": ["one"]}})
    history = session.get_history()
    history[1]["tool_calls"][0]["function"]["arguments"]["price"] = 200
    assert session.messages[1]["tool_calls"][0]["function"]["arguments"]["price"] == 100
    started, release = threading.Event(), threading.Event()
    captured = []

    def save(snapshot):
        started.set()
        assert release.wait(5)
        captured.append(deepcopy(snapshot))

    monkeypatch.setattr(manager, "_save_to_disk", save)

    async def exercise():
        task = asyncio.create_task(manager.save_async(session))
        assert await asyncio.to_thread(started.wait, 5)
        try:
            session.messages[1]["tool_calls"][0]["function"]["arguments"]["price"] = 300
            session.metadata["plan"]["steps"].append("two")
        finally:
            release.set()
        await task

    asyncio.run(exercise())
    assert captured[0].messages[1]["tool_calls"][0]["function"]["arguments"]["price"] == 100
    assert captured[0].metadata == {"plan": {"steps": ["one"]}}


def test_stale_save_and_compaction_fail_without_losing_another_instance_messages(tmp_path):
    first, second = SessionManager(tmp_path), SessionManager(tmp_path)
    initial = first.get_or_create("account:shared")
    initial.add_message("user", "base")
    first.save(initial)
    stale = second.get_or_create(initial.key)
    initial.add_message("assistant", "first writer")
    first.save(initial)
    stale.add_message("assistant", "second writer")
    stale._metadata_records = 8
    before = first._get_session_path(initial.key).read_bytes()

    with pytest.raises(storage.SessionConflictError, match="reload.*retry") as error:
        second.save(stale)
    assert error.value.retryable
    assert first._get_session_path(initial.key).read_bytes() == before
    fresh = second.get_or_create(initial.key)
    assert fresh is not stale
    fresh.add_message("assistant", "second writer after reload")
    second.save(fresh)
    stored = storage.load_session_jsonl(first._get_session_path(initial.key), expected_key=initial.key)
    assert [message["content"] for message in stored["messages"]] == ["base", "first writer", "second writer after reload"]


def test_async_conflict_evicts_stale_cache_so_get_or_create_can_retry(tmp_path):
    first, second = SessionManager(tmp_path), SessionManager(tmp_path)
    initial = first.get_or_create("account:async-retry")
    initial.add_message("user", "base")
    first.save(initial)
    stale = second.get_or_create(initial.key)
    initial.add_message("assistant", "new disk evidence")
    first.save(initial)
    stale.add_message("assistant", "unpersisted stale turn")

    async def exercise():
        with pytest.raises(storage.SessionConflictError):
            await second.save_async(stale)
        assert initial.key not in second._cache
        fresh = second.get_or_create(initial.key)
        assert fresh is not stale
        assert [message["content"] for message in fresh.messages] == ["base", "new disk evidence"]
        fresh.add_message("assistant", "retry after reload")
        await second.save_async(fresh)

    asyncio.run(exercise())
    assert [message["content"] for message in storage.load_session_jsonl(first._get_session_path(initial.key))["messages"]] == ["base", "new disk evidence", "retry after reload"]


def test_stale_clear_cannot_erase_another_instance_new_messages(tmp_path):
    first, second = SessionManager(tmp_path), SessionManager(tmp_path)
    current = first.get_or_create("account:shared")
    current.add_message("user", "base")
    first.save(current)
    stale = second.get_or_create(current.key)
    current.add_message("assistant", "new evidence")
    first.save(current)
    stale.clear()
    with pytest.raises(storage.SessionConflictError):
        second.save(stale)
    assert [message["content"] for message in storage.load_session_jsonl(first._get_session_path(current.key))["messages"]] == ["base", "new evidence"]
    current.clear()
    first.save(current)
    assert storage.load_session_jsonl(first._get_session_path(current.key))["messages"] == []


def test_stale_append_cannot_resurrect_a_session_cleared_by_another_instance(tmp_path):
    first, second = SessionManager(tmp_path), SessionManager(tmp_path)
    current = first.get_or_create("account:shared")
    current.add_message("user", "history before clear")
    first.save(current)
    stale = second.get_or_create(current.key)
    current.clear()
    first.save(current)
    stale.add_message("assistant", "stale turn")
    with pytest.raises(storage.SessionConflictError):
        second.save(stale)
    assert storage.load_session_jsonl(first._get_session_path(current.key))["messages"] == []


def test_parallel_saves_of_same_history_do_not_duplicate_appends(tmp_path):
    manager = SessionManager(tmp_path)
    session = manager.get_or_create("account:parallel")
    session.add_message("user", "base")
    manager.save(session)
    session.add_message("assistant", "one append")

    async def save_both():
        await asyncio.gather(manager.save_async(session), manager.save_async(session))

    asyncio.run(save_both())
    stored = storage.load_session_jsonl(manager._get_session_path(session.key))
    assert [message["content"] for message in stored["messages"]] == ["base", "one append"]


def _process_session_writer(workspace, label, release, queue):
    manager = SessionManager(Path(workspace))
    manager.legacy_sessions_dir = Path(workspace) / "legacy-global"
    session = manager.get_or_create("account:processes")
    session.add_message("assistant", label)
    queue.put((label, "loaded"))
    if not release.wait(10):
        queue.put((label, "timeout"))
        return
    try:
        manager.save(session)
        queue.put((label, "saved"))
    except storage.SessionConflictError:
        queue.put((label, "conflict"))


def test_process_writers_reject_stale_histories_without_disk_message_loss(tmp_path):
    manager = SessionManager(tmp_path)
    session = manager.get_or_create("account:processes")
    session.add_message("user", "base")
    manager.save(session)
    context = multiprocessing.get_context("spawn")
    queue, first_release, second_release = context.Queue(), context.Event(), context.Event()
    first = context.Process(target=_process_session_writer, args=(str(tmp_path), "first", first_release, queue))
    second = context.Process(target=_process_session_writer, args=(str(tmp_path), "second", second_release, queue))
    first.start()
    second.start()
    try:
        assert {queue.get(timeout=10), queue.get(timeout=10)} == {("first", "loaded"), ("second", "loaded")}
        first_release.set()
        assert queue.get(timeout=10) == ("first", "saved")
        second_release.set()
        assert queue.get(timeout=10) == ("second", "conflict")
    finally:
        first_release.set()
        second_release.set()
        first.join(10)
        second.join(10)
        if first.is_alive():
            first.terminate()
        if second.is_alive():
            second.terminate()
        queue.close()
    assert first.exitcode == second.exitcode == 0
    stored = storage.load_session_jsonl(manager._get_session_path(session.key))
    assert [message["content"] for message in stored["messages"]] == ["base", "first"]

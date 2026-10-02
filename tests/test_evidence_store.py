"""Evidence identity, provenance, authorization surface and durable storage boundaries."""

import asyncio
import hashlib
import json
import multiprocessing
import sqlite3
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from marketbot.agent.tools.evidence import EvidenceGetTool, EvidenceListTool, EvidenceRecordTool
from marketbot.domain.market.evidence import (
    EvidenceStore,
    EvidenceStoreError,
    EvidenceValidationError,
    canonical_json,
    content_digest,
)

UNKNOWN_ID = "ev_" + "0" * 64


def _record(store, **kwargs):
    return store.record(kind="quote", source="public_quote", payload={"price": 123.5}, **kwargs)


def test_reads_do_not_initialize_workspace(tmp_path):
    workspace = tmp_path / "not-created"
    store = EvidenceStore(workspace)

    assert store.get(UNKNOWN_ID) is None
    assert store.verify(UNKNOWN_ID) is False
    assert store.list_records() == []
    assert store.get_claim_evidence("thesis:one") == []
    assert store.validate_references([]) == []
    assert store.bind_claim("thesis:one", []) == []
    assert not workspace.exists()


def test_canonical_digest_dedup_and_original_retrieval_time(tmp_path):
    store = EvidenceStore(tmp_path)
    original = store.record(
        kind="quote", source="exchange", payload={"quote": {"currency": "USD", "price": 123.5}},
        source_url="https://example.org/quote?symbol=SPY", symbols=["spy", "SPY"],
        observed_at="2026-10-03T10:00:00+08:00", retrieved_at="2026-10-03T02:01:00Z",
        quality={"priceType": "last", "freshness": "delayed"},
    )
    repeated = EvidenceStore(tmp_path).record(
        kind="quote", source="exchange", payload={"quote": {"price": 123.5, "currency": "USD"}},
        source_url="https://example.org/quote?symbol=SPY", symbols=["SPY"],
        observed_at="2026-10-03T02:00:00Z", retrieved_at="2026-10-03T02:10:00Z",
        quality={"freshness": "delayed", "priceType": "last"},
    )

    expected = "sha256:" + hashlib.sha256(b'{"quote":{"currency":"USD","price":123.5}}').hexdigest()
    assert original.content_digest == expected == content_digest(original.payload)
    assert repeated == original
    assert repeated.retrieved_at == "2026-10-03T02:01:00+00:00"
    assert repeated.observed_at == "2026-10-03T02:00:00+00:00"
    assert repeated.published_at is None
    assert repeated.symbols == ("SPY",)
    assert store.verify(original.evidence_id)
    assert len(store.list_records()) == 1
    assert store.path.parent == tmp_path / "data" / "research" / "evidence"


def test_source_times_remain_unknown_and_different_sources_or_asofs_are_distinct(tmp_path):
    store = EvidenceStore(tmp_path)
    unknown_time = _record(store)
    later_observation = _record(store, observed_at="2026-10-03T02:00:00Z")
    other_source = store.record(kind="quote", source="second_exchange", payload={"price": 123.5})

    assert unknown_time.observed_at is None and unknown_time.published_at is None
    assert unknown_time.retrieved_at
    assert len({unknown_time.evidence_id, later_observation.evidence_id, other_source.evidence_id}) == 3
    assert unknown_time.content_digest == later_observation.content_digest == other_source.content_digest


def test_record_is_deeply_immutable_and_reads_do_not_share_mutable_payloads(tmp_path):
    store = EvidenceStore(tmp_path)
    payload = {"quotes": [{"symbol": "SPY", "price": 123.5}]}
    quality = {"warnings": ["delayed"]}
    record = store.record(kind="quote", source="exchange", payload=payload, quality=quality)
    payload["quotes"][0]["price"] = 999
    quality["warnings"].clear()
    record.payload["quotes"].clear()
    record.quality["warnings"].clear()
    record.to_dict()["payload"]["quotes"].clear()

    assert record.payload == {"quotes": [{"symbol": "SPY", "price": 123.5}]}
    assert store.get(record.evidence_id).quality == {"warnings": ["delayed"]}
    with pytest.raises(FrozenInstanceError):
        record.source = "replacement"


def test_claim_binding_is_atomic_and_derivations_require_known_evidence(tmp_path):
    store = EvidenceStore(tmp_path)
    first = _record(store, symbols=["SPY"])
    second = store.record(kind="calculation", source="portfolio_risk", payload={"totalValue": "123.50"}, derived_from=[first.evidence_id])
    assert second.derived_from == (first.evidence_id,)
    assert store.validate_references([second.evidence_id, first.evidence_id, first.evidence_id])
    store.bind_claim("thesis:SPY-growth", [first.evidence_id, first.evidence_id])

    with pytest.raises(EvidenceValidationError, match="Unknown evidence"):
        store.bind_claim("thesis:SPY-growth", [second.evidence_id, UNKNOWN_ID])
    assert [record.evidence_id for record in store.get_claim_evidence("thesis:SPY-growth")] == [first.evidence_id]
    assert store.claims_for(first.evidence_id) == ["thesis:SPY-growth"]
    assert store.claims_for(second.evidence_id) == []
    with pytest.raises(EvidenceValidationError, match="Unknown evidence"):
        _record(store, derived_from=[UNKNOWN_ID])
    assert len(store.list_records()) == 2


def test_list_filters_and_limits(tmp_path):
    store = EvidenceStore(tmp_path)
    quote = _record(store, symbols=["SPY"], retrieved_at="2026-10-03T02:00:00Z")
    filing = store.record(kind="filing", source="sec", payload={"revenue": 50}, symbols=["NVDA"], retrieved_at="2026-10-03T02:01:00Z")
    assert store.list_records(symbol="spy") == [quote]
    assert store.list_records(kind="filing", source="sec") == [filing]
    assert store.list_records(limit=1) == [filing]
    for limit in (0, 1001, True, 1.5):
        with pytest.raises(EvidenceValidationError):
            store.list_records(limit=limit)


@pytest.mark.parametrize("invalid", ["../x", "/tmp/x", "ev_../x", "", "ev_" + "A" * 64, UNKNOWN_ID + "/file", None])
def test_invalid_ids_and_claim_paths_are_rejected_before_io(tmp_path, invalid):
    store = EvidenceStore(tmp_path / "untouched")
    with pytest.raises(EvidenceValidationError):
        store.get(invalid)
    with pytest.raises(EvidenceValidationError):
        store.validate_references([invalid])
    if invalid != UNKNOWN_ID:
        # Evidence-shaped IDs can also be legal claim identifiers, but paths cannot.
        if invalid is None or not isinstance(invalid, str) or "/" in invalid or invalid == "":
            with pytest.raises(EvidenceValidationError):
                store.bind_claim(invalid, [])
    assert not store.workspace.exists()


@pytest.mark.parametrize("payload", [{"price": float("nan")}, {"quotes": [float("inf")]}, {"x": float("-inf")}, {1: "wrong key"}, {"notJson": {"set"}}, {"x": "\ud800"}])
def test_nonfinite_and_non_json_inputs_never_write(tmp_path, payload):
    store = EvidenceStore(tmp_path / "untouched")
    with pytest.raises(EvidenceValidationError):
        store.record(kind="quote", source="public", payload=payload)
    assert not store.workspace.exists()


@pytest.mark.parametrize("url", [
    "file:///tmp/source", "ftp://example.org/file", "javascript:alert(1)", "https://user:secret@example.org/data",
    "https://example.org/quote?api_key=never-print-this", "https://example.org/quote?key=never-print-this",
    "https://example.org/quote?API%5FKEY=never-print-this", "https://example.org:${BROKEN}/data", "https://example.org:99999/data",
])
def test_unsafe_source_urls_do_not_write_or_disclose_credentials(tmp_path, url):
    store = EvidenceStore(tmp_path / "untouched")
    with pytest.raises(EvidenceValidationError) as error:
        _record(store, source_url=url)
    assert "never-print-this" not in str(error.value)
    assert "secret@example" not in str(error.value)
    assert not store.workspace.exists()


@pytest.mark.parametrize("payload", [
    {"headers": {"Authorization": "Bearer never-print-this"}}, {"env": {"API_KEY": "never-print-this"}},
    {"API-Key": "never-print-this"}, {"nested": [{"token": "never-print-this"}]},
    {"url": "https://example.org/data?token=never-print-this"}, {"error": "api_key=never-print-this"},
    {"error": "Bearer never-print-this"}, {"url": "${SECRET_ENDPOINT}"},
])
def test_sensitive_payloads_are_rejected_without_leaking_input(tmp_path, payload):
    store = EvidenceStore(tmp_path / "untouched")
    with pytest.raises(EvidenceValidationError) as error:
        store.record(kind="quote", source="public", payload=payload)
    assert "never-print-this" not in str(error.value)
    assert "SECRET_ENDPOINT" not in str(error.value)
    assert not store.workspace.exists()


@pytest.mark.parametrize("field", ["observed_at", "published_at", "retrieved_at"])
def test_source_timestamps_must_have_timezone(tmp_path, field):
    with pytest.raises(EvidenceValidationError, match="timezone"):
        _record(EvidenceStore(tmp_path / "untouched"), **{field: "2026-10-03T10:00:00"})
    assert not (tmp_path / "untouched").exists()


@pytest.mark.parametrize("existing", [b"not a sqlite database\x00private", b""])
def test_corrupt_or_empty_existing_database_is_never_overwritten(tmp_path, existing):
    store = EvidenceStore(tmp_path)
    store.directory.mkdir(parents=True)
    store.path.write_bytes(existing)
    for action in (lambda: _record(store), lambda: store.get(UNKNOWN_ID), store.list_records):
        with pytest.raises(EvidenceStoreError):
            action()
        assert store.path.read_bytes() == existing


def test_sql_updates_are_denied_and_tampered_payloads_fail_verification(tmp_path):
    store = EvidenceStore(tmp_path)
    record = _record(store)
    with sqlite3.connect(store.path) as database:
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            database.execute("UPDATE evidence SET content_digest='changed'")
        database.execute("DROP TRIGGER immutable_evidence_update")
        changed = record.to_dict()
        changed["payload"]["price"] = 1000
        database.execute("UPDATE evidence SET document=?", (canonical_json(changed),))
        database.execute("CREATE TRIGGER immutable_evidence_update BEFORE UPDATE ON evidence BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END")
    with pytest.raises(EvidenceStoreError, match="verification"):
        store.get(record.evidence_id)
    with pytest.raises(EvidenceStoreError):
        _record(store)


def test_symlink_escape_is_rejected_and_outside_files_remain_untouched(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "data").symlink_to(outside, target_is_directory=True)
    store = EvidenceStore(workspace)
    with pytest.raises(EvidenceStoreError, match="workspace"):
        _record(store)
    with pytest.raises(EvidenceStoreError):
        store.list_records()
    assert list(outside.iterdir()) == []


def _process_record(arguments):
    workspace, index = arguments
    record = EvidenceStore(Path(workspace)).record(kind="quote", source="process", payload={"price": index % 4})
    return record.evidence_id


def test_threads_and_processes_deduplicate_without_lost_records(tmp_path):
    def thread_record(index):
        return EvidenceStore(tmp_path).record(kind="quote", source="thread", payload={"price": index % 5}).evidence_id

    with ThreadPoolExecutor(max_workers=8) as executor:
        thread_ids = list(executor.map(thread_record, range(40)))
    with ProcessPoolExecutor(max_workers=4, mp_context=multiprocessing.get_context("spawn")) as executor:
        process_ids = list(executor.map(_process_record, [(str(tmp_path), index) for index in range(16)]))
    store = EvidenceStore(tmp_path)
    assert len(set(thread_ids)) == 5
    assert len(set(process_ids)) == 4
    assert len(store.list_records()) == 9
    assert all(store.verify(evidence_id) for evidence_id in set(thread_ids + process_ids))


def test_processes_can_initialize_store_concurrently(tmp_path):
    with ProcessPoolExecutor(max_workers=4, mp_context=multiprocessing.get_context("spawn")) as executor:
        ids = list(executor.map(_process_record, [(str(tmp_path), index) for index in range(12)]))
    assert len(set(ids)) == len(EvidenceStore(tmp_path).list_records()) == 4
    assert not list(EvidenceStore(tmp_path).directory.glob(".ledger-*"))


def test_tool_readonly_annotations_and_roundtrip(tmp_path):
    async def exercise():
        store = EvidenceStore(tmp_path)
        record_tool, get_tool, list_tool = EvidenceRecordTool(store), EvidenceGetTool(store), EvidenceListTool(store)
        assert record_tool.read_only is False
        assert get_tool.read_only is list_tool.read_only is True
        assert json.loads(await list_tool.execute()) == {"records": [], "count": 0}
        assert not store.directory.exists()
        result = json.loads(await record_tool.execute(kind="user_note", source="user", payload={"text": "growth hypothesis"}, symbols=["SPY"]))
        evidence_id = result["evidence"]["evidenceId"]
        assert result["evidence"]["observedAt"] is None
        assert json.loads(await get_tool.execute(evidence_id)) == {"found": True, "evidence": result["evidence"]}
        store.bind_claim("claim:one", [evidence_id])
        assert json.loads(await list_tool.execute(claimId="claim:one"))["records"] == [result["evidence"]]
        invalid = json.loads(await record_tool.execute(kind="quote", source="public", payload={"headers": {"x-api-key": "never-print-this"}}))
        assert invalid["error"]["code"] == "invalid_evidence"
        assert "never-print-this" not in json.dumps(invalid)
        assert json.loads(await get_tool.execute(UNKNOWN_ID)) == {"found": False, "evidence": None}

    asyncio.run(exercise())

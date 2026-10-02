"""Thesis identity must retain Unicode content and preserve legacy references."""

import json
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from multiprocessing import get_context
from pathlib import Path

import pytest

from marketbot.domain.market.thesis import (
    ThesisRecord,
    ThesisStorageError,
    ThesisStore,
    make_thesis_id,
)


def test_distinct_chinese_theses_for_same_symbol_do_not_merge(tmp_path):
    store = ThesisStore(tmp_path)

    demand = store.create_thesis(symbol="NVDA", thesis="人工智能需求持续增长")
    margin = store.create_thesis(symbol="NVDA", thesis="利润率面临竞争压力")

    assert demand.id != margin.id
    assert len(store.list_theses()) == 2
    assert store.get_thesis(demand.id).thesis == "人工智能需求持续增长"
    assert store.get_thesis(margin.id).thesis == "利润率面临竞争压力"


def test_long_ascii_theses_with_same_slug_prefix_remain_distinct(tmp_path):
    store = ThesisStore(tmp_path)
    shared = "AI infrastructure demand stays resilient while capex guidance and supplier orders " * 3

    upside = store.create_thesis(symbol="NVDA", thesis=shared + "support upside")
    downside = store.create_thesis(symbol="NVDA", thesis=shared + "reveal downside")

    assert upside.id != downside.id
    assert len(upside.id) <= 80
    assert len(downside.id) <= 80
    assert len(store.list_theses()) == 2


def test_normalized_identity_is_stable_after_store_reconstruction(tmp_path):
    store = ThesisStore(tmp_path)
    original = store.create_thesis(symbol="nvda", thesis="  AI capex\nremains strong  ", confidence=0.7)

    rebuilt = ThesisStore(tmp_path)
    repeated = rebuilt.create_thesis(symbol=" NVDA ", thesis="AI   capex remains strong", confidence=0.2)

    assert repeated.id == original.id
    assert repeated.confidence == 0.7
    assert repeated.history == original.history
    assert len(rebuilt.list_theses()) == 1
    assert make_thesis_id(" nvda ", "AI capex remains strong") == original.id


def _write_legacy_record(workspace, *, thesis="人工智能需求持续增长"):
    legacy = ThesisRecord(id="nvda", symbol="NVDA", thesis=thesis, confidence=0.7)
    path = workspace / "data" / "theses.json"
    path.write_text(json.dumps([legacy.to_dict()], ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def test_creating_existing_legacy_thesis_reuses_original_id_without_rewriting(tmp_path):
    store = ThesisStore(tmp_path)
    path = _write_legacy_record(tmp_path)
    before = path.read_bytes()

    repeated = store.create_thesis(symbol=" nvda ", thesis=" 人工智能需求持续增长 ", confidence=0.2)

    assert repeated.id == "nvda"
    assert repeated.confidence == 0.7
    assert path.read_bytes() == before
    assert len(ThesisStore(tmp_path).list_theses()) == 1


def test_legacy_id_remains_readable_and_updateable(tmp_path):
    store = ThesisStore(tmp_path)
    _write_legacy_record(tmp_path)

    assert store.get_thesis("nvda").thesis == "人工智能需求持续增长"
    updated = store.update_thesis("nvda", status="inactive", verdict="weakened", note="复查订单", evidence="订单低于预期")

    assert updated.id == "nvda"
    assert updated.status == "inactive"
    assert updated.history[-1]["evidence"] == "订单低于预期"
    assert ThesisStore(tmp_path).get_thesis("nvda").status == "inactive"


def test_new_chinese_thesis_does_not_reuse_colliding_legacy_slug(tmp_path):
    store = ThesisStore(tmp_path)
    _write_legacy_record(tmp_path)

    new = store.create_thesis(symbol="NVDA", thesis="利润率面临竞争压力")

    assert new.id != "nvda"
    assert new.id.startswith("nvda-")
    assert store.get_thesis("nvda").thesis == "人工智能需求持续增长"
    assert len(store.list_theses()) == 2


def test_hash_preserves_punctuation_and_full_symbol_identity():
    assert make_thesis_id("NVDA", "Revenue + margin") != make_thesis_id("NVDA", "Revenue - margin")
    assert make_thesis_id("00700.HK", "收入持续增长") != make_thesis_id("00700", "收入持续增长")


def test_confidence_zero_survives_reloading_and_updates(tmp_path):
    record = ThesisStore(tmp_path).create_thesis(symbol="NVDA", thesis="待验证", confidence=0)
    assert ThesisStore(tmp_path).get_thesis(record.id).confidence == 0
    updated = ThesisStore(tmp_path).update_thesis(record.id, note="仍然未知")
    assert updated.confidence == 0
    assert ThesisRecord.from_dict(updated.to_dict()).confidence == 0


@pytest.mark.parametrize("broken", ["not JSON", "{}", '[{"id":"nvda"}]', '[{"id":"nvda","symbol":"NVDA","thesis":"x","confidence":NaN}]'])
def test_corrupt_storage_never_silently_disappears_or_gets_overwritten(tmp_path, broken):
    store = ThesisStore(tmp_path)
    path = tmp_path / "data" / "theses.json"
    path.write_text(broken, encoding="utf-8")
    for operation in (store.list_theses, lambda: store.create_thesis(symbol="AMD", thesis="新论点"),
                      lambda: store.update_thesis("nvda", note="尝试更新")):
        with pytest.raises(ThesisStorageError, match="not overwritten"):
            operation()
        assert path.read_text(encoding="utf-8") == broken


def test_failed_atomic_replacement_keeps_previous_file_and_cleans_temporary_files(tmp_path, monkeypatch):
    store = ThesisStore(tmp_path)
    record = store.create_thesis(symbol="NVDA", thesis="价格守住支撑")
    path = tmp_path / "data" / "theses.json"
    before = path.read_bytes()

    def fail(*args):
        raise OSError("replacement denied")

    monkeypatch.setattr("marketbot.domain.market.thesis.os.replace", fail)
    with pytest.raises(ThesisStorageError, match="previous file was preserved"):
        store.update_thesis(record.id, status="inactive")
    assert path.read_bytes() == before
    assert not list(path.parent.glob(".theses-*.tmp"))


def _increment_thesis_confidence(arguments):
    workspace, thesis_id, sequence = arguments
    record = ThesisStore(Path(workspace)).update_thesis(thesis_id, confidence_delta=.01, note=f"review {sequence}")
    return record.id


def test_simultaneous_thread_updates_preserve_every_history_event(tmp_path):
    store = ThesisStore(tmp_path)
    record = store.create_thesis(symbol="NVDA", thesis="持续跟踪", confidence=0)
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(_increment_thesis_confidence, [(str(tmp_path), record.id, i) for i in range(24)]))
    reloaded = store.get_thesis(record.id)
    assert reloaded.confidence == pytest.approx(.24)
    assert len(reloaded.history) == 25
    assert len({event["note"] for event in reloaded.history[1:]}) == 24


def test_simultaneous_process_updates_do_not_lose_history_or_confidence(tmp_path):
    store = ThesisStore(tmp_path)
    record = store.create_thesis(symbol="NVDA", thesis="进程间持续跟踪", confidence=0)
    with ProcessPoolExecutor(max_workers=3, mp_context=get_context("spawn")) as executor:
        list(executor.map(_increment_thesis_confidence, [(str(tmp_path), record.id, i) for i in range(12)]))
    reloaded = store.get_thesis(record.id)
    assert reloaded.confidence == pytest.approx(.12)
    assert len(reloaded.history) == 13


def test_concurrent_identical_creations_keep_one_stable_record(tmp_path):
    with ThreadPoolExecutor(max_workers=8) as executor:
        records = list(executor.map(lambda _: ThesisStore(tmp_path).create_thesis(symbol="NVDA", thesis="中文论点"), range(16)))
    assert len({record.id for record in records}) == 1
    assert len(ThesisStore(tmp_path).list_theses()) == 1

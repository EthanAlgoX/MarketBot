"""Financial monitoring must stay quiet, preserve truth, and survive restarts."""

import json
import multiprocessing
import sqlite3
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from threading import Barrier

import pytest

from marketbot.agent.tools.registry import ToolRegistry
from marketbot.agent.tools.watch import MarketWatchTool
from marketbot.domain.market import watch as watch_module
from marketbot.domain.market.evidence import EvidenceStore
from marketbot.domain.market.watch import WatchStore

NOW = "2026-10-03T01:00:00Z"
LATER = "2026-10-03T01:01:00Z"
STALE = "2026-10-02T01:00:00Z"


def _quote(workspace, price="100", symbol="AAPL", currency="USD", observed_at=NOW, source="fixture-provider", **extra):
    raw = {"symbol": symbol, "price": price, "currency": currency, "source": source, "observedAt": observed_at, **extra}
    record = EvidenceStore(workspace).record(kind="quote", source=source, payload=raw, symbols=[symbol], observed_at=observed_at)
    return {**raw, "evidenceIds": [record.evidence_id]}


def _fx(workspace, currency="USD", rate="7", observed_at=NOW):
    raw = {"currency": currency, "baseCurrency": "CNY", "rate": rate, "source": "fixture-FX", "observedAt": observed_at}
    record = EvidenceStore(workspace).record(kind="fx", source="fixture-FX", payload=raw, observed_at=observed_at)
    return {key: value for key, value in {**raw, "evidenceIds": [record.evidence_id]}.items() if key not in {"currency", "baseCurrency"}}


def _holding(quote, quantity="10"):
    return {**quote, "quantity": quantity, "priceType": "market"}


def _watch(workspace, **kwargs):
    store = WatchStore(workspace)
    result = store.save(name="Core watch", symbols=["AAPL"], rules=[{"type": "price_change", "thresholdPct": "5", "direction": "either"}], **kwargs)
    assert result["ok"], result
    return store, result["watch"]["watchId"]


def _state(store, watch_id):
    return store.get(watch_id)["watch"]["state"]


def test_baseline_is_quiet_and_price_threshold_has_no_duplicate_alerts(tmp_path):
    store, watch_id = _watch(tmp_path)
    initial = store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    assert initial["ok"] and initial["status"] == "baseline_established"
    assert initial["alerts"] == []
    assert EvidenceStore(tmp_path).get(initial["evidenceIds"][0]).observed_at is None
    assert store.evaluate(watch_id, observations=[_quote(tmp_path, "104")], as_of=NOW)["alerts"] == []
    triggered = store.evaluate(watch_id, observations=[_quote(tmp_path, "105")], as_of=NOW)
    assert triggered["alerts"][0]["status"] == "up"
    assert triggered["observations"][0]["valuePct"] == "5"
    assert _state(store, watch_id)["baselinePrices"]["AAPL"]["price"] == "100"
    assert store.evaluate(watch_id, observations=[_quote(tmp_path, "110")], as_of=NOW)["alerts"] == []
    assert len(store.outbox()["alerts"]) == 1
    assert store.ack(triggered["alerts"][0]["alertId"])["ok"]
    assert store.outbox()["alerts"] == []
    assert store.evaluate(watch_id, observations=[_quote(tmp_path, "110")], as_of=NOW)["alerts"] == []
    assert len(store.outbox(include_acknowledged=True)["alerts"]) == 1


def test_clear_and_repeat_crossing_are_separate_episodes_across_restart(tmp_path):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    first = store.evaluate(watch_id, observations=[_quote(tmp_path, "106")], as_of=NOW)["alerts"][0]
    recovered = WatchStore(tmp_path)
    assert recovered.evaluate(watch_id, observations=[_quote(tmp_path, "106")], as_of=NOW)["alerts"] == []
    clear = recovered.evaluate(watch_id, observations=[_quote(tmp_path, "104")], as_of=NOW)["alerts"][0]
    second = recovered.evaluate(watch_id, observations=[_quote(tmp_path, "106")], as_of=NOW)["alerts"][0]
    assert clear["status"] == "clear" and second["status"] == "up"
    assert first["alertId"] != second["alertId"]
    assert len(recovered.outbox()["alerts"]) == 3


@pytest.mark.parametrize("direction,price,expected", [("up", "95", "clear"), ("down", "105", "clear"), ("down", "95", "down"), ("either", "95", "down")])
def test_direction_is_explicit(tmp_path, direction, price, expected):
    store = WatchStore(tmp_path)
    saved = store.save(name="Direction", symbols=["AAPL"], rules=[{"type": "price_change", "thresholdPct": "5", "direction": direction}])
    watch_id = saved["watch"]["watchId"]
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    result = store.evaluate(watch_id, observations=[_quote(tmp_path, price)], as_of=NOW)
    assert result["observations"][0]["status"] == expected
    assert bool(result["alerts"]) == (expected != "clear")


def test_aliases_use_one_symbol_and_decimal_threshold_is_exact(tmp_path):
    store = WatchStore(tmp_path)
    saved = store.save(name="HK", symbols=["hk00700"], rules=[{"type": "price_change", "symbol": "0700.HK", "thresholdPct": "0.00000001"}])
    watch_id = saved["watch"]["watchId"]
    store.evaluate(watch_id, observations=[_quote(tmp_path, "0.1", "700", "HKD")], as_of=NOW)
    result = store.evaluate(watch_id, observations=[_quote(tmp_path, "0.10000000001", "00700.HK", "HKD")], as_of=NOW)
    assert result["alerts"][0]["symbol"] == "00700.HK"
    assert result["alerts"][0]["valuePct"] == "0.00000001"
    duplicate = store.save(name="Duplicate", symbols=["700", "0700.HK"])
    assert not duplicate["ok"]


@pytest.mark.parametrize("change,expected", [({"observedAt": None}, "missing_observation_time"), ({"source": None}, "missing_source"), ({"evidenceIds": []}, "missing_evidence"), ({"observedAt": STALE}, "stale_observation")])
def test_missing_and_stale_inputs_do_not_replace_valid_state_and_gap_deduplicates(tmp_path, change, expected):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    before = _state(store, watch_id)
    bad = {**_quote(tmp_path, "200", observed_at=STALE if change.get("observedAt") == STALE else NOW), **change}
    first = store.evaluate(watch_id, observations=[bad], as_of=NOW)
    second = store.evaluate(watch_id, observations=[bad], as_of=LATER)
    assert not first["ok"] and first["status"] == "data_gap"
    assert any(row["code"] == expected for row in first["dataGaps"])
    assert first["valuation"] is None and not first["baselineAdvanced"]
    assert first["alerts"][0]["type"] == "data_gap" and second["alerts"] == []
    after = _state(store, watch_id)
    for field in ("baselinePrices", "lastSnapshot", "ruleStates", "configRevision"):
        assert before[field] == after[field]


def test_missing_quote_does_not_reuse_old_price(tmp_path):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    result = store.evaluate(watch_id, observations=[], as_of=LATER)
    assert result["dataGaps"] == [{"code": "missing_quote", "symbol": "AAPL"}]
    assert "price" not in result["observations"][0]


@pytest.mark.parametrize("alter", [{"price": "200"}, {"currency": "CNY"}, {"observedAt": LATER}, {"source": "other-provider"}])
def test_existent_evidence_id_does_not_authorize_changed_quote_values(tmp_path, alter):
    store, watch_id = _watch(tmp_path)
    good = _quote(tmp_path)
    store.evaluate(watch_id, observations=[good], as_of=NOW)
    before = store.get(watch_id)["watch"]
    result = store.evaluate(watch_id, observations=[{**good, **alter}], as_of=LATER)
    assert not result["ok"] and result["error"]["type"] == "invalid_watch_evidence"
    assert store.get(watch_id)["watch"] == before
    assert store.outbox()["alerts"] == []


def test_evidence_snapshot_rows_bind_provider_time_and_aliases(tmp_path):
    store = WatchStore(tmp_path)
    watch_id = store.save(name="A share", symbols=["600519"], rules=[])["watch"]["watchId"]
    raw = {"symbol": "SH600519", "price": 100, "currency": "CNY", "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind="market_snapshot", source="market_snapshot", payload={"source": "tencent_cn", "asOf": LATER, "quotes": [raw]})
    result = store.evaluate(watch_id, observations=[{**raw, "symbol": "600519.SS", "source": "tencent_cn"}], evidence_ids=[evidence.evidence_id], as_of=LATER)
    assert result["ok"] and result["inputEvidenceIds"] == [evidence.evidence_id]
    stored = EvidenceStore(tmp_path).get(result["evidenceIds"][0])
    assert list(stored.derived_from) == [evidence.evidence_id]


def test_retrieval_time_is_never_accepted_as_observation_time(tmp_path):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD"}
    evidence = EvidenceStore(tmp_path).record(kind="market_snapshot", source="fixture-provider", payload={"asOf": NOW, "quotes": [raw]}, retrieved_at=NOW)
    result = store.evaluate(watch_id, observations=[{**raw, "source": "fixture-provider", "observedAt": NOW}], evidence_ids=[evidence.evidence_id], as_of=NOW)
    assert not result["ok"] and result["error"]["type"] == "invalid_watch_evidence"
    assert _state(store, watch_id) == {}


def test_cross_currency_weight_rule_cash_and_quantity_change(tmp_path):
    store = WatchStore(tmp_path)
    usd = _holding(_quote(tmp_path))
    fx = _fx(tmp_path)
    saved = store.save(name="Portfolio", kind="portfolio", holdings=[usd], base_currency="CNY", cash=[{"currency": "CNY", "amount": "7000"}], fx_rates={"USD": fx}, rules=[{"type": "max_weight", "thresholdPct": "55"}])
    assert saved["ok"]
    watch_id = saved["watch"]["watchId"]
    initial = store.evaluate(watch_id, as_of=NOW)
    assert initial["ok"] and initial["valuation"]["totalValue"] == "14000"
    assert initial["observations"][0]["valuePct"] == "50"
    result = store.evaluate(watch_id, observations=[_quote(tmp_path, "130")], as_of=NOW)
    assert len(result["alerts"]) == 1 and result["alerts"][0]["type"] == "max_weight"
    assert Decimal(result["alerts"][0]["valuePct"]) > Decimal("55")
    updated = store.evaluate(watch_id, holdings=[_holding(_quote(tmp_path, "130"), "11")], cash=[{"currency": "CNY", "amount": "7000"}], as_of=NOW)
    assert [alert["type"] for alert in updated["alerts"]] == ["position_change"]
    assert updated["alerts"][0]["positions"] == {"AAPL": "11"}


def test_complete_snapshot_requires_cash_and_missing_fx_has_no_partial_total(tmp_path):
    store = WatchStore(tmp_path)
    position = _holding(_quote(tmp_path))
    saved = store.save(name="Portfolio", kind="portfolio", holdings=[position], base_currency="CNY", cash=[{"currency": "CNY", "amount": "1000"}], fx_rates={"USD": _fx(tmp_path)})
    watch_id = saved["watch"]["watchId"]
    store.evaluate(watch_id, as_of=NOW)
    before = _state(store, watch_id)
    missing_cash = store.evaluate(watch_id, holdings=[{**position, "quantity": "11"}], as_of=NOW)
    assert not missing_cash["ok"] and _state(store, watch_id) == before
    missing_fx = store.evaluate(watch_id, fx_rates={}, as_of=NOW)
    assert not missing_fx["ok"] and missing_fx["status"] == "data_gap"
    assert missing_fx["valuation"] is None
    assert _state(store, watch_id)["lastSnapshot"] == before["lastSnapshot"]
    assert any(row["code"] == "missing_fx_rate" for row in missing_fx["dataGaps"])
    invalid_save = store.save(name="Invalid", kind="portfolio", holdings=[position], base_currency="CNY", cash=[{"currency": "HKD", "amount": "1000"}], fx_rates={"USD": _fx(tmp_path)})
    assert not invalid_save["ok"] and len(store.list()["watches"]) == 1


def test_stale_and_forged_fx_do_not_advance_state(tmp_path):
    store = WatchStore(tmp_path)
    saved = store.save(name="FX", kind="portfolio", holdings=[_holding(_quote(tmp_path))], base_currency="CNY", fx_rates={"USD": _fx(tmp_path)})
    watch_id = saved["watch"]["watchId"]
    store.evaluate(watch_id, as_of=NOW)
    before = _state(store, watch_id)
    forged = {**_fx(tmp_path), "rate": "8"}
    assert not store.evaluate(watch_id, fx_rates={"USD": forged}, as_of=NOW)["ok"]
    assert _state(store, watch_id) == before
    stale = store.evaluate(watch_id, fx_rates={"USD": _fx(tmp_path, observed_at=STALE)}, as_of=NOW)
    assert stale["status"] == "data_gap" and stale["valuation"] is None
    assert _state(store, watch_id)["lastSnapshot"] == before["lastSnapshot"]


def test_weight_threshold_uses_unrounded_decimal_not_display_metric(tmp_path):
    store = WatchStore(tmp_path)
    saved = store.save(name="Precision", kind="portfolio", holdings=[_holding(_quote(tmp_path, "1"), "1")], base_currency="USD", cash=[{"currency": "USD", "amount": "1"}], rules=[{"type": "max_weight", "thresholdPct": "50.000000001"}])
    watch_id = saved["watch"]["watchId"]
    store.evaluate(watch_id, as_of=NOW)
    result = store.evaluate(watch_id, observations=[_quote(tmp_path, "1.0000000001")], as_of=NOW)
    assert result["valuation"]["holdings"][0]["weightPct"] == "50"
    assert result["alerts"][0]["status"] == "breached"


@pytest.mark.parametrize("price", ["NaN", "Infinity", "-1", "0", True, "1e100", "1.123456789012345678901234567890"])
def test_invalid_numbers_cannot_corrupt_state(tmp_path, price):
    store, watch_id = _watch(tmp_path)
    quote = _quote(tmp_path)
    store.evaluate(watch_id, observations=[quote], as_of=NOW)
    before = store.get(watch_id)["watch"]
    result = store.evaluate(watch_id, observations=[{**quote, "price": price}], as_of=NOW)
    assert not result["ok"] and store.get(watch_id)["watch"] == before


@pytest.mark.parametrize("rule", [{"type": "max_weight", "thresholdPct": "40"}, {"type": "price_change", "thresholdPct": "0"}, {"type": "freshness", "maxAgeSeconds": "NaN"}, {"type": "price_change", "thresholdPct": "5", "symbol": "MSFT"}, {"type": "unknown"}, {"type": "price_change", "thresholdPct": "5", "ignored": True}])
def test_invalid_rules_do_not_overwrite_saved_definition(tmp_path, rule):
    store, watch_id = _watch(tmp_path)
    before = store.get(watch_id)["watch"]
    result = store.save(name="Core watch", watch_id=watch_id, symbols=["AAPL"], rules=[rule])
    assert not result["ok"] and store.get(watch_id)["watch"] == before


def test_save_update_and_disable_preserve_baselines_and_audit(tmp_path):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    same = store.save(name="Core watch", symbols=["AAPL"], rules=[{"type": "price_change", "thresholdPct": "5", "direction": "either"}])
    assert not same["changed"]
    changed = store.save(name="Core watch", watch_id=watch_id, symbols=["AAPL"], rules=[{"type": "price_change", "thresholdPct": "4"}])
    assert changed["watch"]["revision"] == 2
    evaluated = store.evaluate(watch_id, observations=[_quote(tmp_path, "104")], as_of=NOW)
    assert {row["type"] for row in evaluated["alerts"]} == {"configuration_change", "price_change"}
    assert _state(store, watch_id)["baselinePrices"]["AAPL"]["price"] == "100"
    history = len(store.get(watch_id)["watch"]["history"])
    assert store.remove(watch_id)["ok"]
    assert store.list()["watches"] == [] and len(store.list(include_inactive=True)["watches"]) == 1
    assert not store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)["ok"]
    assert len(store.get(watch_id)["watch"]["history"]) == history + 1
    assert len(store.outbox()["alerts"]) == 2


def test_concurrent_evaluations_commit_one_threshold_transition(tmp_path):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    quote = _quote(tmp_path, "106")
    def evaluate(_):
        return WatchStore(tmp_path).evaluate(watch_id, observations=[quote], as_of=NOW)
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(evaluate, range(8)))
    assert all(result["ok"] for result in results)
    assert sum(len(result["alerts"]) for result in results) == 1
    assert len(store.outbox()["alerts"]) == 1


def test_timestamp_rewind_is_rejected_and_old_source_data_is_a_gap(tmp_path):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path, observed_at=LATER)], as_of=LATER)
    before = _state(store, watch_id)
    rewind = store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    assert not rewind["ok"] and _state(store, watch_id) == before
    old_quote = store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=LATER)
    assert old_quote["status"] == "data_gap"
    assert any(gap["code"] == "out_of_order_observation" for gap in old_quote["dataGaps"])


@pytest.mark.asyncio
async def test_tool_registry_actions_and_corrupt_store_are_explicit(tmp_path):
    tool = MarketWatchTool(tmp_path)
    registry = ToolRegistry()
    registry.register(tool)
    saved = json.loads(await registry.execute("market_watch", {"action": "save", "name": "CLI", "symbols": ["AAPL"], "rules": [{"type": "price_change", "thresholdPct": "5"}]}))
    watch_id = saved["watch"]["watchId"]
    result = json.loads(await registry.execute("market_watch", {"action": "evaluate", "watchId": watch_id, "observations": [_quote(tmp_path)], "asOf": NOW}))
    assert result["ok"] and result["alerts"] == []
    assert not json.loads(await tool.execute(action="ack"))["ok"]
    path = tool.store.path
    original = b"preserve corrupted watch file"
    path.write_bytes(original)
    failure = json.loads(await tool.execute(action="list"))
    assert not failure["ok"] and failure["error"]["type"] == "watch_storage_error"
    assert path.read_bytes() == original


def test_watch_reads_do_not_create_files_and_unknown_schema_is_preserved(tmp_path):
    store = WatchStore(tmp_path)
    assert store.list()["watches"] == []
    assert store.outbox()["alerts"] == []
    assert not store.get("missing")["ok"]
    assert not store.path.exists() and not (tmp_path / "data").exists()
    store.save(name="Read-only", symbols=["AAPL"])
    with sqlite3.connect(store.path) as connection:
        connection.execute("UPDATE metadata SET value='99' WHERE key='schema_version'")
    content = store.path.read_bytes()
    for action in (store.list, lambda: store.save(name="Unknown schema", symbols=["AAPL"])):
        with pytest.raises(ValueError, match="Unsupported"):
            action()
        assert store.path.read_bytes() == content


@pytest.mark.parametrize("original", [b"", b"preserve damaged watch database"])
def test_existing_empty_or_corrupt_database_is_never_initialized_or_modified(tmp_path, original):
    store = WatchStore(tmp_path)
    store.path.parent.mkdir(parents=True)
    store.path.write_bytes(original)
    actions = (store.list, store.outbox, lambda: store.get("missing"),
               lambda: store.save(name="Preserve", symbols=["AAPL"]),
               lambda: store.remove("missing"), lambda: store.ack("missing"))
    for action in actions:
        with pytest.raises((ValueError, sqlite3.DatabaseError)):
            action()
        assert store.path.read_bytes() == original
    assert not list(store.path.parent.glob(".market-watch-*"))


def test_foreign_watch_database_is_preserved_for_reads_and_writes(tmp_path):
    store = WatchStore(tmp_path)
    store.path.parent.mkdir(parents=True)
    with sqlite3.connect(store.path) as connection:
        connection.execute("PRAGMA application_id=12345")
        connection.execute("CREATE TABLE foreign_data (value TEXT)")
        connection.execute("INSERT INTO foreign_data VALUES ('preserve')")
    original = store.path.read_bytes()
    for action in (store.list, lambda: store.save(name="Foreign", symbols=["AAPL"])):
        with pytest.raises(ValueError, match="Foreign"):
            action()
        assert store.path.read_bytes() == original


@pytest.mark.parametrize("suffix", ["", "-journal", "-wal", "-shm"])
def test_watch_database_and_sidecar_symlinks_cannot_modify_outside_files(tmp_path, suffix):
    workspace = tmp_path / "workspace"
    store = WatchStore(workspace)
    store.path.parent.mkdir(parents=True)
    outside = tmp_path / "outside.sqlite3"
    original = b"preserve external file"
    outside.write_bytes(original)
    target = Path(str(store.path) + suffix)
    target.symlink_to(outside)
    for action in (store.list, lambda: store.save(name="Boundary", symbols=["AAPL"])):
        with pytest.raises(ValueError, match="unsafe"):
            action()
        assert outside.read_bytes() == original
        assert target.is_symlink()
    assert not list(store.path.parent.glob(".market-watch-*"))


def test_watch_data_directory_symlink_is_rejected_without_external_writes(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (workspace / "data").symlink_to(outside, target_is_directory=True)
    store = WatchStore(workspace)
    for action in (store.list, lambda: store.save(name="Boundary", symbols=["AAPL"])):
        with pytest.raises(ValueError, match="workspace"):
            action()
        assert list(outside.iterdir()) == []


@pytest.mark.parametrize("suffix", ["", "-journal", "-wal", "-shm"])
def test_watch_database_and_sidecars_must_be_regular_files(tmp_path, suffix):
    store = WatchStore(tmp_path)
    target = Path(str(store.path) + suffix)
    target.mkdir(parents=True)
    for action in (store.list, lambda: store.save(name="Boundary", symbols=["AAPL"])):
        with pytest.raises(ValueError, match="unsafe"):
            action()
        assert target.is_dir()
        assert list(target.iterdir()) == []


@pytest.mark.parametrize("suffix", ["-journal", "-wal", "-shm"])
def test_disappearing_watch_sqlite_sidecars_do_not_reject_valid_store(tmp_path, monkeypatch, suffix):
    store, watch_id = _watch(tmp_path)
    sidecar = Path(str(store.path) + suffix)
    sidecar.write_bytes(b"transient")
    original_lstat = Path.lstat

    def disappearing_lstat(path, *args, **kwargs):
        metadata = original_lstat(path, *args, **kwargs)
        if path == sidecar:
            sidecar.unlink()
        return metadata

    monkeypatch.setattr(Path, "lstat", disappearing_lstat)
    assert store.get(watch_id)["ok"]
    assert not sidecar.exists()


def test_concurrent_first_watch_databases_are_published_only_after_full_initialization(tmp_path, monkeypatch):
    ready = Barrier(8)
    original_link = watch_module.os.link

    def publish(source, destination, *args, **kwargs):
        with sqlite3.connect(Path(source).as_uri() + "?mode=ro", uri=True) as connection:
            assert connection.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0] == "1"
            assert connection.execute("PRAGMA application_id").fetchone()[0] == watch_module._APPLICATION_ID
            assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        ready.wait(timeout=10)
        return original_link(source, destination, *args, **kwargs)

    monkeypatch.setattr(watch_module.os, "link", publish)
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda index: WatchStore(tmp_path).save(name=f"Atomic {index}", symbols=["AAPL"]), range(8)))
    assert all(result["ok"] for result in results)
    assert len(WatchStore(tmp_path).list()["watches"]) == 8
    assert not list((tmp_path / "data").glob(".market-watch-*"))


def _process_save_watch(arguments):
    workspace, index = arguments
    return WatchStore(Path(workspace)).save(name=f"Process {index}", symbols=["AAPL"])


def test_processes_can_initialize_watch_storage_without_losing_definitions(tmp_path):
    with ProcessPoolExecutor(max_workers=4, mp_context=multiprocessing.get_context("spawn")) as executor:
        results = list(executor.map(_process_save_watch, [(str(tmp_path), index) for index in range(12)]))
    assert all(result["ok"] for result in results)
    assert len(WatchStore(tmp_path).list()["watches"]) == 12
    assert not list((tmp_path / "data").glob(".market-watch-*"))


def test_evidence_failure_rolls_back_watch_state_and_outbox(tmp_path, monkeypatch):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    before = store.get(watch_id)["watch"]
    quote = _quote(tmp_path, "106")
    def fail(**kwargs):
        raise OSError("fixture persistence failure")
    monkeypatch.setattr(store.evidence, "record", fail)
    with pytest.raises(OSError):
        store.evaluate(watch_id, observations=[quote], as_of=NOW)
    assert store.get(watch_id)["watch"] == before
    assert store.outbox()["alerts"] == []


def test_audit_write_failure_rolls_back_alert_and_baseline_atomically(tmp_path, monkeypatch):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    before = store.get(watch_id)["watch"]
    quote = _quote(tmp_path, "106")
    def fail(connection, watch_id, action, at, payload):
        raise sqlite3.OperationalError("fixture audit write failure")
    monkeypatch.setattr(store, "_audit", fail)
    with pytest.raises(sqlite3.OperationalError):
        store.evaluate(watch_id, observations=[quote], as_of=NOW)
    assert store.get(watch_id)["watch"] == before
    assert store.outbox()["alerts"] == []


def test_concurrent_first_saves_never_reset_existing_definitions(tmp_path):
    def save(index):
        return WatchStore(tmp_path).save(name=f"Watch {index}", symbols=["AAPL"])
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(save, range(8)))
    assert all(result["ok"] for result in results)
    assert len(WatchStore(tmp_path).list()["watches"]) == 8


@pytest.mark.parametrize("quality", [{"derived": True}, {"status": "estimated"}, {"priceType": "estimate"}, {"priceType": "estimated"}, {"synthetic": True}, {"mocked": True}, {"isForecast": True}, {"hypothetical": True}])
def test_actual_timestamp_cannot_turn_derived_or_estimated_evidence_into_quote(tmp_path, quality):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD", "source": "fixture-provider", "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind="quote", source="fixture-provider", payload=raw, observed_at=NOW, quality=quality)
    before = store.get(watch_id)["watch"]
    result = store.evaluate(watch_id, observations=[{**raw, "evidenceIds": [evidence.evidence_id]}], as_of=NOW)
    assert not result["ok"] and result["error"]["type"] == "invalid_watch_evidence"
    assert store.get(watch_id)["watch"] == before and store.outbox()["alerts"] == []


@pytest.mark.parametrize("extra", [{"priceType": "estimate"}, {"hypothetical": True}, {"synthetic": True}])
def test_derived_marker_in_evidence_payload_cannot_be_hidden_by_observation(tmp_path, extra):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD", "source": "fixture-provider", "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind="quote", source="fixture-provider", payload={**raw, **extra}, observed_at=NOW)
    result = store.evaluate(watch_id, observations=[{**raw, "evidenceIds": [evidence.evidence_id]}], as_of=NOW)
    assert not result["ok"] and _state(store, watch_id) == {}


def test_estimated_fx_cannot_establish_cross_currency_portfolio_baseline(tmp_path):
    store = WatchStore(tmp_path)
    raw = {"currency": "USD", "rate": "7", "source": "fixture-FX", "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind="fx", source="fixture-FX", payload=raw, observed_at=NOW, quality={"derived": True})
    fx = {**raw, "evidenceIds": [evidence.evidence_id]}
    watch_id = store.save(name="Derived FX", kind="portfolio", holdings=[_holding(_quote(tmp_path))], base_currency="CNY", fx_rates={"USD": fx})["watch"]["watchId"]
    result = store.evaluate(watch_id, as_of=NOW)
    assert not result["ok"] and _state(store, watch_id) == {}


def test_container_derived_marker_applies_to_nested_quotes(tmp_path):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD", "source": "fixture-provider", "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind="tool_result", source="fixture-provider", payload={"quotes": [raw], "derived": True}, observed_at=NOW)
    result = store.evaluate(watch_id, observations=[{**raw, "evidenceIds": [evidence.evidence_id]}], as_of=NOW)
    assert not result["ok"] and _state(store, watch_id) == {}


@pytest.mark.parametrize("kind,source", [("portfolio_risk", "fixture-provider"), ("risk_scenario", "fixture-provider"), ("valuation", "fixture-provider"), ("quote", "risk_scenario"), ("quote", "Mocked")])
def test_calculated_financial_outputs_and_simulated_sources_are_not_observed_quotes(tmp_path, kind, source):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD", "source": source, "observedAt": NOW}
    evidence = EvidenceStore(tmp_path).record(kind=kind, source=source, payload=raw, observed_at=NOW)
    result = store.evaluate(watch_id, observations=[{**raw, "evidenceIds": [evidence.evidence_id]}], as_of=NOW)
    assert not result["ok"] and _state(store, watch_id) == {}


@pytest.mark.parametrize("missing", ["price", "currency"])
def test_missing_quote_field_is_an_explicit_gap_and_preserves_baseline(tmp_path, missing):
    store, watch_id = _watch(tmp_path)
    store.evaluate(watch_id, observations=[_quote(tmp_path)], as_of=NOW)
    before = _state(store, watch_id)
    raw = {"symbol": "AAPL", "price": "106", "currency": "USD", "source": "fixture-provider", "observedAt": NOW, missing: None}
    evidence = EvidenceStore(tmp_path).record(kind="quote", source="fixture-provider", payload=raw, observed_at=NOW)
    observation = {**raw, "evidenceIds": [evidence.evidence_id]}
    result = store.evaluate(watch_id, observations=[observation], as_of=NOW)
    assert result["status"] == "data_gap" and result["valuation"] is None
    assert result["dataGaps"] == [{"code": f"missing_{missing}", "symbol": "AAPL"}]
    assert not result["baselineAdvanced"] and result["observations"][1]["status"] == "data_gap"
    assert _state(store, watch_id)["baselinePrices"] == before["baselinePrices"]
    assert _state(store, watch_id)["lastSnapshot"] == before["lastSnapshot"]
    assert store.evaluate(watch_id, observations=[observation], as_of=NOW)["alerts"] == []


@pytest.mark.parametrize("target", [None, "EUR", "USD", "CNY"])
@pytest.mark.parametrize("container", [False, True])
def test_fx_evidence_binds_both_sides_of_currency_pair(tmp_path, target, container):
    store = WatchStore(tmp_path)
    raw = {"currency": "USD", "rate": "7", "source": "fixture-FX", "observedAt": NOW}
    payload = {"fxRates": {"USD": raw}} if container else dict(raw)
    if target is not None:
        payload["baseCurrency"] = target
    record = EvidenceStore(tmp_path).record(kind="fx", source="fixture-FX", payload=payload, observed_at=NOW)
    fx = {"rate": "7", "source": "fixture-FX", "observedAt": NOW, "evidenceIds": [record.evidence_id]}
    watch_id = store.save(name="Currency pair", kind="portfolio", holdings=[_holding(_quote(tmp_path))], base_currency="CNY", fx_rates={"USD": fx})["watch"]["watchId"]
    result = store.evaluate(watch_id, as_of=NOW)
    if target == "CNY":
        assert result["ok"] and result["valuation"]["totalValue"] == "7000"
    else:
        assert not result["ok"] and result["error"]["type"] == "invalid_watch_evidence"
        assert _state(store, watch_id) == {} and store.outbox()["alerts"] == []


@pytest.mark.parametrize("missing", ["observedAt", "source"])
def test_explicit_unknown_fact_provenance_does_not_borrow_container_value(tmp_path, missing):
    store, watch_id = _watch(tmp_path)
    raw = {"symbol": "AAPL", "price": "100", "currency": "USD", "source": "fixture-provider", "observedAt": NOW, missing: None}
    record = EvidenceStore(tmp_path).record(kind="quote", source="fixture-provider", payload={"quotes": [raw], "source": "fixture-provider", "observedAt": NOW}, observed_at=NOW)
    observation = {**raw, missing: NOW if missing == "observedAt" else "fixture-provider", "evidenceIds": [record.evidence_id]}
    result = store.evaluate(watch_id, observations=[observation], as_of=NOW)
    assert not result["ok"] and _state(store, watch_id) == {}

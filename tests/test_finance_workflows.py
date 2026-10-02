"""CLI, collection, evidence and scheduled watch integration without external I/O."""

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from typer.testing import CliRunner

from marketbot.agent.tools import market as market_tools
from marketbot.cli import finance_runtime, gateway_runtime
from marketbot.config.loader import save_config
from marketbot.config.schema import Config
from marketbot.cron.service import CronService
from marketbot.cron.types import CronJob, CronPayload, CronSchedule
from marketbot.domain.market.evidence import EvidenceStore
from marketbot.domain.market.watch import WatchStore


@pytest.fixture
def finance_setup(tmp_path, monkeypatch):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")
    config.tools.market.snapshot_max_symbols = 2
    config_path = tmp_path / "config.json"
    save_config(config, config_path)
    observations = SimpleNamespace(price="100", timestamp=datetime.now(UTC).isoformat(), omit=set(), calls=[])

    class Snapshot(market_tools.MarketSnapshotTool):
        def __init__(self, config=None, workspace=None):
            self.config = config

        async def execute(self, symbols, **kwargs):
            observations.calls.append(list(symbols))
            rows = [{"symbol": symbol, "price": observations.price, "currency": "USD", "provider": "fixture-provider", "observedAt": observations.timestamp} for symbol in symbols if symbol not in observations.omit]
            return json.dumps({"source": "fixture-provider", "asOf": datetime.now(UTC).isoformat(), "symbols": symbols, "quotes": rows, "warnings": [], "missingSymbols": sorted(observations.omit.intersection(symbols))})

    monkeypatch.setattr(market_tools, "MarketSnapshotTool", Snapshot)
    return config, config_path, observations


def _save_watch(config, *, symbols=None):
    result = WatchStore(config.workspace_path).save(name="Research monitor", symbols=symbols or ["AAPL"], rules=[{"type": "price_change", "thresholdPct": "5"}])
    assert result["ok"]
    return result["watch"]["watchId"]


def _invoke(config_path, arguments):
    return CliRunner().invoke(finance_runtime.finance_app, [*arguments, "--config", str(config_path)])


def test_cli_call_save_evaluate_and_ack_without_llm(finance_setup, tmp_path):
    config, config_path, _ = finance_setup
    input_file = tmp_path / "arguments.json"
    input_file.write_text(json.dumps({"action": "save", "name": "CLI watch", "symbols": ["AAPL"], "rules": [{"type": "price_change", "thresholdPct": "5"}]}))
    saved = _invoke(config_path, ["call", "market_watch", "--input", str(input_file)])
    assert saved.exit_code == 0, saved.output
    watch_id = json.loads(saved.stdout)["watch"]["watchId"]
    for price in ("100", "105"):
        quote = {"symbol": "AAPL", "price": price, "currency": "USD", "source": "fixture-provider", "observedAt": datetime.now(UTC).isoformat()}
        evidence = EvidenceStore(config.workspace_path).record(kind="quote", source="fixture-provider", payload=quote)
        input_file.write_text(json.dumps({"action": "evaluate", "watchId": watch_id, "observations": [{**quote, "evidenceIds": [evidence.evidence_id]}]}))
        evaluated = _invoke(config_path, ["call", "market_watch", "--input", str(input_file)])
        assert evaluated.exit_code == 0, evaluated.output
    alert = json.loads(evaluated.stdout)["alerts"][0]
    assert alert["status"] == "up" and EvidenceStore(config.workspace_path).get(alert["evidenceIds"][0])
    input_file.write_text(json.dumps({"action": "ack", "alertId": alert["alertId"]}))
    assert _invoke(config_path, ["call", "market_watch", "--input", str(input_file)]).exit_code == 0
    assert WatchStore(config.workspace_path).outbox()["alerts"] == []


def test_cli_call_invalid_definition_exits_unsuccessfully_and_preserves_state(finance_setup, tmp_path):
    config, config_path, _ = finance_setup
    watch_id = _save_watch(config)
    before = WatchStore(config.workspace_path).get(watch_id)
    input_file = tmp_path / "invalid.json"
    input_file.write_text(json.dumps({"action": "save", "watchId": watch_id, "name": "Invalid", "symbols": ["AAPL"], "rules": [{"type": "price_change", "thresholdPct": "NaN"}]}))
    result = _invoke(config_path, ["call", "market_watch", "--input", str(input_file)])
    assert result.exit_code == 1 and json.loads(result.stdout)["ok"] is False
    assert WatchStore(config.workspace_path).get(watch_id) == before


def test_cli_schedule_persists_watch_scope_and_rejects_duplicate(finance_setup):
    config, config_path, _ = finance_setup
    watch_id = _save_watch(config)
    result = _invoke(config_path, ["schedule", watch_id, "--every-minutes", "7"])
    assert result.exit_code == 0, result.output
    persisted = CronService(config.workspace_path / "cron" / "jobs.json").list_jobs()[0]
    assert persisted.payload.kind == "finance_watch" and persisted.payload.scope_key == watch_id
    assert persisted.schedule.every_ms == 7 * 60_000 and not persisted.payload.deliver
    duplicate = _invoke(config_path, ["schedule", watch_id])
    assert duplicate.exit_code != 0
    assert len(CronService(config.workspace_path / "cron" / "jobs.json").list_jobs()) == 1


def test_schedule_requires_explicit_enabled_delivery_and_active_watch(finance_setup):
    config, config_path, _ = finance_setup
    watch_id = _save_watch(config)
    missing_target = _invoke(config_path, ["schedule", watch_id, "--deliver"])
    disabled_channel = _invoke(config_path, ["schedule", watch_id, "--deliver", "--channel", "telegram", "--to", "fixture-chat"])
    assert missing_target.exit_code != 0 and disabled_channel.exit_code != 0
    assert not (config.workspace_path / "cron" / "jobs.json").exists()
    WatchStore(config.workspace_path).remove(watch_id)
    assert _invoke(config_path, ["schedule", watch_id]).exit_code != 0


def test_schedule_does_not_overwrite_corrupt_existing_cron_store(finance_setup):
    config, config_path, _ = finance_setup
    watch_id = _save_watch(config)
    path = config.workspace_path / "cron" / "jobs.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = b'{"version": 1, "jobs": [broken existing scheduled jobs'
    path.write_bytes(existing)
    result = _invoke(config_path, ["schedule", watch_id])
    assert result.exit_code != 0
    assert path.read_bytes() == existing


@pytest.mark.asyncio
async def test_poll_batches_over_native_limit_and_binds_every_quote(finance_setup):
    config, _, observations = finance_setup
    symbols = ["AAPL", "MSFT", "NVDA", "SPY", "AMD"]
    watch_id = _save_watch(config, symbols=symbols)
    initial = await finance_runtime.poll_watch(config, watch_id)
    assert initial["ok"] and initial["status"] == "baseline_established", initial
    assert observations.calls == [symbols[:2], symbols[2:4], symbols[4:]]
    assert len(initial["observations"]) == 5
    inputs = [EvidenceStore(config.workspace_path).get(evidence_id) for evidence_id in initial["inputEvidenceIds"]]
    assert len(inputs) == 5 and all(record.observed_at for record in inputs)
    observations.price = "105"
    triggered = await finance_runtime.poll_watch(config, watch_id)
    assert len(triggered["alerts"]) == 5
    assert {row["symbol"] for row in triggered["alerts"]} == set(symbols)
    assert (await finance_runtime.poll_watch(config, watch_id))["alerts"] == []


@pytest.mark.asyncio
async def test_poll_unknown_source_time_is_gap_and_missing_quote_cannot_advance(finance_setup):
    config, _, observations = finance_setup
    watch_id = _save_watch(config, symbols=["AAPL", "MSFT"])
    assert (await finance_runtime.poll_watch(config, watch_id))["ok"]
    before = WatchStore(config.workspace_path).get(watch_id)["watch"]["state"]["lastSnapshot"]
    observations.timestamp = None
    gap = await finance_runtime.poll_watch(config, watch_id)
    assert not gap["ok"] and gap["status"] == "data_gap"
    assert any(row["code"] == "missing_observation_time" for row in gap["dataGaps"])
    observations.timestamp = datetime.now(UTC).isoformat()
    observations.omit.add("MSFT")
    missing = await finance_runtime.poll_watch(config, watch_id)
    assert any(row["code"] == "missing_quote" for row in missing["dataGaps"])
    assert WatchStore(config.workspace_path).get(watch_id)["watch"]["state"]["lastSnapshot"] == before


@pytest.mark.asyncio
async def test_poll_disabled_tools_or_watch_never_collects(finance_setup):
    config, _, observations = finance_setup
    watch_id = _save_watch(config)
    config.tools.market.enabled = False
    assert not (await finance_runtime.poll_watch(config, watch_id))["ok"]
    assert observations.calls == []
    config.tools.market.enabled = True
    WatchStore(config.workspace_path).remove(watch_id)
    assert not (await finance_runtime.poll_watch(config, watch_id))["ok"]
    assert observations.calls == []


def _handler(config_path, config, bus):
    return gateway_runtime.create_cron_job_handler(
        config_path=config_path, bus=bus, agent=SimpleNamespace(workspace=config.workspace_path),
        open_intel_db=lambda path: (_ for _ in ()).throw(AssertionError("finance watch must not invoke intel DB")),
        collect_intel_sources=None, render_intel_collect_summary=None, build_intel_daily_digest=None,
    )


def _job(watch_id, *, deliver=False):
    return CronJob(id="fixture-watch-job", name="Fixture", schedule=CronSchedule(kind="every", every_ms=60000),
                   payload=CronPayload(kind="finance_watch", scope_key=watch_id, deliver=deliver, channel="telegram" if deliver else None, to="fixture-chat" if deliver else None))


class _Bus:
    def __init__(self, *, fail=False):
        self.messages = []
        self.fail = fail

    async def publish_outbound(self, message):
        if self.fail:
            raise RuntimeError("fixture queue failure")
        self.messages.append(message)


@pytest.mark.asyncio
async def test_local_cron_is_quiet_until_change_and_does_not_repeat_pending_alert(finance_setup):
    config, config_path, observations = finance_setup
    watch_id = _save_watch(config)
    bus = _Bus()
    handler = _handler(config_path, config, bus)
    job = _job(watch_id)
    assert await handler(job) is None
    observations.price = "106"
    changed = await handler(job)
    assert json.loads(changed)["alerts"][0]["status"] == "up"
    assert await handler(job) is None and bus.messages == []
    assert len(WatchStore(config.workspace_path).outbox()["alerts"]) == 1


@pytest.mark.asyncio
async def test_gap_cron_reports_once_without_fabricating_values(finance_setup):
    config, config_path, observations = finance_setup
    watch_id = _save_watch(config)
    bus = _Bus()
    handler = _handler(config_path, config, bus)
    job = _job(watch_id)
    assert await handler(job) is None
    observations.timestamp = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    first_gap = await handler(job)
    assert json.loads(first_gap)["alerts"][0]["type"] == "data_gap"
    assert await handler(job) is None and bus.messages == []


@pytest.mark.asyncio
async def test_delivery_enqueue_is_not_ack_and_restart_replays_stable_id(finance_setup):
    config, config_path, observations = finance_setup
    config.channels.telegram.enabled = True
    save_config(config, config_path)
    watch_id = _save_watch(config)
    bus = _Bus()
    handler = _handler(config_path, config, bus)
    job = _job(watch_id, deliver=True)
    assert await handler(job) is None
    observations.price = "106"
    await handler(job)
    first_alert = json.loads(bus.messages[0].content)["alerts"][0]
    assert len(WatchStore(config.workspace_path).outbox()["alerts"]) == 1
    assert await handler(job) is None and len(bus.messages) == 1
    restarted = _handler(config_path, config, bus)
    await restarted(job)
    second_alert = json.loads(bus.messages[1].content)["alerts"][0]
    assert first_alert["alertId"] == second_alert["alertId"]
    WatchStore(config.workspace_path).ack(first_alert["alertId"])
    assert await _handler(config_path, config, bus)(job) is None


@pytest.mark.asyncio
async def test_delivery_failure_keeps_outbox_pending_and_disabled_channel_does_not_drop(finance_setup):
    config, config_path, observations = finance_setup
    config.channels.telegram.enabled = True
    save_config(config, config_path)
    watch_id = _save_watch(config)
    failing = _Bus(fail=True)
    handler = _handler(config_path, config, failing)
    job = _job(watch_id, deliver=True)
    assert await handler(job) is None
    observations.price = "106"
    with pytest.raises(RuntimeError):
        await handler(job)
    store = WatchStore(config.workspace_path)
    assert len(store.outbox()["alerts"]) == 1
    config.channels.telegram.enabled = False
    save_config(config, config_path)
    with pytest.raises(RuntimeError):
        await _handler(config_path, config, _Bus())(job)
    assert len(store.outbox()["alerts"]) == 1

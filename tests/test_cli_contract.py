"""Public CLI configuration, diagnostics, and native scheduler contracts."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from typer.main import get_command
from typer.testing import CliRunner

import marketbot.cli.commands as commands
from marketbot.bus.events import InboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.cli.gateway_runtime import (
    NativeCronService,
    NativeJobsRequiredError,
    create_cron_job_handler,
    run_native_gateway_services,
)
from marketbot.cli.status_runtime import build_channels_status_payload, build_status_payload
from marketbot.config.loader import configuration_scope, get_config_path, load_config, save_config
from marketbot.config.schema import Config
from marketbot.cron.service import CronService
from marketbot.cron.types import CronPayload, CronSchedule


@pytest.fixture
def isolated_cli(tmp_path, monkeypatch):
    home = tmp_path / "home"
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    return CliRunner(), home


def write_config(path, workspace):
    config = Config()
    config.agents.defaults.workspace = str(workspace)
    save_config(config, path)
    return config


def test_all_command_help_entrypoints_are_available(isolated_cli):
    runner, home = isolated_cli
    checked = []

    def walk(command, parts=()):
        result = runner.invoke(commands.app, [*parts, "--help"])
        assert result.exit_code == 0, (parts, result.stdout, result.exception)
        checked.append(parts)
        for name, child in getattr(command, "commands", {}).items():
            walk(child, (*parts, name))

    walk(get_command(commands.app))
    assert len(checked) >= 50
    assert not home.exists()


def test_global_config_workspace_and_cli_invocations_do_not_leak(tmp_path, isolated_cli):
    runner, home = isolated_cli
    config_path = tmp_path / "config.json"
    workspace = tmp_path / "configured"
    override = tmp_path / "override"
    write_config(config_path, workspace)
    original = config_path.read_bytes()
    first = runner.invoke(commands.app, ["--config", str(config_path), "--workspace", str(override), "intel", "source-add", "--type", "rss", "--name", "Local feed", "--url", "http://127.0.0.1/feed.xml"])
    assert first.exit_code == 0, first.exception
    assert (override / "data" / "intel.db").is_file()
    assert not workspace.exists()
    assert config_path.read_bytes() == original
    assert get_config_path() == home / ".marketbot" / "config.json"
    second = runner.invoke(commands.app, ["--config", str(config_path), "status", "--json"])
    assert second.exit_code == 0, second.exception
    assert json.loads(second.stdout)["workspace"]["path"] == str(workspace)
    assert not workspace.exists()
    assert not home.exists()


def test_local_config_option_overrides_global_path(tmp_path, isolated_cli):
    runner, _home = isolated_cli
    global_path, local_path = tmp_path / "global.json", tmp_path / "local.json"
    write_config(global_path, tmp_path / "global-workspace")
    write_config(local_path, tmp_path / "local-workspace")
    result = runner.invoke(commands.app, ["--config", str(global_path), "status", "--config", str(local_path), "--json"])
    assert result.exit_code == 0, result.exception
    assert json.loads(result.stdout)["workspace"]["path"] == str(tmp_path / "local-workspace")
    missing_global = runner.invoke(commands.app, ["--config", str(tmp_path / "missing.json"), "status", "--config", str(local_path), "--json"])
    assert missing_global.exit_code == 0, missing_global.exception


def test_global_onboard_creates_custom_config_and_preserves_refresh(tmp_path, isolated_cli):
    runner, home = isolated_cli
    path, workspace = tmp_path / "settings.json", tmp_path / "research"
    result = runner.invoke(commands.app, ["--config", str(path), "--workspace", str(workspace), "onboard"])
    assert result.exit_code == 0, result.exception
    config = load_config(path)
    assert config.workspace_path == workspace
    assert (workspace / "AGENTS.md").is_file()
    config.agents.defaults.model = "custom/kept-model"
    save_config(config, path)
    refreshed = runner.invoke(commands.app, ["--config", str(path), "onboard", "--refresh"])
    assert refreshed.exit_code == 0, refreshed.exception
    assert load_config(path).agents.defaults.model == "custom/kept-model"
    assert not home.exists()


@pytest.mark.parametrize("bad_config", ["missing", "directory", "invalid"])
def test_explicit_config_errors_never_fall_back_or_leak_scope(tmp_path, isolated_cli, bad_config):
    runner, home = isolated_cli
    path = tmp_path / "bad-config"
    if bad_config == "directory":
        path.mkdir()
    elif bad_config == "invalid":
        path.write_text('{"agents":{"defaults":{"maxTokens":"private-input"}}}')
    result = runner.invoke(commands.app, ["--config", str(path), "intel", "source-list"])
    assert result.exit_code == 2
    assert "private-input" not in result.stdout
    assert get_config_path() == home / ".marketbot" / "config.json"
    assert not home.exists()


async def test_configuration_scopes_are_independent_between_async_tasks(tmp_path):
    async def inspect(name):
        path = tmp_path / f"{name}.json"
        write_config(path, tmp_path / "unused")
        with configuration_scope(path, tmp_path / name):
            await asyncio.sleep(0)
            return get_config_path(), load_config().workspace_path

    assert await asyncio.gather(inspect("one"), inspect("two")) == [
        (tmp_path / "one.json", tmp_path / "one"), (tmp_path / "two.json", tmp_path / "two"),
    ]


def test_status_reports_oauth_unknown_and_matrix_without_credentials(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "absent")
    config.channels.matrix.enabled = True
    config.channels.matrix.access_token = "never-display-this"
    status = build_status_payload(config, tmp_path / "missing.json")
    oauth = [provider for provider in status["providers"] if provider["type"] == "oauth"]
    assert oauth and all(provider["configured"] is None and provider["authenticationStatus"] == "not_checked" for provider in oauth)
    channels = build_channels_status_payload(config)
    matrix = next(channel for channel in channels["channels"] if channel["name"] == "matrix")
    assert matrix["enabled"] and matrix["configuration"]["accessTokenConfigured"]
    assert "never-display-this" not in json.dumps(channels)
    assert not config.workspace_path.exists()


@pytest.mark.parametrize("flags,kind", [(["--every-minutes", "5"], "every"), ([], "cron")])
def test_intel_daily_schedule_selects_interval_or_default_cron(tmp_path, isolated_cli, flags, kind):
    runner, _home = isolated_cli
    path, workspace = tmp_path / "config.json", tmp_path / "workspace"
    write_config(path, workspace)
    result = runner.invoke(commands.app, ["--config", str(path), "intel", "schedule-daily", *flags])
    assert result.exit_code == 0, result.exception
    job = CronService(workspace / "cron" / "jobs.json").list_jobs()[0]
    assert job.schedule.kind == kind
    assert job.state.next_run_at_ms is not None


@pytest.mark.parametrize("command", [
    ["schedule-collect", "--cron-expr", "not-a-cron"],
    ["schedule-latest-daily", "--digest-cron-expr", "not-a-cron"],
    ["schedule-collect", "--cron-expr", "* * * * *", "--tz", "Invalid/Zone"],
    ["source-add", "--type", "unknown", "--name", "bad", "--url", "https://example.com"],
    ["source-add", "--type", "rss", "--name", "bad", "--url", "file:///secret.xml"],
])
def test_invalid_intel_commands_fail_before_persisting(tmp_path, isolated_cli, command):
    runner, _home = isolated_cli
    path, workspace = tmp_path / "config.json", tmp_path / "workspace"
    write_config(path, workspace)
    result = runner.invoke(commands.app, ["--config", str(path), "intel", *command])
    assert result.exit_code == 2
    assert not workspace.exists()


async def test_gateway_intel_jobs_use_runtime_workspace_and_close_database(tmp_path):
    opened, closed = [], []
    connection = SimpleNamespace(close=lambda: closed.append(True))
    workspace = tmp_path / "overridden"

    def open_db(path, *, workspace):
        opened.append((path, workspace))
        return None, connection

    async def collect(conn, **kwargs):
        assert conn is connection
        return []

    handler = create_cron_job_handler(config_path=tmp_path / "config.json", workspace=workspace, agent=None, native_only=True, bus=MessageBus(), open_intel_db=open_db, collect_intel_sources=collect, render_intel_collect_summary=lambda _results: "collected", build_intel_daily_digest=lambda *args, **kwargs: None)
    assert await handler(SimpleNamespace(payload=CronPayload(kind="intel_collect"))) == "collected"
    assert opened == [(tmp_path / "config.json", workspace)]
    assert closed == [True]


async def test_scheduled_intel_collection_marks_total_failure(tmp_path):
    closed = []

    async def collect(*args, **kwargs):
        return [SimpleNamespace(ok=False)]

    handler = create_cron_job_handler(config_path=None, agent=None, native_only=True, bus=MessageBus(), open_intel_db=lambda _path: (None, SimpleNamespace(close=lambda: closed.append(True))), collect_intel_sources=collect, render_intel_collect_summary=lambda _results: "must not report success", build_intel_daily_digest=lambda *args, **kwargs: None)
    with pytest.raises(RuntimeError, match="All intel sources failed"):
        await handler(SimpleNamespace(payload=CronPayload(kind="intel_collect")))
    assert closed == [True]


async def test_native_cron_rejects_model_jobs_without_consuming_one_shot(tmp_path):
    path = tmp_path / "cron" / "jobs.json"
    writer = CronService(path)
    job = writer.add_job("model task", CronSchedule(kind="at", at_ms=10**15), "needs LLM", delete_after_run=True)
    native = NativeCronService(path)
    with pytest.raises(NativeJobsRequiredError):
        native.validate_jobs()
    original = path.read_bytes()
    await native._execute_job(job)
    assert native.blocked.is_set()
    assert native.blocked_error is not None
    assert job.enabled and job.state.last_status is None
    assert path.read_bytes() == original
    assert CronService(path).list_jobs()[0].id == job.id


async def test_native_gateway_handles_native_jobs_rejects_chat_and_cleans_up(tmp_path):
    bus = MessageBus()
    cron = NativeCronService(tmp_path / "cron" / "jobs.json")
    job = cron.add_job("collect", CronSchedule(kind="every", every_ms=60_000), "", payload=CronPayload(kind="intel_collect"))
    executed, stopped = [], []

    async def on_job(item):
        executed.append(item.id)

    async def start_channels():
        await asyncio.Event().wait()

    async def stop_channels():
        stopped.append(True)

    cron.on_job = on_job
    channels = SimpleNamespace(start_all=start_channels, stop_all=stop_channels)
    task = asyncio.create_task(run_native_gateway_services(bus=bus, channels=channels, cron=cron))
    await asyncio.sleep(0)
    await cron._execute_job(job)
    await bus.publish_inbound(InboundMessage(channel="cli", sender_id="u", chat_id="c", content="hello"))
    response = await asyncio.wait_for(bus.consume_outbound(), timeout=1)
    assert "Chat requires a model-enabled gateway" in response.content
    assert response.chat_id == "c"
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert executed == [job.id]
    assert not cron._running
    assert stopped == [True]


async def test_native_scheduler_external_model_job_stops_runner_and_preserves_job(tmp_path, monkeypatch):
    now = [1000]
    monkeypatch.setitem(CronService.add_job.__globals__, "_now_ms", lambda: now[0])
    path = tmp_path / "cron" / "jobs.json"
    native = NativeCronService(path)
    bus = MessageBus()

    async def channels_start():
        await asyncio.Event().wait()

    async def channels_stop():
        pass

    channels = SimpleNamespace(start_all=channels_start, stop_all=channels_stop)
    task = asyncio.create_task(run_native_gateway_services(bus=bus, channels=channels, cron=native))
    await asyncio.sleep(0)
    writer = CronService(path)
    job = writer.add_job("external LLM task", CronSchedule(kind="at", at_ms=1001), "requires model", delete_after_run=True)
    now[0] = 1002
    await native._on_timer()
    with pytest.raises(NativeJobsRequiredError, match="job was preserved"):
        await asyncio.wait_for(task, timeout=1)
    saved = CronService(path).list_jobs()[0]
    assert saved.id == job.id and saved.enabled
    assert saved.state.last_status is None and saved.state.last_run_at_ms is None


def test_finance_only_cli_skips_provider_and_heartbeat(tmp_path, isolated_cli, monkeypatch):
    import marketbot.cli.gateway_runtime as gateway_runtime

    runner, _home = isolated_cli
    path, workspace = tmp_path / "config.json", tmp_path / "workspace"
    write_config(path, workspace)
    monkeypatch.setattr(commands, "build_agent_runtime", lambda *args, **kwargs: pytest.fail("LLM runtime must not start"))
    started = []

    async def start_native(**kwargs):
        started.append(kwargs)

    monkeypatch.setattr(gateway_runtime, "run_native_gateway_services", start_native)
    result = runner.invoke(commands.app, ["--config", str(path), "gateway", "--finance-only"])
    assert result.exit_code == 0, result.exception
    assert "LLM chat and heartbeat disabled" in result.stdout
    assert "No HTTP listener" in result.stdout
    assert len(started) == 1


def test_market_report_passes_workspace_to_finance_tool(tmp_path, isolated_cli, monkeypatch):
    import marketbot.agent.tools.market as market_tools

    runner, _home = isolated_cli
    path, workspace = tmp_path / "config.json", tmp_path / "workspace"
    write_config(path, workspace)
    constructed = []

    class Brief:
        def __init__(self, config, *, workspace):
            constructed.append(workspace)

    def report(**kwargs):
        kwargs["market_brief_tool_factory"](kwargs["config"].tools.market)

    monkeypatch.setattr(market_tools, "MarketBriefTool", Brief)
    monkeypatch.setattr(commands, "run_market_report", report)
    result = runner.invoke(commands.app, ["--config", str(path), "market", "report", "--symbols", "SPY"])
    assert result.exit_code == 0, result.exception
    assert constructed == [workspace]

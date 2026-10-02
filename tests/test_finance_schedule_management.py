"""Documented finance job management must address the actual workspace queue."""

import json

from typer.testing import CliRunner

from marketbot.cli.finance_runtime import finance_app
from marketbot.config.loader import save_config
from marketbot.config.schema import Config
from marketbot.cron.service import CronService
from marketbot.cron.types import CronPayload, CronSchedule
from marketbot.domain.market.watch import WatchStore


def _setup(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")
    config_path = tmp_path / "config.json"
    save_config(config, config_path)
    return config, config_path


def _invoke(config_path, args):
    return CliRunner().invoke(finance_app, [*args, "--config", str(config_path)])


def test_finance_schedule_is_visible_and_removable_without_model_account(tmp_path):
    config, path = _setup(tmp_path)
    watch_id = WatchStore(config.workspace_path).save(name="CLI management", symbols=["NVDA"])["watch"]["watchId"]
    created = _invoke(path, ["schedule", watch_id, "--every-minutes", "7"])
    assert created.exit_code == 0, created.output
    job_id = json.loads(created.stdout)["jobId"]
    listed = _invoke(path, ["schedule-list"])
    assert listed.exit_code == 0, listed.output
    payload = json.loads(listed.stdout)
    assert payload["count"] == 1
    assert payload["jobs"][0]["jobId"] == job_id
    assert payload["jobs"][0]["watchId"] == watch_id
    assert payload["jobs"][0]["schedule"]["everyMs"] == 420000
    removed = _invoke(path, ["unschedule", job_id])
    assert removed.exit_code == 0, removed.output
    assert json.loads(removed.stdout)["removed"] is True
    assert json.loads(_invoke(path, ["schedule-list"]).stdout)["count"] == 0
    assert WatchStore(config.workspace_path).get(watch_id)["watch"]["active"]


def test_management_only_removes_finance_jobs_and_lists_disabled_finance_jobs(tmp_path):
    config, path = _setup(tmp_path)
    cron = CronService(config.workspace_path / "cron" / "jobs.json")
    foreign = cron.add_job("Intel", CronSchedule(kind="every", every_ms=60000), "", payload=CronPayload(kind="intel_collect"))
    finance = cron.add_job("Finance", CronSchedule(kind="every", every_ms=60000), "", payload=CronPayload(kind="finance_watch", scope_key="saved-watch"))
    cron.enable_job(finance.id, enabled=False)
    before = cron.store_path.read_bytes()
    rejected = _invoke(path, ["unschedule", foreign.id])
    assert rejected.exit_code != 0
    assert cron.store_path.read_bytes() == before
    listed = json.loads(_invoke(path, ["schedule-list"]).stdout)
    assert listed["count"] == 1 and not listed["jobs"][0]["enabled"]
    assert _invoke(path, ["unschedule", finance.id]).exit_code == 0
    assert [job.id for job in CronService(cron.store_path).list_jobs(include_disabled=True)] == [foreign.id]


def test_management_preserves_corrupt_schedule_file(tmp_path):
    config, path = _setup(tmp_path)
    store = config.workspace_path / "cron" / "jobs.json"
    store.parent.mkdir(parents=True)
    store.write_bytes(b'{"jobs": [broken')
    for command in (["schedule-list"], ["unschedule", "some-id"]):
        assert _invoke(path, command).exit_code != 0
        assert store.read_bytes() == b'{"jobs": [broken'


def test_schedule_list_on_fresh_workspace_does_not_initialize_cron_storage(tmp_path):
    config, path = _setup(tmp_path)
    listed = _invoke(path, ["schedule-list"])
    assert listed.exit_code == 0
    assert json.loads(listed.stdout) == {"jobs": [], "count": 0}
    assert not (config.workspace_path / "cron" / "jobs.json").exists()

import asyncio

import pytest

from marketbot.cron.service import CronService
from marketbot.cron.types import CronPayload, CronSchedule


def test_add_job_rejects_unknown_timezone(tmp_path) -> None:
    service = CronService(tmp_path / "cron" / "jobs.json")

    with pytest.raises(ValueError, match="unknown timezone 'America/Vancovuer'"):
        service.add_job(
            name="tz typo",
            schedule=CronSchedule(kind="cron", expr="0 9 * * *", tz="America/Vancovuer"),
            message="hello",
        )

    assert service.list_jobs(include_disabled=True) == []


def test_add_job_accepts_valid_timezone(tmp_path) -> None:
    service = CronService(tmp_path / "cron" / "jobs.json")

    job = service.add_job(
        name="tz ok",
        schedule=CronSchedule(kind="cron", expr="0 9 * * *", tz="America/Vancouver"),
        message="hello",
    )

    assert job.schedule.tz == "America/Vancouver"
    assert job.state.next_run_at_ms is not None


@pytest.mark.asyncio
async def test_running_service_honors_external_disable(tmp_path) -> None:
    store_path = tmp_path / "cron" / "jobs.json"
    called: list[str] = []

    async def on_job(job) -> None:
        called.append(job.id)

    service = CronService(store_path, on_job=on_job)
    job = service.add_job(
        name="external-disable",
        schedule=CronSchedule(kind="every", every_ms=200),
        message="hello",
    )
    await service.start()
    try:
        # Wait slightly to ensure file mtime is definitively different
        await asyncio.sleep(0.05)
        external = CronService(store_path)
        updated = external.enable_job(job.id, enabled=False)
        assert updated is not None
        assert updated.enabled is False

        await asyncio.sleep(0.35)
        assert called == []
    finally:
        service.stop()


def test_cron_payload_persists_intel_fields(tmp_path) -> None:
    store_path = tmp_path / "cron" / "jobs.json"
    service = CronService(store_path)

    job = service.add_job(
        name="intel-daily",
        schedule=CronSchedule(kind="every", every_ms=60_000),
        message="build intel digest",
    )
    job.payload = CronPayload(
        kind="intel_digest_daily",
        message="build intel digest",
        deliver=True,
        channel="telegram",
        to="chat-1",
        scope="workspace",
        scope_key="",
        hours=12,
        limit=8,
    )
    service._save_store()

    reloaded = CronService(store_path)
    loaded = reloaded.list_jobs(include_disabled=True)

    assert len(loaded) == 1
    payload = loaded[0].payload
    assert payload.kind == "intel_digest_daily"
    assert payload.deliver is True
    assert payload.channel == "telegram"
    assert payload.to == "chat-1"
    assert payload.scope == "workspace"
    assert payload.scope_key == ""
    assert payload.hours == 12
    assert payload.limit == 8


def test_corrupt_cron_file_cannot_be_overwritten_by_new_schedule(tmp_path):
    path = tmp_path / 'cron' / 'jobs.json'
    path.parent.mkdir()
    original = b'{ damaged schedule store'
    path.write_bytes(original)
    with pytest.raises(ValueError, match='not overwritten'):
        CronService(path).add_job('new', CronSchedule(kind='every', every_ms=60000), '')
    assert path.read_bytes() == original


def test_stale_writer_cannot_erase_other_process_schedule(tmp_path):
    path = tmp_path / 'cron' / 'jobs.json'
    first, second = CronService(path), CronService(path)
    first.add_job('first', CronSchedule(kind='every', every_ms=60000), '')
    second.list_jobs()
    first.add_job('concurrent', CronSchedule(kind='every', every_ms=60000), '')
    with pytest.raises(ValueError, match='concurrently'):
        second._save_store()
    assert {j.name for j in CronService(path).list_jobs()} == {'first', 'concurrent'}


@pytest.mark.asyncio
async def test_external_edit_during_job_keeps_scheduler_running(tmp_path):
    from marketbot.cron.service import _now_ms

    path = tmp_path / 'jobs.json'
    async def on_job(_job):
        CronService(path).add_job('external', CronSchedule(kind='every', every_ms=60000), '')
    service = CronService(path, on_job=on_job)
    job = service.add_job('due', CronSchedule(kind='every', every_ms=60000), '')
    job.state.next_run_at_ms = _now_ms() - 1
    service._save_store()
    service._running = True
    try:
        await service._on_timer()
        assert service._running
        assert service._timer_task is not None
        assert {j.name for j in service.list_jobs()} == {'due', 'external'}
    finally:
        service.stop()


def test_unknown_cron_version_is_preserved(tmp_path):
    import json

    path = tmp_path / 'jobs.json'
    original = json.dumps({'version': 99, 'jobs': []})
    path.write_text(original)
    with pytest.raises(ValueError, match='not overwritten'):
        CronService(path).add_job('new', CronSchedule(kind='every', every_ms=60000), '')
    assert path.read_text() == original

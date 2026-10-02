from __future__ import annotations

import json

import pytest
import typer

from marketbot.cli.intel_runtime import (
    build_cron_schedule,
    build_intel_daily_digest,
    build_source_config_json,
)


def test_build_source_config_json_wraps_url() -> None:
    payload = json.loads(build_source_config_json("https://example.com/feed.xml"))

    assert payload == {"url": "https://example.com/feed.xml"}


def test_build_intel_daily_digest_returns_created_id_not_other_recent_digest(monkeypatch):
    import marketbot.domain.intel.digest as digest_module
    import marketbot.domain.intel.storage as storage_module

    stored = object()
    monkeypatch.setattr(digest_module, "build_daily_digest", lambda *args, **kwargs: 41)
    calls = []

    def get_digest(conn, digest_id):
        calls.append(digest_id)
        return stored

    monkeypatch.setattr(storage_module, "get_digest", get_digest)
    assert build_intel_daily_digest(object(), scope="workspace", scope_key="", hours=24, limit=12) == (41, stored)
    assert calls == [41]


def test_build_cron_schedule_supports_every_minutes() -> None:
    schedule = build_cron_schedule(every_minutes=15, cron_expr=None, tz=None)

    assert schedule.kind == "every"
    assert schedule.every_ms == 15 * 60 * 1000


def test_build_cron_schedule_supports_cron_expression() -> None:
    schedule = build_cron_schedule(every_minutes=None, cron_expr="0 8 * * *", tz="Asia/Shanghai")

    assert schedule.kind == "cron"
    assert schedule.expr == "0 8 * * *"
    assert schedule.tz == "Asia/Shanghai"


@pytest.mark.parametrize(
    ("every_minutes", "cron_expr"),
    [
        (10, "0 8 * * *"),
        (0, None),
        (-5, None),
        (None, None),
    ],
)
def test_build_cron_schedule_rejects_invalid_inputs(every_minutes, cron_expr) -> None:
    with pytest.raises(typer.BadParameter):
        build_cron_schedule(every_minutes=every_minutes, cron_expr=cron_expr, tz="Asia/Shanghai")

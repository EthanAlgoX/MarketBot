from __future__ import annotations

import json

import pytest
import typer

from marketbot.cli.intel_runtime import build_cron_schedule, build_source_config_json


def test_build_source_config_json_wraps_url() -> None:
    payload = json.loads(build_source_config_json("https://example.com/feed.xml"))

    assert payload == {"url": "https://example.com/feed.xml"}


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

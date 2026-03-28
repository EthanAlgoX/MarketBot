from pathlib import Path

import pytest
import typer

from marketbot.cli.openclaw_runtime import (
    run_latest_openclaw_metrics,
    run_openclaw_metrics_server,
)


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="", end="\n") -> None:
        self.lines.append(str(text))

    def print_json(self, data=None) -> None:
        self.lines.append(str(data))


def test_run_latest_openclaw_metrics_raises_exit_when_thresholds_fail() -> None:
    console = _Console()

    with pytest.raises(typer.Exit):
        run_latest_openclaw_metrics(
            workspace=Path("/tmp/workspace"),
            index_path=None,
            min_success_rate=None,
            min_avg=None,
            min_best=None,
            max_worst=None,
            emit_github_output=False,
            emit_prometheus=False,
            json_output=False,
            console=console,
            build_latest_openclaw_metrics_payload=lambda *_args, **_kwargs: {
                "ok": False,
                "date": "20260329",
                "compareField": "score",
                "filteredCount": 1,
                "totalCount": 1,
                "successCount": 0,
                "successRate": 0.0,
                "compareSummary": {"count": 1, "avg": 0.1, "min": 0.1, "max": 0.1},
                "alertsState": {"stateCounts": {"new": 1, "ongoing": 0, "resolved": 0}},
                "alertsStatePath": "/tmp/alerts.json",
                "summaryMarkdown": "/tmp/summary.md",
                "summaryCsv": "/tmp/summary.csv",
            },
            write_latest_openclaw_metrics_github_output=lambda *_args, **_kwargs: None,
            render_latest_openclaw_metrics_prometheus=lambda _payload: "metrics",
        )

    assert any("Threshold check failed" in line for line in console.lines)


def test_run_openclaw_metrics_server_wires_callbacks() -> None:
    console = _Console()
    created = {}

    class _Server:
        base_url = "http://127.0.0.1:19101"

        def serve_forever(self):
            created["served"] = True

        def shutdown(self):
            created["shutdown"] = True

        def server_close(self):
            created["closed"] = True

    def _factory(**kwargs):
        created.update(kwargs)
        return _Server()

    run_openclaw_metrics_server(
        workspace=Path("/tmp/workspace"),
        host="127.0.0.1",
        port=19101,
        index_path=None,
        min_success_rate=0.7,
        min_avg=None,
        min_best=None,
        max_worst=None,
        console=console,
        metrics_http_server_factory=_factory,
        build_latest_openclaw_metrics_payload=lambda *_args, **_kwargs: {"alertsState": {"ok": False}},
        render_latest_openclaw_metrics_prometheus=lambda _payload: "metrics",
        build_openclaw_alerts_payload=lambda payload: payload,
        render_openclaw_alertmanager_payload=lambda payload: payload,
    )

    assert created["host"] == "127.0.0.1"
    assert created["port"] == 19101
    assert callable(created["metrics_payload_factory"])
    assert callable(created["alerts_builder"])
    assert created["served"] is True
    assert created["shutdown"] is True
    assert created["closed"] is True
    assert any("Metrics: http://127.0.0.1:19101/metrics" in line for line in console.lines)

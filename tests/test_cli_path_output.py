"""Artifact paths remain literal and copyable in narrow terminals."""

import io
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
import typer
from rich.console import Console

import marketbot.cli.openclaw_runtime as openclaw_runtime
from marketbot.cli.rl_runtime import run_rl_build_dataset


@pytest.fixture(params=[12, 20])
def narrow_console(request):
    output = io.StringIO()
    console = Console(file=output, width=request.param, force_terminal=False, color_system=None)
    return console, output


@pytest.mark.parametrize("outcome", ["planned", "succeeded", "failed"])
def test_openclaw_launch_keeps_literal_paths(tmp_path, monkeypatch, narrow_console, outcome):
    console, output = narrow_console
    bundle = tmp_path / "[bold]" / "openclaw_bundle_with_a_very_long_name"
    dataset = tmp_path / "dataset.jsonl"
    dataset.write_text("{}\n", encoding="utf-8")
    summary = SimpleNamespace(
        bundle_dir=str(bundle),
        script_path=str(bundle / "run_openclaw_train.sh"),
        remote_script_path=str(bundle / "run_openclaw_remote_env.sh"),
        env_script_path=str(bundle / "run_marketbot_env.sh"),
        to_dict=lambda: {},
    )
    index = bundle.parent / "runs_index.jsonl"
    archive = {
        "summaryMarkdown": bundle.parent / "reports" / "openclaw_comparison.md",
        "summaryCsv": bundle.parent / "reports" / "openclaw_comparison.csv",
    }
    monkeypatch.setattr(
        openclaw_runtime.subprocess, "Popen", lambda *args, **kwargs: SimpleNamespace(pid=42, poll=lambda: 0)
    )

    def run(*args, **kwargs):
        if outcome == "failed":
            raise subprocess.CalledProcessError(1, args[0])

    monkeypatch.setattr(openclaw_runtime.subprocess, "run", run)

    def launch():
        openclaw_runtime.run_openclaw_launch(
            commands_file=Path(openclaw_runtime.__file__),
            config=SimpleNamespace(workspace_path=tmp_path),
            dataset_path=dataset,
            output_dir=bundle,
            openclaw_root=None,
            remote_env=True,
            env_wait_s=0,
            dry_run=outcome == "planned",
            json_output=False,
            console=console,
            detect_openclaw_root=lambda _root: None,
            export_openclaw_bundle=lambda *args, **kwargs: summary,
            resolve_openclaw_report_paths=lambda _index: archive,
            wait_for_http_health=lambda *args: True,
            tail_text=lambda _path: "",
            classify_openclaw_launch_error=lambda *args: {"runOutcome": "failed", "exitCode": 1},
            build_openclaw_run_report=lambda _path: {},
            append_openclaw_runs_index=lambda _payload: index,
            write_openclaw_runs_archive=lambda *args, **kwargs: archive,
        )

    if outcome == "failed":
        with pytest.raises(typer.Exit):
            launch()
    else:
        launch()

    rendered = output.getvalue()
    assert f"Bundle: {bundle}\n" in rendered
    assert f"Train Script: {summary.remote_script_path}\n" in rendered
    assert f"Env Logs: {bundle / 'logs/env.stdout.log'} | {bundle / 'logs/env.stderr.log'}\n" in rendered
    assert f"Train Logs: {bundle / 'logs/train.stdout.log'} | {bundle / 'logs/train.stderr.log'}\n" in rendered
    assert f"Training Report: {bundle / 'training_report.json'}\n" in rendered
    assert f"Runs Index: {index}\n" in rendered
    assert f"Report Markdown: {archive['summaryMarkdown']}\n" in rendered
    assert f"Report CSV: {archive['summaryCsv']}\n" in rendered
    if outcome == "planned":
        assert f"Env Script: {summary.env_script_path}\n" in rendered
    if outcome == "succeeded":
        assert f"Summary: {bundle / 'run_summary.json'}\n" in rendered


def test_openclaw_comparison_keeps_literal_output_and_index_paths(tmp_path, narrow_console):
    console, output = narrow_console
    workspace = tmp_path / "[bold]" / "workspace_with_a_very_long_name"
    index = workspace / "runs_index.jsonl"
    report = workspace / "reports" / "openclaw_comparison.md"
    content = "# OpenClaw Run Comparison\n"
    openclaw_runtime.run_openclaw_compare_runs(
        workspace=workspace,
        index_path=index,
        outcome=None,
        group_by=None,
        compare_field="score",
        limit=20,
        output_format="markdown",
        output_path=report,
        console=console,
        load_jsonl_objects=lambda _path: [],
        build_runs_index_payload=lambda *args, **kwargs: {},
        render_openclaw_runs_csv=lambda _payload: "",
        render_openclaw_runs_markdown=lambda _payload: content,
    )
    assert report.read_text(encoding="utf-8") == content
    assert f"Output: {report}\n" in output.getvalue()
    assert f"Index: {index}\n" in output.getvalue()


def test_rl_dataset_keeps_literal_written_path(tmp_path, narrow_console):
    console, output = narrow_console
    target = tmp_path / "[bold]" / "market_episode_dataset_with_a_very_long_name.jsonl"
    config = SimpleNamespace(
        workspace_path=tmp_path,
        tools=SimpleNamespace(market=SimpleNamespace(policy=SimpleNamespace(rollout_log_path="rollouts.jsonl"))),
    )
    run_rl_build_dataset(
        config=config,
        input_path=None,
        output_path=target,
        dataset_type="episode",
        console=console,
        load_market_signal_rollouts=lambda _path: [{"kind": "episode"}],
        detect_rollout_type=lambda _events: "episode",
        build_market_episode_dataset_records=lambda _events: [{"id": 1}],
        build_market_signal_dataset_records=lambda _events: [],
        write_jsonl=lambda path, _records: path,
    )
    assert f"✓ Wrote 1 episode records to {target}\n" in output.getvalue()

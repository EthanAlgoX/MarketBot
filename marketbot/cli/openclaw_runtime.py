"""Shared OpenClaw launch, report, and metrics CLI helpers."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

import typer
from rich.table import Table


def run_openclaw_launch(
    *,
    commands_file: Path,
    config: Any,
    dataset_path: Path | None,
    output_dir: Path | None,
    openclaw_root: Path | None,
    remote_env: bool,
    env_wait_s: float,
    dry_run: bool,
    json_output: bool,
    console: Any,
    detect_openclaw_root: Callable[[Path], Path | None],
    export_openclaw_bundle: Callable[..., Any],
    resolve_openclaw_report_paths: Callable[[Path], dict[str, Path]],
    wait_for_http_health: Callable[[str, float], bool],
    tail_text: Callable[[Path], str],
    classify_openclaw_launch_error: Callable[[BaseException, str | None], dict[str, Any]],
    build_openclaw_run_report: Callable[[Path], dict[str, Any]],
    append_openclaw_runs_index: Callable[[dict[str, Any]], Path],
    write_openclaw_runs_archive: Callable[[Path, str], dict[str, Path]],
) -> None:
    """Export a bundle and launch the matching OpenClaw wrapper."""
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / "openclaw_export")
    marketbot_root = commands_file.resolve().parents[2]
    resolved_openclaw_root = openclaw_root or detect_openclaw_root(marketbot_root)
    summary = export_openclaw_bundle(
        source,
        target_dir,
        marketbot_root=marketbot_root,
        openclaw_root=resolved_openclaw_root,
        dry_run=dry_run,
    )

    launch_script = Path(summary.remote_script_path if remote_env else summary.script_path)
    logs_dir = Path(summary.bundle_dir) / "logs"
    env_stdout_path = logs_dir / "env.stdout.log"
    env_stderr_path = logs_dir / "env.stderr.log"
    train_stdout_path = logs_dir / "train.stdout.log"
    train_stderr_path = logs_dir / "train.stderr.log"
    summary_path = Path(summary.bundle_dir) / "run_summary.json"
    training_report_path = Path(summary.bundle_dir) / "training_report.json"
    reports_index_path = Path(summary.bundle_dir).parent / "runs_index.jsonl"
    report_archive_paths = resolve_openclaw_report_paths(reports_index_path)
    payload = summary.to_dict()
    payload["launchMode"] = "remote-env" if remote_env else "local-env"
    payload["launchScriptPath"] = str(launch_script)
    payload["envScriptPath"] = summary.env_script_path if remote_env else None
    payload["envWaitSeconds"] = env_wait_s
    payload["envHealthUrl"] = None
    if remote_env:
        default_env_host = str(os.environ.get("MARKETBOT_ENV_HOST", "127.0.0.1"))
        default_env_port = str(os.environ.get("MARKETBOT_ENV_PORT", "18080"))
        payload["envHealthUrl"] = (
            str(os.environ.get("ENV_SERVER_URL") or f"http://{default_env_host}:{default_env_port}").rstrip("/")
            + "/healthz"
        )
    payload["logPaths"] = {
        "envStdout": str(env_stdout_path) if remote_env else None,
        "envStderr": str(env_stderr_path) if remote_env else None,
        "trainStdout": str(train_stdout_path),
        "trainStderr": str(train_stderr_path),
    }
    payload["summaryPath"] = str(summary_path)
    payload["trainingReportPath"] = str(training_report_path)
    payload["reportArchive"] = {key: str(value) for key, value in report_archive_paths.items()}
    payload["runOutcome"] = "planned"
    payload["failureReason"] = None
    payload["exitCode"] = None
    payload["logTail"] = {
        "envStdout": None,
        "envStderr": None,
        "trainStdout": None,
        "trainStderr": None,
    }

    if dry_run:
        if json_output:
            console.print_json(json.dumps(payload, ensure_ascii=False))
            return
        console.print("[bold]OpenClaw Launch Plan[/bold]")
        console.print(f"Mode: {payload['launchMode']}")
        console.print(f"Bundle: {summary.bundle_dir}")
        if remote_env:
            console.print(f"Env Script: {summary.env_script_path}")
            console.print(f"Health URL: {payload['envHealthUrl']}")
            console.print(f"Env Logs: {env_stdout_path} | {env_stderr_path}")
        console.print(f"Train Script: {launch_script}")
        console.print(f"Train Logs: {train_stdout_path} | {train_stderr_path}")
        console.print(f"Training Report: {training_report_path}")
        console.print(f"Runs Index: {Path(summary.bundle_dir).parent / 'runs_index.jsonl'}")
        console.print(f"Report Markdown: {report_archive_paths['summaryMarkdown']}")
        console.print(f"Report CSV: {report_archive_paths['summaryCsv']}")
        console.print("[dim]Dry-run only: no processes were started.[/dim]")
        return

    env = os.environ.copy()
    env_process = None
    env_stdout_handle = None
    env_stderr_handle = None
    train_stdout_handle = None
    train_stderr_handle = None
    launch_error: BaseException | None = None
    launch_failure_reason: str | None = None
    try:
        logs_dir.mkdir(parents=True, exist_ok=True)
        if remote_env:
            env_host = str(env.get("MARKETBOT_ENV_HOST", "127.0.0.1"))
            env_port = str(env.get("MARKETBOT_ENV_PORT", "18080"))
            payload["envHealthUrl"] = str(env.get("ENV_SERVER_URL") or f"http://{env_host}:{env_port}").rstrip("/") + "/healthz"
            env_stdout_handle = env_stdout_path.open("a", encoding="utf-8")
            env_stderr_handle = env_stderr_path.open("a", encoding="utf-8")
            env_process = subprocess.Popen(
                ["bash", summary.env_script_path],
                cwd=summary.bundle_dir,
                env=env,
                stdout=env_stdout_handle,
                stderr=env_stderr_handle,
            )
            payload["envPid"] = env_process.pid
            if not wait_for_http_health(str(payload["envHealthUrl"]), env_wait_s):
                launch_failure_reason = "env_unhealthy"
                console.print(
                    f"[red]Env server did not become healthy within {env_wait_s:.1f}s: {payload['envHealthUrl']}[/red]"
                )
                raise typer.Exit(1)
        train_stdout_handle = train_stdout_path.open("a", encoding="utf-8")
        train_stderr_handle = train_stderr_path.open("a", encoding="utf-8")
        subprocess.run(
            ["bash", str(launch_script)],
            cwd=summary.bundle_dir,
            env=env,
            check=True,
            stdout=train_stdout_handle,
            stderr=train_stderr_handle,
        )
    except BaseException as exc:
        launch_error = exc
    finally:
        if env_process is not None and env_process.poll() is None:
            env_process.terminate()
            try:
                env_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                env_process.kill()
        for handle in (env_stdout_handle, env_stderr_handle, train_stdout_handle, train_stderr_handle):
            if handle is not None:
                handle.close()
        payload["logTail"] = {
            "envStdout": tail_text(env_stdout_path) if remote_env else None,
            "envStderr": tail_text(env_stderr_path) if remote_env else None,
            "trainStdout": tail_text(train_stdout_path),
            "trainStderr": tail_text(train_stderr_path),
        }

    if launch_error is not None:
        payload.update(classify_openclaw_launch_error(launch_error, launch_failure_reason))
        payload["status"] = "failed"
        payload["completedAt"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        payload["error"] = str(launch_error)
        summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        report_payload = build_openclaw_run_report(Path(summary.bundle_dir))
        training_report_path.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        runs_index_path = append_openclaw_runs_index(report_payload)
        report_archive = write_openclaw_runs_archive(runs_index_path, completed_at=payload["completedAt"])
        if json_output:
            console.print_json(json.dumps(payload, ensure_ascii=False))
            raise typer.Exit(1)
        console.print("[bold red]OpenClaw Launch Failed[/bold red]")
        console.print(f"Mode: {payload['launchMode']}")
        console.print(f"Bundle: {summary.bundle_dir}")
        if remote_env and "envPid" in payload:
            console.print(f"Env PID: {payload['envPid']}")
            console.print(f"Health URL: {payload['envHealthUrl']}")
            console.print(f"Env Logs: {env_stdout_path} | {env_stderr_path}")
        console.print(f"Train Script: {launch_script}")
        console.print(f"Train Logs: {train_stdout_path} | {train_stderr_path}")
        console.print(f"Training Report: {training_report_path}")
        console.print(f"Runs Index: {runs_index_path}")
        console.print(f"Report Markdown: {report_archive['summaryMarkdown']}")
        console.print(f"Report CSV: {report_archive['summaryCsv']}")
        train_stderr_tail = str(payload["logTail"].get("trainStderr") or "").strip()
        if train_stderr_tail:
            console.print("[red]Train stderr tail:[/red]")
            console.print(train_stderr_tail)
        raise typer.Exit(1)

    payload["status"] = "completed"
    payload["runOutcome"] = "succeeded"
    payload["failureReason"] = None
    payload["exitCode"] = 0
    payload["completedAt"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report_payload = build_openclaw_run_report(Path(summary.bundle_dir))
    training_report_path.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    runs_index_path = append_openclaw_runs_index(report_payload)
    report_archive = write_openclaw_runs_archive(runs_index_path, completed_at=payload["completedAt"])
    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    console.print("[bold]OpenClaw Launch[/bold]")
    console.print(f"Mode: {payload['launchMode']}")
    console.print(f"Bundle: {summary.bundle_dir}")
    if remote_env and "envPid" in payload:
        console.print(f"Env PID: {payload['envPid']}")
        console.print(f"Health URL: {payload['envHealthUrl']}")
        console.print(f"Env Logs: {env_stdout_path} | {env_stderr_path}")
        env_tail = str(payload["logTail"].get("envStdout") or "").strip()
        if env_tail:
            console.print("[dim]Env stdout tail:[/dim]")
            console.print(env_tail)
    console.print(f"Train Script: {launch_script}")
    console.print(f"Train Logs: {train_stdout_path} | {train_stderr_path}")
    console.print(f"Summary: {summary_path}")
    console.print(f"Training Report: {training_report_path}")
    console.print(f"Runs Index: {runs_index_path}")
    console.print(f"Report Markdown: {report_archive['summaryMarkdown']}")
    console.print(f"Report CSV: {report_archive['summaryCsv']}")
    train_tail = str(payload["logTail"].get("trainStdout") or "").strip()
    if train_tail:
        console.print("[dim]Train stdout tail:[/dim]")
        console.print(train_tail)
    console.print("[green]✓[/green] Launch sequence completed.")


def run_openclaw_inspect(
    *,
    bundle_dir: Path,
    json_output: bool,
    console: Any,
    build_openclaw_run_report: Callable[[Path], dict[str, Any]],
) -> None:
    """Inspect an OpenClaw export bundle, logs, and configured checkpoint directory."""
    target = Path(bundle_dir)
    if not target.exists():
        raise typer.BadParameter(f"bundle dir not found: {target}")
    payload = build_openclaw_run_report(target)

    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    console.print("[bold]OpenClaw Run Inspect[/bold]")
    console.print(f"Bundle: {target}")
    if payload["runSummary"]:
        run_summary = payload["runSummary"]
        console.print(
            f"Run: {run_summary.get('runOutcome') or run_summary.get('status')} | Mode: {run_summary.get('launchMode')} | "
            f"Completed: {run_summary.get('completedAt')}"
        )
    console.print(
        f"Checkpoint: {payload['checkpoint']['path']} | Exists: {payload['checkpoint']['exists']} | "
        f"Files: {payload['checkpoint']['fileCount']} | Latest Step: {payload['checkpoint']['latestStep']}"
    )
    console.print(f"Env URL: {payload['resolvedEnv']['envServerUrl']}")
    if payload["training"]["wandbUrl"]:
        console.print(f"W&B: {payload['training']['wandbUrl']}")
    if payload["training"]["latestMetrics"]:
        console.print(f"Metrics: {payload['training']['latestMetrics']}")
    console.print(f"Runs Index: {payload['files']['runsIndex']}")
    console.print(
        f"Logs: {payload['logs']['envStdout']} | {payload['logs']['envStderr']} | "
        f"{payload['logs']['trainStdout']} | {payload['logs']['trainStderr']}"
    )
    console.print(f"Training Report: {payload['files']['trainingReport']}")
    train_stderr_tail = str(payload["logTail"]["trainStderr"]).strip()
    if train_stderr_tail:
        console.print("[dim]Train stderr tail:[/dim]")
        console.print(train_stderr_tail)
    train_stdout_tail = str(payload["logTail"]["trainStdout"]).strip()
    if train_stdout_tail:
        console.print("[dim]Train stdout tail:[/dim]")
        console.print(train_stdout_tail)


def run_openclaw_list_runs(
    *,
    workspace: Path,
    index_path: Path | None,
    outcome: str | None,
    group_by: str | None,
    compare_field: str,
    limit: int,
    summary_only: bool,
    json_output: bool,
    console: Any,
    load_jsonl_objects: Callable[[Path], list[dict[str, Any]]],
    build_runs_index_payload: Callable[..., dict[str, Any]],
    extract_compare_metric: Callable[[dict[str, Any], str], Any],
) -> None:
    """List indexed OpenClaw training runs from runs_index.jsonl."""
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    records = load_jsonl_objects(target)
    payload = build_runs_index_payload(
        records,
        index_path=target,
        outcome=outcome,
        group_by=group_by,
        compare_field=compare_field,
        limit=limit,
        summary_only=summary_only,
    )
    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    console.print("[bold]OpenClaw Runs[/bold]")
    console.print(f"Index: {target}")
    console.print(f"Showing: {payload['count']} / {payload['filteredCount']} filtered ({payload['totalCount']} total)")
    if outcome:
        console.print(f"Outcome Filter: {outcome}")
    console.print(f"Compare Field: {compare_field}")
    if group_by:
        console.print(f"Group By: {group_by}")
    if not payload["count"]:
        console.print("[dim]No indexed runs found.[/dim]")
        return
    compare_summary = payload["compareSummary"]
    if compare_summary["count"]:
        console.print(
            f"Compare Summary: avg={compare_summary['avg']:.4f} | min={compare_summary['min']:.4f} | "
            f"max={compare_summary['max']:.4f}"
        )
        best = compare_summary.get("best") or {}
        worst = compare_summary.get("worst") or {}
        console.print(f"Best: {best.get('value')} | {best.get('bundleDir')}")
        console.print(f"Worst: {worst.get('value')} | {worst.get('bundleDir')}")
    grouped_summary = payload["groupedSummary"]
    if grouped_summary:
        group_table = Table(show_header=True, header_style="bold")
        group_table.add_column("Group")
        group_table.add_column("Count", justify="right")
        group_table.add_column("Success", justify="right")
        group_table.add_column("Rate", justify="right")
        group_table.add_column("Best", justify="right")
        for item in grouped_summary:
            best = item.get("compareSummary", {}).get("best") or {}
            rate = item.get("successRate")
            group_table.add_row(
                str(item.get("group") or "-"),
                str(item.get("count") or 0),
                str(item.get("successCount") or 0),
                "-" if rate is None else f"{rate:.2%}",
                str(best.get("value") if best.get("value") is not None else "-"),
            )
        console.print(group_table)
    if summary_only:
        return

    table = Table(show_header=True, header_style="bold")
    table.add_column("Completed")
    table.add_column("Outcome")
    table.add_column("Reason")
    table.add_column("Step", justify="right")
    table.add_column(compare_field.title(), justify="right")
    table.add_column("Bundle")
    for item in payload["runs"]:
        metrics = item.get("latestMetrics") or {}
        compare_value = extract_compare_metric(item, compare_field)
        table.add_row(
            str(item.get("completedAt") or item.get("recordedAt") or "-"),
            str(item.get("runOutcome") or "-"),
            str(item.get("failureReason") or "-"),
            str(metrics.get("step") or item.get("checkpointLatestStep") or "-"),
            str(compare_value if compare_value is not None else "-"),
            str(item.get("bundleDir") or "-"),
        )
    console.print(table)


def run_openclaw_compare_runs(
    *,
    workspace: Path,
    index_path: Path | None,
    outcome: str | None,
    group_by: str | None,
    compare_field: str,
    limit: int,
    output_format: str,
    output_path: Path | None,
    console: Any,
    load_jsonl_objects: Callable[[Path], list[dict[str, Any]]],
    build_runs_index_payload: Callable[..., dict[str, Any]],
    render_openclaw_runs_csv: Callable[[dict[str, Any]], str],
    render_openclaw_runs_markdown: Callable[[dict[str, Any]], str],
) -> None:
    """Compare indexed OpenClaw training runs and optionally export a report."""
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    records = load_jsonl_objects(target)
    payload = build_runs_index_payload(
        records,
        index_path=target,
        outcome=outcome,
        group_by=group_by,
        compare_field=compare_field,
        limit=limit,
        summary_only=False,
    )

    normalized_format = output_format.strip().lower()
    if normalized_format == "json":
        rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    elif normalized_format == "csv":
        rendered = render_openclaw_runs_csv(payload)
    elif normalized_format == "markdown":
        rendered = render_openclaw_runs_markdown(payload)
    else:
        raise typer.BadParameter(f"unsupported format: {output_format}")

    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
        console.print("[bold]OpenClaw Run Comparison[/bold]")
        console.print(f"Format: {normalized_format}")
        console.print(f"Output: {output_path}")
        console.print(f"Index: {target}")
        return

    if normalized_format == "json":
        console.print_json(rendered)
        return
    console.print(rendered, end="")


def run_latest_openclaw_report(
    *,
    workspace: Path,
    index_path: Path | None,
    report_format: str,
    print_content: bool,
    json_output: bool,
    console: Any,
    find_latest_openclaw_report: Callable[[Path, str], Path | None],
    load_latest_openclaw_index_payload: Callable[[Path], dict[str, Any] | None],
    preview_text: Callable[[str], str],
) -> None:
    """Locate the latest dated OpenClaw comparison report."""
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    normalized_format = report_format.strip().lower()
    if normalized_format not in {"markdown", "csv"}:
        raise typer.BadParameter(f"unsupported format: {report_format}")
    latest_path = find_latest_openclaw_report(target, normalized_format)
    if latest_path is None:
        raise typer.BadParameter(f"no {normalized_format} report found under: {target.parent / 'reports'}")
    latest_index = load_latest_openclaw_index_payload(target)
    content = latest_path.read_text(encoding="utf-8") if print_content else None

    payload = {
        "indexPath": str(target),
        "format": normalized_format,
        "path": str(latest_path),
        "reportsDir": str(latest_path.parent),
        "date": latest_path.parent.name,
        "printContent": print_content,
        "latestIndex": latest_index,
        "summary": (latest_index or {}).get("summary"),
        "compareSummary": (latest_index or {}).get("compareSummary"),
        "groupedSummary": (latest_index or {}).get("groupedSummary"),
        "content": None if json_output else content,
        "contentPreview": preview_text(content) if (json_output and print_content and content is not None) else None,
        "contentLineCount": len(content.splitlines()) if content is not None else None,
    }
    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        return

    console.print("[bold]Latest OpenClaw Report[/bold]")
    console.print(f"Format: {normalized_format}")
    console.print(f"Date: {payload['date']}")
    console.print(f"Path: {latest_path}")
    if print_content:
        console.print(payload["content"], end="" if str(payload["content"]).endswith("\n") else "\n")


def run_latest_openclaw_metrics(
    *,
    workspace: Path,
    index_path: Path | None,
    min_success_rate: float | None,
    min_avg: float | None,
    min_best: float | None,
    max_worst: float | None,
    emit_github_output: bool,
    emit_prometheus: bool,
    json_output: bool,
    console: Any,
    build_latest_openclaw_metrics_payload: Callable[..., dict[str, Any]],
    write_latest_openclaw_metrics_github_output: Callable[[dict[str, Any], Path], None],
    render_latest_openclaw_metrics_prometheus: Callable[[dict[str, Any]], str],
) -> None:
    """Return the latest OpenClaw report summary in a machine-friendly shape."""
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    payload = build_latest_openclaw_metrics_payload(
        target,
        min_success_rate=min_success_rate,
        min_avg=min_avg,
        min_best=min_best,
        max_worst=max_worst,
    )
    if json_output and emit_prometheus:
        raise typer.BadParameter("--json cannot be combined with --emit-prometheus")
    if emit_github_output:
        github_output = os.environ.get("GITHUB_OUTPUT")
        if not github_output:
            raise typer.BadParameter("GITHUB_OUTPUT is not set")
        write_latest_openclaw_metrics_github_output(payload, Path(github_output))
    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        if not payload["ok"]:
            raise typer.Exit(1)
        return
    if emit_prometheus:
        console.print(render_latest_openclaw_metrics_prometheus(payload), end="")
        if not payload["ok"]:
            raise typer.Exit(1)
        return

    console.print("[bold]Latest OpenClaw Metrics[/bold]")
    console.print(f"Date: {payload['date']}")
    console.print(f"Compare Field: {payload['compareField']}")
    console.print(f"Runs: {payload['filteredCount']} / {payload['totalCount']}")
    console.print(
        f"Success: {payload['successCount']} | Rate: {payload['successRate']:.2%}"
        if payload["successRate"] is not None else f"Success: {payload['successCount']} | Rate: -"
    )
    compare = payload["compareSummary"] or {}
    if compare.get("count"):
        console.print(
            f"Metric: avg={compare.get('avg'):.4f} | min={compare.get('min'):.4f} | max={compare.get('max'):.4f}"
        )
    alerts_state = payload.get("alertsState") or {}
    state_counts = alerts_state.get("stateCounts") or {}
    console.print(
        f"Alerts: new={state_counts.get('new', 0)} | ongoing={state_counts.get('ongoing', 0)} | "
        f"resolved={state_counts.get('resolved', 0)}"
    )
    console.print(f"Alert State: {payload['alertsStatePath']}")
    console.print(f"Markdown: {payload['summaryMarkdown']}")
    console.print(f"CSV: {payload['summaryCsv']}")
    if not payload["ok"]:
        console.print("[red]Threshold check failed.[/red]")
        raise typer.Exit(1)


def run_openclaw_metrics_server(
    *,
    workspace: Path,
    host: str,
    port: int,
    index_path: Path | None,
    min_success_rate: float | None,
    min_avg: float | None,
    min_best: float | None,
    max_worst: float | None,
    console: Any,
    metrics_http_server_factory: Callable[..., Any],
    build_latest_openclaw_metrics_payload: Callable[..., dict[str, Any]],
    render_latest_openclaw_metrics_prometheus: Callable[[dict[str, Any]], str],
    build_openclaw_alerts_payload: Callable[[dict[str, Any]], dict[str, Any]],
    render_openclaw_alertmanager_payload: Callable[[dict[str, Any]], dict[str, Any]],
) -> None:
    """Serve latest OpenClaw metrics over HTTP for Prometheus scraping."""
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    server = metrics_http_server_factory(
        host=host,
        port=port,
        metrics_payload_factory=lambda: build_latest_openclaw_metrics_payload(
            target,
            min_success_rate=min_success_rate,
            min_avg=min_avg,
            min_best=min_best,
            max_worst=max_worst,
        ),
        metrics_renderer=render_latest_openclaw_metrics_prometheus,
        alerts_builder=lambda payload: payload.get("alertsState") or build_openclaw_alerts_payload(payload),
        alertmanager_renderer=render_openclaw_alertmanager_payload,
    )
    console.print("[bold]OpenClaw Metrics Server[/bold]")
    console.print(f"Listening: {server.base_url}")
    console.print(f"Metrics: {server.base_url}/metrics")
    console.print(f"Summary: {server.base_url}/summary.json")
    console.print(f"Alerts: {server.base_url}/alerts")
    console.print(f"Alertmanager: {server.base_url}/alerts/prometheus")
    try:
        server.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover
        console.print("\n[dim]Shutting down metrics server.[/dim]")
    finally:
        server.shutdown()
        server.server_close()

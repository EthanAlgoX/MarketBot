"""Shared OpenClaw reporting and metrics helper functions."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable


def summarize_checkpoint_dir(path: Path | None) -> dict[str, Any]:
    """Inspect checkpoint directory contents and infer latest numbered step if possible."""
    if path is None:
        return {"path": None, "exists": False, "fileCount": 0, "latestStep": None, "latestEntry": None}
    checkpoint_dir = Path(path).expanduser()
    exists = checkpoint_dir.exists()
    if not exists:
        return {"path": str(checkpoint_dir), "exists": False, "fileCount": 0, "latestStep": None, "latestEntry": None}

    entries = list(checkpoint_dir.rglob("*"))
    file_count = sum(1 for item in entries if item.is_file())
    latest_step = None
    latest_entry = None
    latest_mtime = -1.0
    for item in entries:
        try:
            mtime = item.stat().st_mtime
        except OSError:
            mtime = -1.0
        if mtime > latest_mtime:
            latest_mtime = mtime
            latest_entry = str(item)
        step_match = re.search(r"(?:global[_-]?step|step|iter(?:ation)?)\D*(\d+)", item.name, flags=re.IGNORECASE)
        if step_match:
            parsed_step = int(step_match.group(1))
            if latest_step is None or parsed_step > latest_step:
                latest_step = parsed_step
    return {
        "path": str(checkpoint_dir),
        "exists": True,
        "fileCount": file_count,
        "latestStep": latest_step,
        "latestEntry": latest_entry,
    }


def build_openclaw_run_report(
    bundle_dir: Path,
    *,
    parse_env_assignments: Callable[[Path], dict[str, str]],
    summarize_checkpoint_dir: Callable[[Path | None], dict[str, Any]],
    tail_text: Callable[[Path], str],
    extract_wandb_info: Callable[[str], dict[str, str | None]],
    extract_latest_metrics: Callable[[str], dict[str, float | int]],
    load_json_object: Callable[[Path], dict[str, Any] | None],
    resolve_openclaw_report_paths: Callable[[Path], dict[str, Path]],
) -> dict[str, Any]:
    """Build a structured summary for an OpenClaw export bundle and its logs."""
    target = Path(bundle_dir)
    env_example = parse_env_assignments(target / "env.example")
    env_local = parse_env_assignments(target / "env.local")
    terminal_example = parse_env_assignments(target / "terminal_qwen3_8b.env.example")
    terminal_local = parse_env_assignments(target / "terminal_qwen3_8b.env.local")
    merged_env = {**env_example, **env_local, **terminal_example, **terminal_local}

    logs_dir = target / "logs"
    env_stdout_path = logs_dir / "env.stdout.log"
    env_stderr_path = logs_dir / "env.stderr.log"
    train_stdout_path = logs_dir / "train.stdout.log"
    train_stderr_path = logs_dir / "train.stderr.log"
    run_summary_path = target / "run_summary.json"
    training_report_path = target / "training_report.json"
    runs_index_path = target.parent / "runs_index.jsonl"

    save_ckpt_raw = str(merged_env.get("SAVE_CKPT", "")).strip()
    checkpoint_dir = Path(save_ckpt_raw).expanduser() if save_ckpt_raw else None
    checkpoint_summary = summarize_checkpoint_dir(checkpoint_dir)

    train_stdout_tail = tail_text(train_stdout_path)
    train_stderr_tail = tail_text(train_stderr_path)
    env_stdout_tail = tail_text(env_stdout_path)
    env_stderr_tail = tail_text(env_stderr_path)
    full_train_text = ""
    for log_path in (train_stdout_path, train_stderr_path):
        try:
            full_train_text += Path(log_path).read_text(encoding="utf-8", errors="replace") + "\n"
        except Exception:
            continue
    wandb_info = extract_wandb_info(full_train_text)
    metrics = extract_latest_metrics(full_train_text)
    run_summary = load_json_object(run_summary_path)
    report_archive = {
        key: str(value)
        for key, value in resolve_openclaw_report_paths(
            runs_index_path,
            completed_at=(run_summary or {}).get("completedAt"),
        ).items()
    }

    return {
        "bundleDir": str(target),
        "files": {
            "manifest": str(target / "manifest.json"),
            "dataset": str(target / "train.jsonl"),
            "runSummary": str(run_summary_path),
            "trainingReport": str(training_report_path),
            "runsIndex": str(runs_index_path),
            "envExample": str(target / "env.example"),
            "envLocal": str(target / "env.local"),
            "terminalEnvExample": str(target / "terminal_qwen3_8b.env.example"),
            "terminalEnvLocal": str(target / "terminal_qwen3_8b.env.local"),
        },
        "reportArchive": report_archive,
        "resolvedEnv": {
            "openclawRoot": merged_env.get("OPENCLAW_ROOT"),
            "marketbotRoot": merged_env.get("MARKETBOT_ROOT"),
            "envServerUrl": merged_env.get("ENV_SERVER_URL"),
            "saveCkpt": save_ckpt_raw or None,
            "numGpus": merged_env.get("NUM_GPUS"),
            "actorGpus": merged_env.get("ACTOR_GPUS"),
            "rolloutGpus": merged_env.get("ROLLOUT_GPUS"),
        },
        "checkpoint": checkpoint_summary,
        "training": {
            "wandbUrl": wandb_info["url"],
            "wandbRunId": wandb_info["runId"],
            "latestMetrics": metrics,
        },
        "logs": {
            "envStdout": str(env_stdout_path),
            "envStderr": str(env_stderr_path),
            "trainStdout": str(train_stdout_path),
            "trainStderr": str(train_stderr_path),
        },
        "logTail": {
            "envStdout": env_stdout_tail,
            "envStderr": env_stderr_tail,
            "trainStdout": train_stdout_tail,
            "trainStderr": train_stderr_tail,
        },
        "runSummary": run_summary,
    }


def append_openclaw_runs_index(report_payload: dict[str, Any]) -> str:
    """Append a compact training run record to the parent runs index."""
    files = report_payload.get("files") or {}
    run_summary = report_payload.get("runSummary") or {}
    checkpoint = report_payload.get("checkpoint") or {}
    training = report_payload.get("training") or {}
    resolved_env = report_payload.get("resolvedEnv") or {}
    log_tail = report_payload.get("logTail") or {}
    index_path = Path(str(files.get("runsIndex") or "")).expanduser()
    index_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "recordedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "bundleDir": report_payload.get("bundleDir"),
        "trainingReportPath": files.get("trainingReport"),
        "summaryPath": files.get("runSummary"),
        "launchMode": run_summary.get("launchMode"),
        "runOutcome": run_summary.get("runOutcome") or run_summary.get("status"),
        "failureReason": run_summary.get("failureReason"),
        "exitCode": run_summary.get("exitCode"),
        "completedAt": run_summary.get("completedAt"),
        "envServerUrl": resolved_env.get("envServerUrl"),
        "checkpointPath": checkpoint.get("path"),
        "checkpointLatestStep": checkpoint.get("latestStep"),
        "wandbUrl": training.get("wandbUrl"),
        "wandbRunId": training.get("wandbRunId"),
        "latestMetrics": training.get("latestMetrics") or {},
        "trainStdoutTail": log_tail.get("trainStdout"),
        "trainStderrTail": log_tail.get("trainStderr"),
    }
    with index_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return str(index_path)


def extract_compare_metric(item: dict[str, Any], field: str) -> float | int | None:
    """Extract a comparable numeric metric from a run index record."""
    normalized = str(field).strip().lower()
    metrics = item.get("latestMetrics") or {}
    if normalized == "step":
        value = metrics.get("step")
        if value is None:
            value = item.get("checkpointLatestStep")
        return value if isinstance(value, (int, float)) else None
    value = metrics.get(normalized)
    return value if isinstance(value, (int, float)) else None


def summarize_compare_metric(records: list[dict[str, Any]], field: str) -> dict[str, Any]:
    """Summarize a numeric compare field across run index records."""
    normalized = str(field).strip().lower()
    comparable: list[tuple[dict[str, Any], float]] = []
    for item in records:
        value = extract_compare_metric(item, normalized)
        if value is None:
            continue
        comparable.append((item, float(value)))
    if not comparable:
        return {"field": normalized, "count": 0, "min": None, "max": None, "avg": None, "best": None, "worst": None}

    values = [value for _, value in comparable]
    reverse = normalized != "loss"
    ranked = sorted(comparable, key=lambda pair: pair[1], reverse=reverse)
    best_item, best_value = ranked[0]
    worst_item, worst_value = ranked[-1]
    return {
        "field": normalized,
        "count": len(comparable),
        "min": min(values),
        "max": max(values),
        "avg": sum(values) / len(values),
        "best": {
            "bundleDir": best_item.get("bundleDir"),
            "value": best_value,
            "runOutcome": best_item.get("runOutcome"),
            "completedAt": best_item.get("completedAt") or best_item.get("recordedAt"),
        },
        "worst": {
            "bundleDir": worst_item.get("bundleDir"),
            "value": worst_value,
            "runOutcome": worst_item.get("runOutcome"),
            "completedAt": worst_item.get("completedAt") or worst_item.get("recordedAt"),
        },
    }


def summarize_run_group(records: list[dict[str, Any]], field: str, group_name: str | None = None) -> dict[str, Any]:
    """Summarize a set of run index records for dashboards."""
    total = len(records)
    success_count = sum(1 for item in records if str(item.get("runOutcome")).strip().lower() == "succeeded")
    return {
        "group": group_name,
        "count": total,
        "successCount": success_count,
        "successRate": (success_count / total) if total else None,
        "compareSummary": summarize_compare_metric(records, field),
    }


def group_run_records(records: list[dict[str, Any]], group_by: str, compare_field: str) -> list[dict[str, Any]]:
    """Group run index records by a supported dimension."""
    normalized = str(group_by).strip().lower()
    if normalized != "outcome":
        return []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in records:
        key = str(item.get("runOutcome") or "unknown")
        grouped.setdefault(key, []).append(item)
    summaries = [summarize_run_group(items, compare_field, group_name=key) for key, items in grouped.items()]
    summaries.sort(key=lambda item: (-(item.get("count") or 0), str(item.get("group") or "")))
    return summaries


def build_runs_index_payload(
    records: list[dict[str, Any]],
    *,
    index_path: Path,
    outcome: str | None,
    group_by: str | None,
    compare_field: str,
    limit: int,
    summary_only: bool,
) -> dict[str, Any]:
    """Build a structured runs-index payload for list/compare commands."""
    filtered = records
    if outcome:
        wanted = outcome.strip().lower()
        filtered = [item for item in filtered if str(item.get("runOutcome", "")).strip().lower() == wanted]
    filtered.sort(key=lambda item: str(item.get("completedAt") or item.get("recordedAt") or ""), reverse=True)
    limited = filtered[:limit]
    compare_summary = summarize_compare_metric(filtered, compare_field)
    overall_summary = summarize_run_group(filtered, compare_field)
    grouped_summary = group_run_records(filtered, group_by, compare_field) if group_by else []
    return {
        "indexPath": str(index_path),
        "count": len(limited),
        "totalCount": len(records),
        "filteredCount": len(filtered),
        "outcome": outcome,
        "groupBy": group_by,
        "compareField": compare_field,
        "compareSummary": compare_summary,
        "summary": overall_summary,
        "groupedSummary": grouped_summary,
        "runs": [] if summary_only else limited,
    }


def render_openclaw_runs_markdown(payload: dict[str, Any]) -> str:
    """Render a runs-index comparison payload as Markdown."""
    lines = [
        "# OpenClaw Run Comparison",
        "",
        f"- Index: `{payload['indexPath']}`",
        f"- Runs: {payload['filteredCount']} filtered / {payload['totalCount']} total",
        f"- Compare Field: `{payload['compareField']}`",
    ]
    if payload.get("outcome"):
        lines.append(f"- Outcome Filter: `{payload['outcome']}`")
    if payload.get("groupBy"):
        lines.append(f"- Group By: `{payload['groupBy']}`")

    summary = payload.get("summary") or {}
    compare = payload.get("compareSummary") or {}
    lines.extend(
        [
            "",
            "## Summary",
            "",
            f"- Success Count: {summary.get('successCount')}",
            f"- Success Rate: {summary.get('successRate'):.2%}" if summary.get("successRate") is not None else "- Success Rate: -",
            f"- Compared Runs: {compare.get('count')}",
            f"- Avg `{payload['compareField']}`: {compare.get('avg'):.4f}" if compare.get("avg") is not None else f"- Avg `{payload['compareField']}`: -",
            f"- Min `{payload['compareField']}`: {compare.get('min'):.4f}" if compare.get("min") is not None else f"- Min `{payload['compareField']}`: -",
            f"- Max `{payload['compareField']}`: {compare.get('max'):.4f}" if compare.get("max") is not None else f"- Max `{payload['compareField']}`: -",
        ]
    )

    grouped = payload.get("groupedSummary") or []
    if grouped:
        lines.extend(["", "## Grouped Summary", "", "| Group | Count | Success | Rate | Best |", "|---|---:|---:|---:|---:|"])
        for item in grouped:
            best = item.get("compareSummary", {}).get("best") or {}
            rate = item.get("successRate")
            rate_text = f"{rate:.2%}" if rate is not None else "-"
            best_text = f"{best.get('value'):.4f}" if isinstance(best.get("value"), (int, float)) else "-"
            lines.append(f"| {item.get('group') or '-'} | {item.get('count') or 0} | {item.get('successCount') or 0} | {rate_text} | {best_text} |")

    runs = payload.get("runs") or []
    if runs:
        lines.extend(
            [
                "",
                "## Runs",
                "",
                f"| Completed | Outcome | Reason | Step | {payload['compareField'].title()} | Bundle |",
                "|---|---|---|---:|---:|---|",
            ]
        )
        for item in runs:
            metric_value = extract_compare_metric(item, str(payload["compareField"]))
            metric_text = f"{metric_value:.4f}" if isinstance(metric_value, (int, float)) else "-"
            step_value = extract_compare_metric(item, "step")
            step_text = str(int(step_value)) if isinstance(step_value, (int, float)) else "-"
            lines.append(
                f"| {item.get('completedAt') or item.get('recordedAt') or '-'} | {item.get('runOutcome') or '-'} | "
                f"{item.get('failureReason') or '-'} | {step_text} | {metric_text} | {item.get('bundleDir') or '-'} |"
            )
    return "\n".join(lines) + "\n"


def render_openclaw_runs_csv(payload: dict[str, Any]) -> str:
    """Render a runs-index comparison payload as CSV."""
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    compare_field = str(payload.get("compareField") or "score")
    writer.writerow(["completedAt", "runOutcome", "failureReason", "step", compare_field, "bundleDir", "wandbUrl"])
    for item in payload.get("runs") or []:
        writer.writerow(
            [
                item.get("completedAt") or item.get("recordedAt") or "",
                item.get("runOutcome") or "",
                item.get("failureReason") or "",
                extract_compare_metric(item, "step") or "",
                extract_compare_metric(item, compare_field) or "",
                item.get("bundleDir") or "",
                item.get("wandbUrl") or "",
            ]
        )
    return buffer.getvalue()


def resolve_openclaw_report_paths(index_path: Path, completed_at: str | None = None) -> dict[str, Path]:
    """Resolve dated report output paths for an OpenClaw runs index."""
    raw_date = str(completed_at or "").strip()
    if len(raw_date) >= 10 and raw_date[4] == "-" and raw_date[7] == "-":
        date_slug = raw_date[:10].replace("-", "")
    else:
        date_slug = datetime.now(UTC).strftime("%Y%m%d")
    reports_dir = Path(index_path).expanduser().parent / "reports" / date_slug
    return {
        "reportsRoot": reports_dir.parent,
        "reportsDir": reports_dir,
        "summaryMarkdown": reports_dir / "summary.md",
        "summaryCsv": reports_dir / "summary.csv",
        "latestJson": reports_dir.parent / "latest.json",
    }


def write_openclaw_runs_archive(
    index_path: Path,
    *,
    completed_at: str | None,
    load_jsonl_objects: Callable[[Path], list[dict[str, Any]]],
    build_runs_index_payload: Callable[..., dict[str, Any]],
    resolve_openclaw_report_paths: Callable[[Path, str | None], dict[str, Path]],
    render_openclaw_runs_markdown: Callable[[dict[str, Any]], str],
    render_openclaw_runs_csv: Callable[[dict[str, Any]], str],
    compare_field: str = "score",
    group_by: str | None = "outcome",
    limit: int = 50,
) -> dict[str, str]:
    """Write dated Markdown/CSV aggregate reports for the current runs index."""
    target = Path(index_path).expanduser()
    records = load_jsonl_objects(target)
    payload = build_runs_index_payload(
        records,
        index_path=target,
        outcome=None,
        group_by=group_by,
        compare_field=compare_field,
        limit=limit,
        summary_only=False,
    )
    paths = resolve_openclaw_report_paths(target, completed_at=completed_at)
    reports_dir = paths["reportsDir"]
    reports_dir.mkdir(parents=True, exist_ok=True)
    paths["summaryMarkdown"].write_text(render_openclaw_runs_markdown(payload), encoding="utf-8")
    paths["summaryCsv"].write_text(render_openclaw_runs_csv(payload), encoding="utf-8")
    latest_payload = {
        "date": reports_dir.name,
        "reportsDir": str(reports_dir),
        "summaryMarkdown": str(paths["summaryMarkdown"]),
        "summaryCsv": str(paths["summaryCsv"]),
        "indexPath": str(target),
        "compareField": compare_field,
        "groupBy": group_by,
        "totalCount": payload["totalCount"],
        "filteredCount": payload["filteredCount"],
        "summary": payload["summary"],
        "compareSummary": payload["compareSummary"],
        "groupedSummary": payload["groupedSummary"],
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    paths["latestJson"].write_text(json.dumps(latest_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {key: str(value) for key, value in paths.items()}


def find_latest_openclaw_report(
    index_path: Path,
    report_format: str,
    *,
    load_json_object: Callable[[Path], dict[str, Any] | None],
) -> Path | None:
    """Find the newest dated summary report under the runs-index parent."""
    target = Path(index_path).expanduser()
    reports_root = target.parent / "reports"
    if not reports_root.exists():
        return None
    normalized = report_format.strip().lower()
    filename = "summary.md" if normalized == "markdown" else "summary.csv"
    latest_index = reports_root / "latest.json"
    latest_payload = load_json_object(latest_index)
    if latest_payload:
        preferred = latest_payload.get("summaryMarkdown") if normalized == "markdown" else latest_payload.get("summaryCsv")
        if preferred:
            preferred_path = Path(str(preferred)).expanduser()
            if preferred_path.exists():
                return preferred_path
    candidates = [path for path in reports_root.glob(f"*/{filename}") if path.is_file()]
    if not candidates:
        return None
    return sorted(candidates, key=lambda path: (path.parent.name, path.stat().st_mtime), reverse=True)[0]


def load_latest_openclaw_index_payload(
    index_path: Path,
    *,
    load_json_object: Callable[[Path], dict[str, Any] | None],
    load_jsonl_objects: Callable[[Path], list[dict[str, Any]]],
    build_runs_index_payload: Callable[..., dict[str, Any]],
    resolve_openclaw_report_paths: Callable[[Path, str | None], dict[str, Path]],
) -> dict[str, Any]:
    """Load latest report summary from latest.json or rebuild it from runs_index.jsonl."""
    target = Path(index_path).expanduser()
    latest_index_path = target.parent / "reports" / "latest.json"
    latest_index = load_json_object(latest_index_path)
    if latest_index:
        return latest_index
    records = load_jsonl_objects(target)
    payload = build_runs_index_payload(
        records,
        index_path=target,
        outcome=None,
        group_by="outcome",
        compare_field="score",
        limit=10,
        summary_only=True,
    )
    paths = resolve_openclaw_report_paths(target, None)
    return {
        "date": Path(str(paths["reportsDir"])).name,
        "reportsDir": str(paths["reportsDir"]),
        "summaryMarkdown": str(paths["summaryMarkdown"]),
        "summaryCsv": str(paths["summaryCsv"]),
        "indexPath": str(target),
        "compareField": payload["compareField"],
        "groupBy": payload["groupBy"],
        "totalCount": payload["totalCount"],
        "filteredCount": payload["filteredCount"],
        "summary": payload["summary"],
        "compareSummary": payload["compareSummary"],
        "groupedSummary": payload["groupedSummary"],
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }


def evaluate_openclaw_metric_thresholds(
    payload: dict[str, Any],
    *,
    min_success_rate: float | None = None,
    min_avg: float | None = None,
    min_best: float | None = None,
    max_worst: float | None = None,
) -> dict[str, Any]:
    """Evaluate simple threshold checks for latest OpenClaw metrics."""
    compare = payload.get("compareSummary") or {}
    checks = {
        "minSuccessRate": {
            "enabled": min_success_rate is not None,
            "threshold": min_success_rate,
            "actual": payload.get("successRate"),
            "passed": None,
        },
        "minAvg": {
            "enabled": min_avg is not None,
            "threshold": min_avg,
            "actual": compare.get("avg"),
            "passed": None,
        },
        "minBest": {
            "enabled": min_best is not None,
            "threshold": min_best,
            "actual": (compare.get("best") or {}).get("value"),
            "passed": None,
        },
        "maxWorst": {
            "enabled": max_worst is not None,
            "threshold": max_worst,
            "actual": (compare.get("worst") or {}).get("value"),
            "passed": None,
        },
    }

    if checks["minSuccessRate"]["enabled"]:
        actual = checks["minSuccessRate"]["actual"]
        checks["minSuccessRate"]["passed"] = actual is not None and actual >= float(min_success_rate)
    if checks["minAvg"]["enabled"]:
        actual = checks["minAvg"]["actual"]
        checks["minAvg"]["passed"] = actual is not None and actual >= float(min_avg)
    if checks["minBest"]["enabled"]:
        actual = checks["minBest"]["actual"]
        checks["minBest"]["passed"] = actual is not None and actual >= float(min_best)
    if checks["maxWorst"]["enabled"]:
        actual = checks["maxWorst"]["actual"]
        checks["maxWorst"]["passed"] = actual is not None and actual <= float(max_worst)

    enabled_checks = [item for item in checks.values() if item["enabled"]]
    ok = all(item["passed"] is True for item in enabled_checks) if enabled_checks else True
    return {"ok": ok, "checks": checks}


def render_latest_openclaw_metrics_prometheus(payload: dict[str, Any]) -> str:
    """Render latest OpenClaw metrics as Prometheus exposition text."""
    def _num(value: Any) -> str:
        if isinstance(value, bool):
            return "1" if value else "0"
        if isinstance(value, (int, float)):
            return f"{float(value):g}"
        return "nan"

    compare = payload.get("compareSummary") or {}
    lines = [
        "# HELP marketbot_openclaw_success_rate Latest OpenClaw success rate.",
        "# TYPE marketbot_openclaw_success_rate gauge",
        f"marketbot_openclaw_success_rate {_num(payload.get('successRate'))}",
        "# HELP marketbot_openclaw_total_runs Total indexed OpenClaw runs.",
        "# TYPE marketbot_openclaw_total_runs gauge",
        f"marketbot_openclaw_total_runs {_num(payload.get('totalCount'))}",
        "# HELP marketbot_openclaw_filtered_runs Filtered OpenClaw runs.",
        "# TYPE marketbot_openclaw_filtered_runs gauge",
        f"marketbot_openclaw_filtered_runs {_num(payload.get('filteredCount'))}",
        "# HELP marketbot_openclaw_success_count Latest OpenClaw success count.",
        "# TYPE marketbot_openclaw_success_count gauge",
        f"marketbot_openclaw_success_count {_num(payload.get('successCount'))}",
        "# HELP marketbot_openclaw_compare_avg Latest compare average.",
        "# TYPE marketbot_openclaw_compare_avg gauge",
        f"marketbot_openclaw_compare_avg {_num(compare.get('avg'))}",
        "# HELP marketbot_openclaw_compare_best Latest compare best value.",
        "# TYPE marketbot_openclaw_compare_best gauge",
        f"marketbot_openclaw_compare_best {_num((compare.get('best') or {}).get('value'))}",
        "# HELP marketbot_openclaw_compare_worst Latest compare worst value.",
        "# TYPE marketbot_openclaw_compare_worst gauge",
        f"marketbot_openclaw_compare_worst {_num((compare.get('worst') or {}).get('value'))}",
        "# HELP marketbot_openclaw_threshold_ok Whether threshold checks passed.",
        "# TYPE marketbot_openclaw_threshold_ok gauge",
        f"marketbot_openclaw_threshold_ok {_num(payload.get('ok'))}",
    ]
    return "\n".join(lines) + "\n"


def build_openclaw_alerts_payload(metrics_payload: dict[str, Any]) -> dict[str, Any]:
    """Build a compact alerts payload from latest metrics threshold results."""
    import hashlib

    checks = metrics_payload.get("thresholdChecks") or {}
    failed_checks = []
    alerts = []
    generated_at = str(metrics_payload.get("generatedAt") or "")
    compare_field = str(metrics_payload.get("compareField") or "")
    date = str(metrics_payload.get("date") or "")
    severity_map = {
        "minSuccessRate": "critical",
        "maxWorst": "critical",
        "minAvg": "warning",
        "minBest": "warning",
    }
    for name, item in checks.items():
        if item.get("enabled") and item.get("passed") is False:
            fingerprint_source = f"{name}:{compare_field}"
            fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:16]
            failed_check = {
                "name": name,
                "threshold": item.get("threshold"),
                "actual": item.get("actual"),
                "severity": severity_map.get(name, "warning"),
                "fingerprint": fingerprint,
            }
            failed_checks.append(failed_check)
            alerts.append(
                {
                    "status": "firing",
                    "fingerprint": fingerprint,
                    "labels": {
                        "alertname": f"MarketBotOpenClaw{name}",
                        "severity": failed_check["severity"],
                        "compare_field": compare_field,
                        "date": date,
                    },
                    "annotations": {
                        "summary": f"{name} threshold failed",
                        "description": (
                            f"{name} threshold {failed_check['threshold']} was violated by actual "
                            f"value {failed_check['actual']}"
                        ),
                        "runbook": str(metrics_payload.get("summaryMarkdown") or ""),
                    },
                    "generatorURL": str(metrics_payload.get("summaryMarkdown") or ""),
                    "startsAt": generated_at,
                    "endsAt": None,
                }
            )
    resolved = bool(metrics_payload.get("ok"))
    return {
        "ok": metrics_payload.get("ok"),
        "resolved": resolved,
        "resolvedAt": generated_at if resolved else None,
        "activeAlertCount": len(failed_checks),
        "failedChecks": failed_checks,
        "alerts": alerts,
        "status": "resolved" if resolved else "firing",
        "date": date,
        "generatedAt": generated_at,
        "compareField": compare_field,
        "summaryMarkdown": metrics_payload.get("summaryMarkdown"),
        "summaryCsv": metrics_payload.get("summaryCsv"),
        "thresholdConfig": metrics_payload.get("thresholdConfig") or {},
    }


def resolve_openclaw_alert_state_path(index_path: Path) -> Path:
    """Resolve the persisted alert lifecycle state file for latest metrics checks."""
    target = Path(index_path).expanduser()
    return target.parent / "reports" / "alerts_state.json"


def build_openclaw_alert_history_event(alert: dict[str, Any], *, compare_field: str, event_at: str) -> dict[str, Any]:
    """Build a compact lifecycle event for alert state history."""
    labels = alert.get("labels") or {}
    return {
        "fingerprint": str(alert.get("fingerprint") or ""),
        "alertState": str(alert.get("alertState") or ""),
        "status": str(alert.get("status") or ""),
        "alertname": str(labels.get("alertname") or ""),
        "severity": str(labels.get("severity") or ""),
        "compareField": compare_field,
        "eventAt": event_at,
    }


def sync_openclaw_alerts_state(
    index_path: Path,
    alerts_payload: dict[str, Any],
    *,
    load_json_object: Callable[[Path], dict[str, Any] | None],
) -> dict[str, Any]:
    """Persist and enrich alerts with lifecycle state across repeated checks."""
    history_limit = 20
    state_path = resolve_openclaw_alert_state_path(index_path)
    previous_state = load_json_object(state_path) or {}
    current_profile = {
        "compareField": alerts_payload.get("compareField"),
        "thresholdConfig": alerts_payload.get("thresholdConfig") or {},
    }
    previous_profile = previous_state.get("profile") or {}
    same_profile = previous_profile == current_profile
    previous_history = list(previous_state.get("recentHistory") or []) if same_profile else []
    previous_active = {
        str(item.get("fingerprint")): item
        for item in (previous_state.get("alerts") or [])
        if item.get("fingerprint")
    } if same_profile else {}

    generated_at = str(alerts_payload.get("generatedAt") or "")
    compare_field = str(alerts_payload.get("compareField") or "")
    active_alerts = []
    active_fingerprints = set()
    recent_events = []
    for item in alerts_payload.get("alerts") or []:
        fingerprint = str(item.get("fingerprint") or "")
        if not fingerprint:
            continue
        active_fingerprints.add(fingerprint)
        previous_item = previous_active.get(fingerprint)
        first_seen_at = str(
            (previous_item or {}).get("firstSeenAt")
            or (previous_item or {}).get("startsAt")
            or item.get("startsAt")
            or generated_at
        )
        alert = dict(item)
        alert["alertState"] = "ongoing" if previous_item else "new"
        alert["occurrenceCount"] = int((previous_item or {}).get("occurrenceCount") or 0) + 1
        alert["firstSeenAt"] = first_seen_at
        alert["lastSeenAt"] = generated_at
        alert["startsAt"] = first_seen_at
        active_alerts.append(alert)
        recent_events.append(build_openclaw_alert_history_event(alert, compare_field=compare_field, event_at=generated_at))

    resolved_alerts = []
    if same_profile:
        for fingerprint, previous_item in previous_active.items():
            if fingerprint in active_fingerprints:
                continue
            resolved_alert = dict(previous_item)
            resolved_alert["status"] = "resolved"
            resolved_alert["alertState"] = "resolved"
            resolved_alert["resolvedAt"] = generated_at
            resolved_alert["endsAt"] = generated_at
            resolved_alert["lastSeenAt"] = generated_at
            resolved_alert["occurrenceCount"] = int((previous_item or {}).get("occurrenceCount") or 0)
            resolved_alerts.append(resolved_alert)
            recent_events.append(
                build_openclaw_alert_history_event(resolved_alert, compare_field=compare_field, event_at=generated_at)
            )

    failed_checks = []
    state_by_fingerprint = {item["fingerprint"]: item["alertState"] for item in active_alerts if item.get("fingerprint")}
    for item in alerts_payload.get("failedChecks") or []:
        failed_check = dict(item)
        failed_check["alertState"] = state_by_fingerprint.get(str(item.get("fingerprint") or ""), "new")
        failed_checks.append(failed_check)

    state_payload = dict(alerts_payload)
    state_payload["profile"] = current_profile
    state_payload["profileChanged"] = bool(previous_state) and not same_profile
    state_payload["alerts"] = active_alerts
    state_payload["activeAlerts"] = active_alerts
    state_payload["resolvedAlerts"] = resolved_alerts
    state_payload["resolvedAlertCount"] = len(resolved_alerts)
    state_payload["failedChecks"] = failed_checks
    state_payload["historyLimit"] = history_limit
    state_payload["recentHistory"] = (previous_history + recent_events)[-history_limit:]
    state_payload["stateCounts"] = {
        "new": sum(1 for item in active_alerts if item.get("alertState") == "new"),
        "ongoing": sum(1 for item in active_alerts if item.get("alertState") == "ongoing"),
        "resolved": len(resolved_alerts),
    }
    state_payload["statePath"] = str(state_path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return state_payload


def render_openclaw_alertmanager_payload(alerts_payload: dict[str, Any]) -> dict[str, Any]:
    """Render alerts payload in an Alertmanager-compatible webhook shape."""
    alerts = alerts_payload.get("alerts") or alerts_payload.get("resolvedAlerts") or []
    status = str(
        alerts_payload.get("status")
        or ("resolved" if alerts_payload.get("resolved") else ("resolved" if not alerts else "firing"))
    )
    return {
        "receiver": "marketbot-openclaw",
        "status": status,
        "alerts": alerts,
        "groupLabels": {
            "source": "marketbot",
            "service": "openclaw",
        },
        "commonLabels": {
            "source": "marketbot",
            "service": "openclaw",
            "compare_field": str(alerts_payload.get("compareField") or ""),
            "date": str(alerts_payload.get("date") or ""),
        },
        "commonAnnotations": {
            "summaryMarkdown": str(alerts_payload.get("summaryMarkdown") or ""),
            "summaryCsv": str(alerts_payload.get("summaryCsv") or ""),
        },
        "externalURL": str(alerts_payload.get("summaryMarkdown") or ""),
        "version": "4",
        "groupKey": f"marketbot:openclaw:{alerts_payload.get('compareField') or 'default'}",
        "truncatedAlerts": 0,
        "resolved": bool(alerts_payload.get("resolved")),
        "resolvedAt": alerts_payload.get("resolvedAt"),
    }


def write_latest_openclaw_metrics_github_output(payload: dict[str, Any], output_path: Path) -> None:
    """Write latest OpenClaw metrics to a GitHub Actions output file."""
    compare = payload.get("compareSummary") or {}
    rows = {
        "openclaw_ok": str(bool(payload.get("ok"))).lower(),
        "openclaw_date": str(payload.get("date") or ""),
        "openclaw_success_rate": str(payload.get("successRate") if payload.get("successRate") is not None else ""),
        "openclaw_success_count": str(payload.get("successCount") if payload.get("successCount") is not None else ""),
        "openclaw_total_count": str(payload.get("totalCount") if payload.get("totalCount") is not None else ""),
        "openclaw_compare_field": str(payload.get("compareField") or ""),
        "openclaw_compare_avg": str(compare.get("avg") if compare.get("avg") is not None else ""),
        "openclaw_compare_best": str((compare.get("best") or {}).get("value") if (compare.get("best") or {}).get("value") is not None else ""),
        "openclaw_compare_worst": str((compare.get("worst") or {}).get("value") if (compare.get("worst") or {}).get("value") is not None else ""),
        "openclaw_summary_markdown": str(payload.get("summaryMarkdown") or ""),
        "openclaw_summary_csv": str(payload.get("summaryCsv") or ""),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8") as handle:
        for key, value in rows.items():
            handle.write(f"{key}={value}\n")


def build_latest_openclaw_metrics_payload(
    index_path: Path,
    *,
    min_success_rate: float | None = None,
    min_avg: float | None = None,
    min_best: float | None = None,
    max_worst: float | None = None,
    load_latest_openclaw_index_payload: Callable[[Path], dict[str, Any]],
    evaluate_openclaw_metric_thresholds: Callable[..., dict[str, Any]],
    build_openclaw_alerts_payload: Callable[[dict[str, Any]], dict[str, Any]],
    sync_openclaw_alerts_state: Callable[[Path, dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    """Build the latest OpenClaw metrics payload with threshold evaluation."""
    latest_index = load_latest_openclaw_index_payload(index_path)
    payload = {
        "indexPath": str(index_path),
        "date": latest_index.get("date"),
        "generatedAt": latest_index.get("generatedAt"),
        "reportsDir": latest_index.get("reportsDir"),
        "summaryMarkdown": latest_index.get("summaryMarkdown"),
        "summaryCsv": latest_index.get("summaryCsv"),
        "compareField": latest_index.get("compareField"),
        "groupBy": latest_index.get("groupBy"),
        "thresholdConfig": {
            "minSuccessRate": min_success_rate,
            "minAvg": min_avg,
            "minBest": min_best,
            "maxWorst": max_worst,
        },
        "totalCount": latest_index.get("totalCount"),
        "filteredCount": latest_index.get("filteredCount"),
        "successCount": (latest_index.get("summary") or {}).get("successCount"),
        "successRate": (latest_index.get("summary") or {}).get("successRate"),
        "compareSummary": latest_index.get("compareSummary"),
        "groupedSummary": latest_index.get("groupedSummary"),
    }
    threshold_result = evaluate_openclaw_metric_thresholds(
        payload,
        min_success_rate=min_success_rate,
        min_avg=min_avg,
        min_best=min_best,
        max_worst=max_worst,
    )
    payload["ok"] = threshold_result["ok"]
    payload["thresholdChecks"] = threshold_result["checks"]
    alerts_payload = build_openclaw_alerts_payload(payload)
    payload["alertsState"] = sync_openclaw_alerts_state(index_path, alerts_payload)
    payload["alertsStatePath"] = payload["alertsState"]["statePath"]
    return payload


def classify_openclaw_launch_error(exc: BaseException, default_reason: str | None = None) -> dict[str, Any]:
    """Map launch exceptions into stable outcome/reason metadata."""
    import subprocess
    import typer

    if isinstance(exc, KeyboardInterrupt):
        return {"runOutcome": "interrupted", "failureReason": "interrupted", "exitCode": 130}
    if isinstance(exc, typer.Exit):
        reason = default_reason or "unexpected_exit"
        outcome = "env_unhealthy" if reason == "env_unhealthy" else "failed"
        return {"runOutcome": outcome, "failureReason": reason, "exitCode": exc.exit_code}
    if isinstance(exc, subprocess.CalledProcessError):
        return {
            "runOutcome": "failed",
            "failureReason": default_reason or "train_nonzero_exit",
            "exitCode": exc.returncode,
        }
    return {"runOutcome": "failed", "failureReason": default_reason or "unexpected_exception", "exitCode": 1}

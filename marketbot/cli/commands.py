"""CLI commands for marketbot."""

import asyncio
import json
import os
import re
import select
import shutil
import signal
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Force UTF-8 encoding for Windows console
if sys.platform == "win32":
    import locale
    if sys.stdout.encoding != "utf-8":
        os.environ["PYTHONIOENCODING"] = "utf-8"
        # Re-open stdout/stderr with UTF-8 encoding
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

import typer
from prompt_toolkit import PromptSession
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.history import FileHistory
from prompt_toolkit.patch_stdout import patch_stdout
from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table
from rich.text import Text

from marketbot import __logo__, __version__
from marketbot.agent.skills import SkillsLoader
from marketbot.config.schema import Config
from marketbot.market_reporting import (
    default_market_report_path,
    extract_market_heartbeat_spec,
    infer_market_report_session,
    render_market_report_document,
    render_market_report_notification,
    resolve_market_timezone,
)
from marketbot.utils.helpers import sync_workspace_templates

app = typer.Typer(
    name="marketbot",
    help=f"{__logo__} marketbot - Personal AI Assistant",
    no_args_is_help=True,
)
intel_app = typer.Typer(help="Intel source collection and digest tools")
app.add_typer(intel_app, name="intel")

console = Console()
EXIT_COMMANDS = {"exit", "quit", "/exit", "/quit", ":q"}

# ---------------------------------------------------------------------------
# CLI input: prompt_toolkit for editing, paste, history, and display
# ---------------------------------------------------------------------------

_PROMPT_SESSION: PromptSession | None = None
_SAVED_TERM_ATTRS = None  # original termios settings, restored on exit


def _wait_for_http_health(url: str, timeout_s: float, interval_s: float = 0.2) -> bool:
    """Poll a health endpoint until it returns ok=true or timeout elapses."""
    import time
    import httpx

    deadline = time.monotonic() + max(float(timeout_s), 0.0)
    normalized_url = str(url).rstrip("/")
    while True:
        try:
            response = httpx.get(normalized_url, timeout=2.0)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, dict) and payload.get("ok") is True:
                return True
        except Exception:
            pass
        if time.monotonic() >= deadline:
            return False
        time.sleep(max(float(interval_s), 0.05))


def _tail_text(path: Path, max_lines: int = 8) -> str:
    """Return the last few non-empty lines from a text file."""
    if not Path(path).exists():
        return ""
    try:
        lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return ""
    trimmed = [line for line in lines if line.strip()]
    return "\n".join(trimmed[-max_lines:])


def _parse_env_assignments(path: Path) -> dict[str, str]:
    """Parse simple shell-style export assignments from a file."""
    source = Path(path)
    if not source.exists():
        return {}
    result: dict[str, str] = {}
    try:
        lines = source.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return result
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            result[key] = value
    return result


def _load_json_object(path: Path) -> dict[str, Any] | None:
    """Load a JSON object from disk when present."""
    source = Path(path)
    if not source.exists():
        return None
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _load_jsonl_objects(path: Path) -> list[dict[str, Any]]:
    """Load JSON objects from a JSONL file, skipping malformed lines."""
    source = Path(path)
    if not source.exists():
        return []
    records: list[dict[str, Any]] = []
    try:
        lines = source.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return records
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except Exception:
            continue
        if isinstance(payload, dict):
            records.append(payload)
    return records


def _preview_text(text: str, max_lines: int = 12, max_chars: int = 1600) -> str:
    """Build a compact text preview suitable for JSON payloads."""
    lines = str(text).splitlines()
    preview = "\n".join(lines[:max_lines])
    preview = preview[:max_chars]
    if len(lines) > max_lines or len(str(text)) > len(preview):
        preview = preview.rstrip() + "\n..."
    return preview


def _extract_latest_metrics(text: str) -> dict[str, float | int]:
    """Extract a few common training metrics from log text."""
    patterns: dict[str, str] = {
        "step": r"\b(?:global_step|step|iteration)\s*[:=]\s*(-?\d+)\b",
        "score": r"\bscore\s*[:=]\s*(-?\d+(?:\.\d+)?)\b",
        "reward": r"\breward\s*[:=]\s*(-?\d+(?:\.\d+)?)\b",
        "loss": r"\bloss\s*[:=]\s*(-?\d+(?:\.\d+)?)\b",
        "lr": r"\blr\s*[:=]\s*(-?\d+(?:\.\d+)?)\b",
    }
    metrics: dict[str, float | int] = {}
    for key, pattern in patterns.items():
        matches = re.findall(pattern, text, flags=re.IGNORECASE)
        if not matches:
            continue
        raw = matches[-1]
        if key == "step":
            metrics[key] = int(raw)
        else:
            metrics[key] = float(raw)
    return metrics


def _extract_wandb_info(text: str) -> dict[str, str | None]:
    """Extract W&B URL and run id from log text."""
    url_match = re.findall(r"https://wandb\.ai/\S+", text, flags=re.IGNORECASE)
    wandb_url = url_match[-1] if url_match else None
    run_id = None
    if wandb_url:
        cleaned = wandb_url.rstrip(").,")
        parts = cleaned.split("/")
        if parts:
            run_id = parts[-1] or None
        wandb_url = cleaned
    return {"url": wandb_url, "runId": run_id}


def _summarize_checkpoint_dir(path: Path | None) -> dict[str, Any]:
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


def _build_openclaw_run_report(bundle_dir: Path) -> dict[str, Any]:
    """Build a structured summary for an OpenClaw export bundle and its logs."""
    target = Path(bundle_dir)
    env_example = _parse_env_assignments(target / "env.example")
    env_local = _parse_env_assignments(target / "env.local")
    terminal_example = _parse_env_assignments(target / "terminal_qwen3_8b.env.example")
    terminal_local = _parse_env_assignments(target / "terminal_qwen3_8b.env.local")
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
    checkpoint_summary = _summarize_checkpoint_dir(checkpoint_dir)

    train_stdout_tail = _tail_text(train_stdout_path)
    train_stderr_tail = _tail_text(train_stderr_path)
    env_stdout_tail = _tail_text(env_stdout_path)
    env_stderr_tail = _tail_text(env_stderr_path)
    full_train_text = ""
    for log_path in (train_stdout_path, train_stderr_path):
        try:
            full_train_text += Path(log_path).read_text(encoding="utf-8", errors="replace") + "\n"
        except Exception:
            continue
    wandb_info = _extract_wandb_info(full_train_text)
    metrics = _extract_latest_metrics(full_train_text)
    run_summary = _load_json_object(run_summary_path)
    report_archive = {
        key: str(value)
        for key, value in _resolve_openclaw_report_paths(
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


def _append_openclaw_runs_index(report_payload: dict[str, Any]) -> str:
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


def _extract_compare_metric(item: dict[str, Any], field: str) -> float | int | None:
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


def _summarize_compare_metric(records: list[dict[str, Any]], field: str) -> dict[str, Any]:
    """Summarize a numeric compare field across run index records."""
    normalized = str(field).strip().lower()
    comparable: list[tuple[dict[str, Any], float]] = []
    for item in records:
        value = _extract_compare_metric(item, normalized)
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


def _summarize_run_group(records: list[dict[str, Any]], field: str, group_name: str | None = None) -> dict[str, Any]:
    """Summarize a set of run index records for dashboards."""
    total = len(records)
    success_count = sum(1 for item in records if str(item.get("runOutcome")).strip().lower() == "succeeded")
    return {
        "group": group_name,
        "count": total,
        "successCount": success_count,
        "successRate": (success_count / total) if total else None,
        "compareSummary": _summarize_compare_metric(records, field),
    }


def _group_run_records(records: list[dict[str, Any]], group_by: str, compare_field: str) -> list[dict[str, Any]]:
    """Group run index records by a supported dimension."""
    normalized = str(group_by).strip().lower()
    if normalized != "outcome":
        return []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in records:
        key = str(item.get("runOutcome") or "unknown")
        grouped.setdefault(key, []).append(item)
    summaries = [_summarize_run_group(items, compare_field, group_name=key) for key, items in grouped.items()]
    summaries.sort(key=lambda item: (-(item.get("count") or 0), str(item.get("group") or "")))
    return summaries


def _build_runs_index_payload(
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
    compare_summary = _summarize_compare_metric(filtered, compare_field)
    overall_summary = _summarize_run_group(filtered, compare_field)
    grouped_summary = _group_run_records(filtered, group_by, compare_field) if group_by else []
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


def _render_openclaw_runs_markdown(payload: dict[str, Any]) -> str:
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
            metric_value = _extract_compare_metric(item, str(payload["compareField"]))
            metric_text = f"{metric_value:.4f}" if isinstance(metric_value, (int, float)) else "-"
            step_value = _extract_compare_metric(item, "step")
            step_text = str(int(step_value)) if isinstance(step_value, (int, float)) else "-"
            lines.append(
                f"| {item.get('completedAt') or item.get('recordedAt') or '-'} | {item.get('runOutcome') or '-'} | "
                f"{item.get('failureReason') or '-'} | {step_text} | {metric_text} | {item.get('bundleDir') or '-'} |"
            )
    return "\n".join(lines) + "\n"


def _render_openclaw_runs_csv(payload: dict[str, Any]) -> str:
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
                _extract_compare_metric(item, "step") or "",
                _extract_compare_metric(item, compare_field) or "",
                item.get("bundleDir") or "",
                item.get("wandbUrl") or "",
            ]
        )
    return buffer.getvalue()


def _resolve_openclaw_report_paths(index_path: Path, completed_at: str | None = None) -> dict[str, Path]:
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


def _write_openclaw_runs_archive(
    index_path: Path,
    *,
    completed_at: str | None,
    compare_field: str = "score",
    group_by: str | None = "outcome",
    limit: int = 50,
) -> dict[str, str]:
    """Write dated Markdown/CSV aggregate reports for the current runs index."""
    target = Path(index_path).expanduser()
    records = _load_jsonl_objects(target)
    payload = _build_runs_index_payload(
        records,
        index_path=target,
        outcome=None,
        group_by=group_by,
        compare_field=compare_field,
        limit=limit,
        summary_only=False,
    )
    paths = _resolve_openclaw_report_paths(target, completed_at=completed_at)
    reports_dir = paths["reportsDir"]
    reports_dir.mkdir(parents=True, exist_ok=True)
    paths["summaryMarkdown"].write_text(_render_openclaw_runs_markdown(payload), encoding="utf-8")
    paths["summaryCsv"].write_text(_render_openclaw_runs_csv(payload), encoding="utf-8")
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


def _find_latest_openclaw_report(index_path: Path, report_format: str) -> Path | None:
    """Find the newest dated summary report under the runs-index parent."""
    target = Path(index_path).expanduser()
    reports_root = target.parent / "reports"
    if not reports_root.exists():
        return None
    normalized = report_format.strip().lower()
    filename = "summary.md" if normalized == "markdown" else "summary.csv"
    latest_index = reports_root / "latest.json"
    latest_payload = _load_json_object(latest_index)
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


def _load_latest_openclaw_index_payload(index_path: Path) -> dict[str, Any]:
    """Load latest report summary from latest.json or rebuild it from runs_index.jsonl."""
    target = Path(index_path).expanduser()
    latest_index_path = target.parent / "reports" / "latest.json"
    latest_index = _load_json_object(latest_index_path)
    if latest_index:
        return latest_index
    records = _load_jsonl_objects(target)
    payload = _build_runs_index_payload(
        records,
        index_path=target,
        outcome=None,
        group_by="outcome",
        compare_field="score",
        limit=10,
        summary_only=True,
    )
    paths = _resolve_openclaw_report_paths(target)
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


def _evaluate_openclaw_metric_thresholds(
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


def _render_latest_openclaw_metrics_prometheus(payload: dict[str, Any]) -> str:
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


def _build_openclaw_alerts_payload(metrics_payload: dict[str, Any]) -> dict[str, Any]:
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


def _resolve_openclaw_alert_state_path(index_path: Path) -> Path:
    """Resolve the persisted alert lifecycle state file for latest metrics checks."""
    target = Path(index_path).expanduser()
    return target.parent / "reports" / "alerts_state.json"


def _build_openclaw_alert_history_event(alert: dict[str, Any], *, compare_field: str, event_at: str) -> dict[str, Any]:
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


def _sync_openclaw_alerts_state(index_path: Path, alerts_payload: dict[str, Any]) -> dict[str, Any]:
    """Persist and enrich alerts with lifecycle state across repeated checks."""
    history_limit = 20
    state_path = _resolve_openclaw_alert_state_path(index_path)
    previous_state = _load_json_object(state_path) or {}
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
        recent_events.append(_build_openclaw_alert_history_event(alert, compare_field=compare_field, event_at=generated_at))

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
                _build_openclaw_alert_history_event(resolved_alert, compare_field=compare_field, event_at=generated_at)
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


def _render_openclaw_alertmanager_payload(alerts_payload: dict[str, Any]) -> dict[str, Any]:
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


def _write_latest_openclaw_metrics_github_output(payload: dict[str, Any], output_path: Path) -> None:
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


def _build_latest_openclaw_metrics_payload(
    index_path: Path,
    *,
    min_success_rate: float | None = None,
    min_avg: float | None = None,
    min_best: float | None = None,
    max_worst: float | None = None,
) -> dict[str, Any]:
    """Build the latest OpenClaw metrics payload with threshold evaluation."""
    latest_index = _load_latest_openclaw_index_payload(index_path)
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
    threshold_result = _evaluate_openclaw_metric_thresholds(
        payload,
        min_success_rate=min_success_rate,
        min_avg=min_avg,
        min_best=min_best,
        max_worst=max_worst,
    )
    payload["ok"] = threshold_result["ok"]
    payload["thresholdChecks"] = threshold_result["checks"]
    alerts_payload = _build_openclaw_alerts_payload(payload)
    payload["alertsState"] = _sync_openclaw_alerts_state(index_path, alerts_payload)
    payload["alertsStatePath"] = payload["alertsState"]["statePath"]
    return payload


def _classify_openclaw_launch_error(exc: BaseException, default_reason: str | None = None) -> dict[str, Any]:
    """Map launch exceptions into stable outcome/reason metadata."""
    import subprocess

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


def _flush_pending_tty_input() -> None:
    """Drop unread keypresses typed while the model was generating output."""
    try:
        fd = sys.stdin.fileno()
        if not os.isatty(fd):
            return
    except Exception:
        return

    try:
        import termios
        termios.tcflush(fd, termios.TCIFLUSH)
        return
    except Exception:
        pass

    try:
        while True:
            ready, _, _ = select.select([fd], [], [], 0)
            if not ready:
                break
            if not os.read(fd, 4096):
                break
    except Exception:
        return


def _restore_terminal() -> None:
    """Restore terminal to its original state (echo, line buffering, etc.)."""
    if _SAVED_TERM_ATTRS is None:
        return
    try:
        import termios
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, _SAVED_TERM_ATTRS)
    except Exception:
        pass


def _init_prompt_session() -> None:
    """Create the prompt_toolkit session with persistent file history."""
    global _PROMPT_SESSION, _SAVED_TERM_ATTRS

    # Save terminal state so we can restore it on exit
    try:
        import termios
        _SAVED_TERM_ATTRS = termios.tcgetattr(sys.stdin.fileno())
    except Exception:
        pass

    history_file = Path.home() / ".marketbot" / "history" / "cli_history"
    history_file.parent.mkdir(parents=True, exist_ok=True)

    _PROMPT_SESSION = PromptSession(
        history=FileHistory(str(history_file)),
        enable_open_in_editor=False,
        multiline=False,   # Enter submits (single line mode)
    )


def _print_agent_response(response: str, render_markdown: bool) -> None:
    """Render assistant response with consistent terminal styling."""
    content = response or ""
    body = Markdown(content) if render_markdown else Text(content)
    console.print(f"[cyan]{__logo__} marketbot[/cyan]")
    console.print(body)
    console.print()


def _parse_symbol_csv(symbols: str | None) -> list[str]:
    """Parse comma-separated symbols into a normalized list."""
    if not symbols:
        return []
    result: list[str] = []
    for part in symbols.split(","):
        symbol = part.strip().upper()
        if symbol and symbol not in result:
            result.append(symbol)
    return result


def _parse_float_csv(values: str | None) -> list[float]:
    """Parse comma-separated floats."""
    if not values:
        return []
    result: list[float] = []
    for part in values.split(","):
        text = part.strip()
        if not text:
            continue
        try:
            result.append(float(text))
        except ValueError as exc:
            raise typer.BadParameter(f"invalid numeric value: {text}") from exc
    return result


def _build_market_heartbeat_template(symbols: list[str], timezone: str = "America/New_York") -> str:
    """Create a heartbeat template for recurring market reports."""
    joined = ", ".join(symbols) if symbols else "SPY, QQQ, IWM, GLD, BTC-USD"
    joined_csv = ",".join(symbols) if symbols else "SPY,QQQ,IWM,GLD,BTC-USD"
    return f"""# Market Report Tasks

You are responsible for recurring market monitoring.

<!-- marketbot:mode market-report -->
<!-- marketbot:timezone {timezone} -->
<!-- marketbot:weekdays mon,tue,wed,thu,fri -->
<!-- marketbot:windows 09:20-09:40,11:55-12:10,15:55-16:10 -->
<!-- marketbot:symbols {joined_csv} -->

Active symbols: {joined}

Run a market brief when the current local time is near one of these windows:
- 09:30 local market open
- 12:00 midday check
- 16:00 market close

If the current time is outside those windows, skip.

When you run:
1. Use `market_brief` for the active symbols.
2. Summarize the market state, top signals, macro regime, and scenario playbook.
3. Keep the report concise and actionable.
"""


def _enabled_notify_channels(config: Config) -> set[str]:
    channels = config.channels
    enabled: set[str] = set()
    if channels.telegram.enabled:
        enabled.add("telegram")
    if channels.slack.enabled:
        enabled.add("slack")
    if channels.discord.enabled:
        enabled.add("discord")
    if channels.feishu.enabled:
        enabled.add("feishu")
    return enabled


def _pick_notify_target(
    config: Config,
    *,
    preferred_channel: str,
    preferred_chat_id: str,
) -> tuple[str, str]:
    channel = preferred_channel.strip().lower()
    chat_id = preferred_chat_id.strip()
    enabled = _enabled_notify_channels(config)

    if channel:
        if channel not in enabled:
            raise typer.BadParameter(
                "notify channel must be enabled and one of: telegram, slack, discord, feishu"
            )
        if not chat_id:
            raise typer.BadParameter("chat-id is required when notify-channel is provided")
        return channel, chat_id

    if chat_id:
        raise typer.BadParameter("notify-channel is required when chat-id is provided")

    from marketbot.session.manager import SessionManager

    session_manager = SessionManager(config.workspace_path)
    for item in session_manager.list_sessions():
        key = str(item.get("key") or "")
        if ":" not in key:
            continue
        session_channel, session_chat_id = key.split(":", 1)
        if session_channel in enabled and session_chat_id:
            return session_channel, session_chat_id

    raise typer.BadParameter(
        "no notify target found; provide --notify-channel and --chat-id, or use an enabled channel with prior sessions"
    )


async def _send_message_once(
    config: Config,
    channel_name: str,
    chat_id: str,
    content: str,
    media: list[str],
) -> None:
    """Send one outbound message without starting full listener loops."""
    from marketbot.bus.events import OutboundMessage
    from marketbot.bus.queue import MessageBus

    bus = MessageBus()
    message = OutboundMessage(channel=channel_name, chat_id=chat_id, content=content, media=media)

    if channel_name == "telegram":
        from marketbot.channels.telegram import TelegramChannel
        from telegram.ext import Application
        from telegram.request import HTTPXRequest

        channel = TelegramChannel(
            config.channels.telegram,
            bus,
            groq_api_key=config.providers.groq.api_key,
        )
        req = HTTPXRequest(connection_pool_size=4, pool_timeout=5.0, connect_timeout=30.0, read_timeout=30.0)
        builder = Application.builder().token(config.channels.telegram.token).request(req).get_updates_request(req)
        if config.channels.telegram.proxy:
            builder = builder.proxy(config.channels.telegram.proxy).get_updates_proxy(config.channels.telegram.proxy)
        channel._app = builder.build()
        await channel._app.initialize()
        try:
            await channel.send(message)
        finally:
            await channel._app.shutdown()
            channel._app = None
        return

    if channel_name == "slack":
        from marketbot.channels.slack import SlackChannel
        from slack_sdk.web.async_client import AsyncWebClient

        channel = SlackChannel(config.channels.slack, bus)
        channel._web_client = AsyncWebClient(token=config.channels.slack.bot_token)
        try:
            await channel.send(message)
        finally:
            await channel._web_client.close()
            channel._web_client = None
        return

    if channel_name == "discord":
        import httpx

        from marketbot.channels.discord import DiscordChannel

        channel = DiscordChannel(config.channels.discord, bus)
        channel._http = httpx.AsyncClient(timeout=30.0)
        try:
            await channel.send(message)
        finally:
            await channel._http.aclose()
            channel._http = None
        return

    if channel_name == "feishu":
        from marketbot.channels.feishu import FEISHU_AVAILABLE, FeishuChannel

        if not FEISHU_AVAILABLE:
            raise typer.BadParameter("feishu SDK is not installed")
        import lark_oapi as lark

        channel = FeishuChannel(config.channels.feishu, bus)
        channel._client = lark.Client.builder() \
            .app_id(config.channels.feishu.app_id) \
            .app_secret(config.channels.feishu.app_secret) \
            .log_level(lark.LogLevel.INFO) \
            .build()
        await channel.send(message)
        return

    raise typer.BadParameter("unsupported notify channel; supported: telegram, slack, discord, feishu")


def _is_exit_command(command: str) -> bool:
    """Return True when input should end interactive chat."""
    return command.lower() in EXIT_COMMANDS


async def _read_interactive_input_async() -> str:
    """Read user input using prompt_toolkit (handles paste, history, display).

    prompt_toolkit natively handles:
    - Multiline paste (bracketed paste mode)
    - History navigation (up/down arrows)
    - Clean display (no ghost characters or artifacts)
    """
    if _PROMPT_SESSION is None:
        raise RuntimeError("Call _init_prompt_session() first")
    try:
        with patch_stdout():
            return await _PROMPT_SESSION.prompt_async(
                HTML("<b fg='ansiblue'>You:</b> "),
            )
    except EOFError as exc:
        raise KeyboardInterrupt from exc



def version_callback(value: bool):
    if value:
        console.print(f"{__logo__} marketbot v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        None, "--version", "-v", callback=version_callback, is_eager=True
    ),
):
    """marketbot - Personal AI Assistant."""
    pass


# ============================================================================
# Onboard / Setup
# ============================================================================


@app.command()
def onboard():
    """Initialize marketbot configuration and workspace."""
    from marketbot.config.loader import get_config_path, load_config, save_config
    from marketbot.config.schema import Config
    from marketbot.utils.helpers import get_workspace_path

    config_path = get_config_path()

    if config_path.exists():
        console.print(f"[yellow]Config already exists at {config_path}[/yellow]")
        console.print("  [bold]y[/bold] = overwrite with defaults (existing values will be lost)")
        console.print("  [bold]N[/bold] = refresh config, keeping existing values and adding new fields")
        if typer.confirm("Overwrite?"):
            config = Config()
            save_config(config)
            console.print(f"[green]✓[/green] Config reset to defaults at {config_path}")
        else:
            config = load_config()
            save_config(config)
            console.print(f"[green]✓[/green] Config refreshed at {config_path} (existing values preserved)")
    else:
        save_config(Config())
        console.print(f"[green]✓[/green] Created config at {config_path}")

    # Create workspace
    workspace = get_workspace_path()

    if not workspace.exists():
        workspace.mkdir(parents=True, exist_ok=True)
        console.print(f"[green]✓[/green] Created workspace at {workspace}")

    sync_workspace_templates(workspace)

    console.print(f"\n{__logo__} marketbot is ready!")
    console.print("\nNext steps:")
    console.print("  1. Add your API key to [cyan]~/.marketbot/config.json[/cyan]")
    console.print("     Get one at: https://openrouter.ai/keys")
    console.print("  2. Chat: [cyan]marketbot agent -m \"Hello!\"[/cyan]")
    console.print("\n[dim]Want Telegram/WhatsApp? See: https://github.com/HKUDS/marketbot#-chat-apps[/dim]")





def _make_provider(config: Config):
    """Create the appropriate LLM provider from config."""
    from marketbot.providers.openai_codex_provider import OpenAICodexProvider
    from marketbot.providers.azure_openai_provider import AzureOpenAIProvider

    model = config.agents.defaults.model
    provider_name = config.get_provider_name(model)
    p = config.get_provider(model)

    # OpenAI Codex (OAuth)
    if provider_name == "openai_codex" or model.startswith("openai-codex/"):
        return OpenAICodexProvider(default_model=model)

    # Custom: direct OpenAI-compatible endpoint, bypasses LiteLLM
    from marketbot.providers.custom_provider import CustomProvider
    if provider_name == "custom":
        return CustomProvider(
            api_key=p.api_key if p else "no-key",
            api_base=config.get_api_base(model) or "http://localhost:8000/v1",
            default_model=model,
        )

    # Azure OpenAI: direct Azure OpenAI endpoint with deployment name
    if provider_name == "azure_openai":
        if not p or not p.api_key or not p.api_base:
            console.print("[red]Error: Azure OpenAI requires api_key and api_base.[/red]")
            console.print("Set them in ~/.marketbot/config.json under providers.azure_openai section")
            console.print("Use the model field to specify the deployment name.")
            raise typer.Exit(1)
        
        return AzureOpenAIProvider(
            api_key=p.api_key,
            api_base=p.api_base,
            default_model=model,
        )

    from marketbot.providers.litellm_provider import LiteLLMProvider
    from marketbot.providers.registry import find_by_name
    spec = find_by_name(provider_name)
    if not model.startswith("bedrock/") and not (p and p.api_key) and not (spec and spec.is_oauth):
        console.print("[red]Error: No API key configured.[/red]")
        console.print("Set one in ~/.marketbot/config.json under providers section")
        raise typer.Exit(1)

    return LiteLLMProvider(
        api_key=p.api_key if p else None,
        api_base=config.get_api_base(model),
        default_model=model,
        extra_headers=p.extra_headers if p else None,
        provider_name=provider_name,
    )


def _open_intel_db(config_path: Path | None = None):
    """Open and initialize the intel database for the configured workspace."""
    from marketbot.config.loader import load_config
    from marketbot.domain.intel.storage import connect_intel_db, init_intel_schema

    config = load_config(config_path)
    conn = connect_intel_db(config.workspace_path)
    init_intel_schema(conn)
    return config, conn


async def _collect_intel_sources(conn, *, scope: str, scope_key: str):
    """Collect items for active intel sources in a scope."""
    from marketbot.domain.intel.collector import IntelCollectorService, utc_now_iso
    from marketbot.domain.intel.models import CollectResult
    from marketbot.domain.intel.storage import insert_raw_items, list_sources, mark_source_collected

    service = IntelCollectorService()
    sources = list_sources(conn, scope=scope, scope_key=scope_key, active_only=True)
    results = []
    for source in sources:
        collected_at = utc_now_iso()
        try:
            items = await service.collect_source(source)
            inserted = insert_raw_items(conn, items)
            mark_source_collected(conn, int(source.id or 0), collected_at=collected_at)
            results.append(
                CollectResult(
                    source_id=int(source.id or 0),
                    ok=True,
                    items_collected=len(items),
                    items_inserted=inserted,
                )
            )
        except Exception as exc:
            mark_source_collected(
                conn,
                int(source.id or 0),
                collected_at=collected_at,
                error=str(exc),
            )
            results.append(CollectResult(source_id=int(source.id or 0), ok=False, error=str(exc)))
    return results


def _render_intel_collect_summary(results) -> str:
    """Render a compact summary for intel collection runs."""
    total_sources = len(results)
    ok_count = sum(1 for item in results if item.ok)
    inserted = sum(int(getattr(item, "items_inserted", 0) or 0) for item in results)
    lines = [
        f"Intel collect completed: {ok_count}/{total_sources} sources ok.",
        f"Inserted items: {inserted}",
    ]
    errors = [item for item in results if not item.ok and item.error]
    if errors:
        lines.append("Errors:")
        lines.extend(f"- source #{item.source_id}: {item.error}" for item in errors[:5])
    return "\n".join(lines)


def _build_intel_daily_digest(conn, *, scope: str, scope_key: str, hours: int, limit: int):
    """Build and load the latest daily digest for a scope."""
    from marketbot.domain.intel.digest import build_daily_digest
    from marketbot.domain.intel.storage import list_digests

    digest_id = build_daily_digest(conn, scope=scope, scope_key=scope_key, hours=hours, limit=limit)
    digest = list_digests(
        conn,
        digest_type="daily",
        scope=scope,
        scope_key=scope_key,
        limit=1,
    )[0]
    return digest_id, digest


def _build_cron_schedule(
    *,
    every_minutes: int | None,
    cron_expr: str | None,
    tz: str | None,
):
    """Build a cron schedule from simple CLI options."""
    from marketbot.cron.types import CronSchedule

    if every_minutes and cron_expr:
        raise typer.BadParameter("use either --every-minutes or --cron-expr, not both")
    if every_minutes is not None:
        if every_minutes <= 0:
            raise typer.BadParameter("--every-minutes must be > 0")
        return CronSchedule(kind="every", every_ms=every_minutes * 60 * 1000)
    if cron_expr:
        return CronSchedule(kind="cron", expr=cron_expr, tz=tz)
    raise typer.BadParameter("one of --every-minutes or --cron-expr is required")


def _schedule_intel_job(
    *,
    config_path: Path | None,
    name: str,
    schedule,
    payload_kind: str,
    scope: str,
    scope_key: str,
    deliver: bool = False,
    channel: str | None = None,
    to: str | None = None,
    hours: int = 24,
    limit: int = 12,
):
    """Create a cron job and rewrite its payload for intel execution."""
    from marketbot.config.loader import load_config
    from marketbot.cron.service import CronService

    config = load_config(config_path)
    cron_store_path = config.workspace_path / "cron" / "jobs.json"
    cron = CronService(cron_store_path)
    job = cron.add_job(
        name=name,
        schedule=schedule,
        message=name,
        deliver=deliver,
        channel=channel,
        to=to,
    )
    job.payload.kind = payload_kind
    job.payload.scope = scope
    job.payload.scope_key = scope_key
    job.payload.hours = hours
    job.payload.limit = limit
    cron._save_store()
    return job


def _load_intel_cron_service(config_path: Path | None = None):
    """Load the workspace cron service used by intel scheduled jobs."""
    from marketbot.config.loader import load_config
    from marketbot.cron.service import CronService

    config = load_config(config_path)
    cron_store_path = config.workspace_path / "cron" / "jobs.json"
    return CronService(cron_store_path)


@intel_app.command("source-add")
def intel_source_add(
    name: str = typer.Option(..., help="Source display name"),
    source_type: str = typer.Option(..., "--type", help="Source type: rss or website"),
    url: str = typer.Option(..., help="Source URL"),
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Add an intel source to the workspace registry."""
    from marketbot.domain.intel.models import IntelSource
    from marketbot.domain.intel.storage import add_source

    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        source_id = add_source(
            conn,
            IntelSource(
                name=name,
                source_type=source_type.strip().lower(),
                config_json=json.dumps({"url": url}, ensure_ascii=False),
                scope=scope,
                scope_key=scope_key,
            ),
        )
    finally:
        conn.close()
    console.print(f"[green]✓[/green] Added intel source #{source_id}: {name}")


@intel_app.command("source-list")
def intel_source_list(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """List active intel sources."""
    from marketbot.domain.intel.storage import list_sources

    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        sources = list_sources(conn, scope=scope, scope_key=scope_key, active_only=True)
    finally:
        conn.close()

    table = Table(title="Intel Sources")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Name", style="green")
    table.add_column("Type")
    table.add_column("Scope")
    table.add_column("Last Collected")
    table.add_column("Last Error")
    for source in sources:
        table.add_row(
            str(source.id or ""),
            source.name,
            source.source_type,
            f"{source.scope}:{source.scope_key}",
            source.last_collected_at or "-",
            source.last_error or "-",
        )
    console.print(table)


@intel_app.command("collect")
def intel_collect(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Collect items for all active intel sources in a scope."""
    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        results = asyncio.run(_collect_intel_sources(conn, scope=scope, scope_key=scope_key))
    finally:
        conn.close()

    table = Table(title="Intel Collect Results")
    table.add_column("Source ID", style="cyan")
    table.add_column("Status")
    table.add_column("Collected")
    table.add_column("Inserted")
    table.add_column("Error")
    for result in results:
        table.add_row(
            str(result.source_id),
            "ok" if result.ok else "error",
            str(result.items_collected),
            str(result.items_inserted),
            result.error or "-",
        )
    console.print(table)
    if results and not any(result.ok for result in results):
        raise typer.Exit(1)


@intel_app.command("digest-daily")
def intel_digest_daily(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    hours: int = typer.Option(24, help="Trailing collection window in hours"),
    limit: int = typer.Option(12, help="Maximum digest items"),
    save: bool = typer.Option(True, "--save/--no-save", help="Save markdown report to workspace/reports"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Build a daily digest from recently collected intel items."""
    from marketbot.config.loader import load_config

    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        digest_id, digest = _build_intel_daily_digest(
            conn,
            scope=scope,
            scope_key=scope_key,
            hours=hours,
            limit=limit,
        )
    finally:
        conn.close()

    console.print(f"[green]✓[/green] Built digest #{digest_id}: {digest.title}")
    console.print(Markdown(digest.body_markdown))

    if save:
        config_obj = load_config(config_path)
        reports_dir = config_obj.workspace_path / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        target = reports_dir / f"intel_digest_daily_{stamp}.md"
        target.write_text(digest.body_markdown, encoding="utf-8")
        console.print(f"[dim]Saved to {target}[/dim]")


@intel_app.command("digest-list")
def intel_digest_list(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    limit: int = typer.Option(20, help="Maximum digests to list"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """List recent intel digests for a scope."""
    from marketbot.domain.intel.storage import list_digests

    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        digests = list_digests(
            conn,
            digest_type="daily",
            scope=scope,
            scope_key=scope_key,
            limit=limit,
        )
    finally:
        conn.close()

    table = Table(title="Intel Digests")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Type")
    table.add_column("Title", style="green")
    table.add_column("Created At")
    table.add_column("Window")
    for digest in digests:
        table.add_row(
            str(digest.id or ""),
            digest.digest_type,
            digest.title,
            digest.created_at or "-",
            f"{digest.window_start or '-'} -> {digest.window_end or '-'}",
        )
    console.print(table)


@intel_app.command("digest-show")
def intel_digest_show(
    digest_id: int = typer.Argument(..., help="Digest id"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Show a single intel digest by id."""
    from marketbot.domain.intel.storage import get_digest

    config_path = Path(config) if config else None
    _, conn = _open_intel_db(config_path)
    try:
        digest = get_digest(conn, digest_id)
    finally:
        conn.close()

    if not digest:
        console.print(f"[red]Intel digest not found: {digest_id}[/red]")
        raise typer.Exit(1)

    console.print(f"[green]Digest #{digest_id}[/green] {digest.title}")
    console.print(Markdown(digest.body_markdown))


@intel_app.command("schedule-collect")
def intel_schedule_collect(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    every_minutes: int | None = typer.Option(None, help="Repeat collection every N minutes"),
    cron_expr: str | None = typer.Option(None, help="Cron expression for collection"),
    tz: str | None = typer.Option(None, help="Timezone for cron expressions"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Schedule recurring intel source collection."""
    config_path = Path(config) if config else None
    schedule = _build_cron_schedule(
        every_minutes=every_minutes,
        cron_expr=cron_expr,
        tz=tz,
    )
    job = _schedule_intel_job(
        config_path=config_path,
        name=f"intel collect [{scope}:{scope_key}]",
        schedule=schedule,
        payload_kind="intel_collect",
        scope=scope,
        scope_key=scope_key,
    )
    console.print(f"[green]✓[/green] Scheduled intel collect job {job.id}: {job.name}")


@intel_app.command("schedule-daily")
def intel_schedule_daily(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    every_minutes: int | None = typer.Option(None, help="Repeat digest generation every N minutes"),
    cron_expr: str | None = typer.Option("0 8 * * *", help="Cron expression for digest generation"),
    tz: str | None = typer.Option("Asia/Shanghai", help="Timezone for cron expressions"),
    hours: int = typer.Option(24, help="Trailing collection window in hours"),
    limit: int = typer.Option(12, help="Maximum digest items"),
    deliver: bool = typer.Option(False, help="Deliver digest to a channel when built"),
    channel: str | None = typer.Option(None, help="Target channel for delivery"),
    to: str | None = typer.Option(None, help="Target chat id for delivery"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Schedule recurring daily digest generation."""
    if deliver and (not channel or not to):
        raise typer.BadParameter("--channel and --to are required when --deliver is set")
    config_path = Path(config) if config else None
    schedule = _build_cron_schedule(
        every_minutes=every_minutes,
        cron_expr=cron_expr,
        tz=tz,
    )
    job = _schedule_intel_job(
        config_path=config_path,
        name=f"intel daily digest [{scope}:{scope_key}]",
        schedule=schedule,
        payload_kind="intel_digest_daily",
        scope=scope,
        scope_key=scope_key,
        deliver=deliver,
        channel=channel,
        to=to,
        hours=hours,
        limit=limit,
    )
    console.print(f"[green]✓[/green] Scheduled intel daily digest job {job.id}: {job.name}")


@intel_app.command("schedule-latest-daily")
def intel_schedule_latest_daily(
    scope: str = typer.Option("workspace", help="Logical scope"),
    scope_key: str = typer.Option("", help="Scope identifier"),
    collect_cron_expr: str = typer.Option("55 7 * * *", help="Cron expression for upstream collection"),
    digest_cron_expr: str = typer.Option("0 8 * * *", help="Cron expression for digest generation"),
    tz: str | None = typer.Option("Asia/Shanghai", help="Timezone for cron expressions"),
    hours: int = typer.Option(24, help="Trailing collection window in hours"),
    limit: int = typer.Option(12, help="Maximum digest items"),
    deliver: bool = typer.Option(False, help="Deliver digest to a channel when built"),
    channel: str | None = typer.Option(None, help="Target channel for delivery"),
    to: str | None = typer.Option(None, help="Target chat id for delivery"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Schedule paired collection and digest jobs for fresh daily intel digests."""
    if deliver and (not channel or not to):
        raise typer.BadParameter("--channel and --to are required when --deliver is set")
    config_path = Path(config) if config else None
    collect_schedule = _build_cron_schedule(
        every_minutes=None,
        cron_expr=collect_cron_expr,
        tz=tz,
    )
    digest_schedule = _build_cron_schedule(
        every_minutes=None,
        cron_expr=digest_cron_expr,
        tz=tz,
    )
    collect_job = _schedule_intel_job(
        config_path=config_path,
        name=f"intel collect [{scope}:{scope_key}]",
        schedule=collect_schedule,
        payload_kind="intel_collect",
        scope=scope,
        scope_key=scope_key,
    )
    digest_job = _schedule_intel_job(
        config_path=config_path,
        name=f"intel daily digest [{scope}:{scope_key}]",
        schedule=digest_schedule,
        payload_kind="intel_digest_daily",
        scope=scope,
        scope_key=scope_key,
        deliver=deliver,
        channel=channel,
        to=to,
        hours=hours,
        limit=limit,
    )
    console.print(
        "[green]✓[/green] Scheduled latest intel daily workflow: "
        f"collect job {collect_job.id}, digest job {digest_job.id}"
    )


@intel_app.command("schedule-list")
def intel_schedule_list(
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """List scheduled intel cron jobs."""
    config_path = Path(config) if config else None
    cron = _load_intel_cron_service(config_path)
    jobs = [
        job
        for job in cron.list_jobs(include_disabled=True)
        if job.payload.kind in {"intel_collect", "intel_digest_daily"}
    ]

    table = Table(title="Intel Scheduled Jobs")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Name", style="green")
    table.add_column("Kind")
    table.add_column("Enabled")
    table.add_column("Schedule")
    table.add_column("Next Run")

    for job in jobs:
        if job.schedule.kind == "every":
            schedule_text = f"every {int((job.schedule.every_ms or 0) / 60000)}m"
        elif job.schedule.kind == "cron":
            schedule_text = f"{job.schedule.expr} [{job.schedule.tz or 'local'}]"
        else:
            schedule_text = f"at {job.schedule.at_ms}"
        table.add_row(
            job.id,
            job.name,
            job.payload.kind,
            "yes" if job.enabled else "no",
            schedule_text,
            str(job.state.next_run_at_ms or "-"),
        )

    console.print(table)


@intel_app.command("schedule-remove")
def intel_schedule_remove(
    job_id: str = typer.Argument(..., help="Cron job id"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
):
    """Remove a scheduled intel cron job."""
    config_path = Path(config) if config else None
    cron = _load_intel_cron_service(config_path)
    jobs = {job.id: job for job in cron.list_jobs(include_disabled=True)}
    job = jobs.get(job_id)
    if not job or job.payload.kind not in {"intel_collect", "intel_digest_daily"}:
        console.print(f"[red]Intel cron job not found: {job_id}[/red]")
        raise typer.Exit(1)
    removed = cron.remove_job(job_id)
    if not removed:
        console.print(f"[red]Failed to remove intel cron job: {job_id}[/red]")
        raise typer.Exit(1)
    console.print(f"[green]✓[/green] Removed intel scheduled job {job_id}")


# ============================================================================
# Gateway / Server
# ============================================================================


@app.command()
def gateway(
    port: int = typer.Option(18790, "--port", "-p", help="Gateway port"),
    workspace: str | None = typer.Option(None, "--workspace", "-w", help="Workspace directory"),
    config: str | None = typer.Option(None, "--config", "-c", help="Config file path"),
    heartbeat_interval: int | None = typer.Option(None, "--heartbeat-interval", "-i", help="Heartbeat interval in seconds"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    """Start the marketbot gateway."""
    from marketbot.agent.loop import AgentLoop
    from marketbot.bus.queue import MessageBus
    from marketbot.channels.manager import ChannelManager
    from marketbot.config.loader import load_config
    from marketbot.cron.service import CronService
    from marketbot.cron.types import CronJob
    from marketbot.heartbeat.service import HeartbeatService
    from marketbot.session.manager import SessionManager

    if verbose:
        import logging
        logging.basicConfig(level=logging.DEBUG)

    config_path = Path(config) if config else None
    config = load_config(config_path)
    if workspace:
        config.agents.defaults.workspace = workspace
    
    if heartbeat_interval is not None:
        config.gateway.heartbeat.interval_s = heartbeat_interval

    console.print(f"{__logo__} Starting marketbot gateway on port {port}...")
    console.print(f"[dim]{_format_browser_runtime_summary(config)}[/dim]")
    sync_workspace_templates(config.workspace_path)
    bus = MessageBus()
    provider = _make_provider(config)
    session_manager = SessionManager(config.workspace_path)

    # Create cron service first (callback set after agent creation)
    # Use workspace path for per-instance cron store
    cron_store_path = config.workspace_path / "cron" / "jobs.json"
    cron = CronService(cron_store_path)

    # Create agent with cron service
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        temperature=config.agents.defaults.temperature,
        max_tokens=config.agents.defaults.max_tokens,
        max_iterations=config.agents.defaults.max_tool_iterations,
        memory_window=config.agents.defaults.memory_window,
        reasoning_effort=config.agents.defaults.reasoning_effort,
        brave_api_key=config.tools.web.search.api_key or None,
        web_proxy=config.tools.web.proxy or None,
        browser_config=config.tools.browser,
        exec_config=config.tools.exec,
        cron_service=cron,
        restrict_to_workspace=config.tools.restrict_to_workspace,
        session_manager=session_manager,
        mcp_servers=config.tools.mcp_servers,
        channels_config=config.channels,
        market_config=config.tools.market,
        memory_layer=config.agents.defaults.memory_layer,
        layered_consolidation=config.agents.defaults.layered_consolidation,
    )

    # Set cron callback (needs agent)
    async def on_cron_job(job: CronJob) -> str | None:
        """Execute a cron job through the agent."""
        from marketbot.agent.tools.cron import CronTool
        from marketbot.agent.tools.message import MessageTool
        if job.payload.kind == "intel_collect":
            _, intel_conn = _open_intel_db(config_path)
            try:
                results = await _collect_intel_sources(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                )
                return _render_intel_collect_summary(results)
            finally:
                intel_conn.close()

        if job.payload.kind == "intel_digest_daily":
            _, intel_conn = _open_intel_db(config_path)
            try:
                _, digest = _build_intel_daily_digest(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                    hours=job.payload.hours,
                    limit=job.payload.limit,
                )
                if job.payload.deliver and job.payload.to:
                    from marketbot.bus.events import OutboundMessage

                    await bus.publish_outbound(
                        OutboundMessage(
                            channel=job.payload.channel or "cli",
                            chat_id=job.payload.to,
                            content=digest.body_markdown,
                        )
                    )
                    return digest.body_markdown
                return digest.body_markdown
            finally:
                intel_conn.close()

        reminder_note = (
            "[Scheduled Task] Timer finished.\n\n"
            f"Task '{job.name}' has been triggered.\n"
            f"Scheduled instruction: {job.payload.message}"
        )

        # Prevent the agent from scheduling new cron jobs during execution
        cron_tool = agent.tools.get("cron")
        cron_token = None
        if isinstance(cron_tool, CronTool):
            cron_token = cron_tool.set_cron_context(True)
        try:
            response = await agent.process_direct(
                reminder_note,
                session_key=f"cron:{job.id}",
                channel=job.payload.channel or "cli",
                chat_id=job.payload.to or "direct",
            )
        finally:
            if isinstance(cron_tool, CronTool) and cron_token is not None:
                cron_tool.reset_cron_context(cron_token)

        message_tool = agent.tools.get("message")
        if isinstance(message_tool, MessageTool) and message_tool._sent_in_turn:
            return response

        if job.payload.deliver and job.payload.to and response:
            from marketbot.bus.events import OutboundMessage
            await bus.publish_outbound(OutboundMessage(
                channel=job.payload.channel or "cli",
                chat_id=job.payload.to,
                content=response
            ))
        return response
    cron.on_job = on_cron_job

    # Create channel manager
    channels = ChannelManager(config, bus)

    def _pick_heartbeat_target() -> tuple[str, str]:
        """Pick a routable channel/chat target for heartbeat-triggered messages."""
        enabled = set(channels.enabled_channels)
        # Prefer the most recently updated non-internal session on an enabled channel.
        for item in session_manager.list_sessions():
            key = item.get("key") or ""
            if ":" not in key:
                continue
            channel, chat_id = key.split(":", 1)
            if channel in {"cli", "system"}:
                continue
            if channel in enabled and chat_id:
                return channel, chat_id
        # Fallback keeps prior behavior but remains explicit.
        return "cli", "direct"

    # Create heartbeat service
    heartbeat_delivery: dict[str, object] = {}

    async def on_heartbeat_execute(tasks: str) -> str:
        """Phase 2: execute heartbeat tasks through the full agent loop."""
        from marketbot.agent.tools.market import MarketBriefTool

        heartbeat_delivery.clear()
        heartbeat_path = config.workspace_path / "HEARTBEAT.md"
        if heartbeat_path.exists():
            try:
                heartbeat_content = heartbeat_path.read_text(encoding="utf-8")
            except Exception:
                heartbeat_content = ""
            heartbeat_spec = extract_market_heartbeat_spec(heartbeat_content)
            if heartbeat_spec:
                tool = MarketBriefTool(config.tools.market)
                payload = json.loads(
                    await tool.execute(
                        symbols=list(heartbeat_spec["symbols"]),
                        includeNews=True,
                        includeMacro=True,
                        includeSocial=True,
                    )
                )
                report_markdown = render_market_report_document(
                    payload,
                    symbols=list(heartbeat_spec["symbols"]),
                    headline="",
                    session=str(heartbeat_spec["session"]),
                    timezone_name=str(heartbeat_spec["timezone"]),
                )
                report_path = default_market_report_path(
                    config.workspace_path,
                    str(heartbeat_spec["session"]),
                    str(heartbeat_spec["timezone"]),
                )
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(report_markdown, encoding="utf-8")
                heartbeat_delivery.update(
                    {
                        "kind": "market-report",
                        "payload": payload,
                        "symbols": list(heartbeat_spec["symbols"]),
                        "session": str(heartbeat_spec["session"]),
                        "timezone": str(heartbeat_spec["timezone"]),
                        "report_path": str(report_path),
                    }
                )
                return report_markdown

        channel, chat_id = _pick_heartbeat_target()

        async def _silent(*_args, **_kwargs):
            pass

        return await agent.process_direct(
            tasks,
            session_key="heartbeat",
            channel=channel,
            chat_id=chat_id,
            on_progress=_silent,
        )

    async def on_heartbeat_notify(response: str) -> None:
        """Deliver a heartbeat response to the user's channel."""
        from marketbot.bus.events import OutboundMessage
        channel, chat_id = _pick_heartbeat_target()
        if channel == "cli":
            return  # No external channel available to deliver to
        if heartbeat_delivery.get("kind") == "market-report":
            payload = dict(heartbeat_delivery.get("payload") or {})
            symbols = list(heartbeat_delivery.get("symbols") or [])
            session = str(heartbeat_delivery.get("session") or "intraday")
            timezone_name = str(heartbeat_delivery.get("timezone") or "America/New_York")
            report_path = Path(str(heartbeat_delivery.get("report_path") or ""))
            summary = render_market_report_notification(
                payload,
                symbols=symbols,
                session=session,
                timezone_name=timezone_name,
                report_path=report_path,
                channel=channel,
            )
            await bus.publish_outbound(
                OutboundMessage(
                    channel=channel,
                    chat_id=chat_id,
                    content=summary,
                    media=[str(report_path)] if report_path.is_file() else [],
                    metadata={"market_report": {"session": session, "path": str(report_path)}},
                )
            )
            return

        await bus.publish_outbound(OutboundMessage(channel=channel, chat_id=chat_id, content=response))

    hb_cfg = config.gateway.heartbeat
    heartbeat = HeartbeatService(
        workspace=config.workspace_path,
        provider=provider,
        model=agent.model,
        on_execute=on_heartbeat_execute,
        on_notify=on_heartbeat_notify,
        interval_s=hb_cfg.interval_s,
        enabled=hb_cfg.enabled,
    )

    if channels.enabled_channels:
        console.print(f"[green]✓[/green] Channels enabled: {', '.join(channels.enabled_channels)}")
    else:
        console.print("[yellow]Warning: No channels enabled[/yellow]")

    cron_status = cron.status()
    if cron_status["jobs"] > 0:
        console.print(f"[green]✓[/green] Cron: {cron_status['jobs']} scheduled jobs")

    console.print(f"[green]✓[/green] Heartbeat: every {hb_cfg.interval_s}s")

    async def run():
        try:
            await cron.start()
            await heartbeat.start()
            await asyncio.gather(
                agent.run(),
                channels.start_all(),
            )
        except KeyboardInterrupt:
            console.print("\nShutting down...")
        finally:
            await agent.close_mcp()
            heartbeat.stop()
            cron.stop()
            agent.stop()
            await channels.stop_all()

    asyncio.run(run())




# ============================================================================
# Agent Commands
# ============================================================================


@app.command()
def agent(
    message: str = typer.Option(None, "--message", "-m", help="Message to send to the agent"),
    session_id: str = typer.Option("cli:direct", "--session", "-s", help="Session ID"),
    markdown: bool = typer.Option(True, "--markdown/--no-markdown", help="Render assistant output as Markdown"),
    logs: bool = typer.Option(False, "--logs/--no-logs", help="Show marketbot runtime logs during chat"),
):
    """Interact with the agent directly."""
    from loguru import logger

    from marketbot.agent.loop import AgentLoop
    from marketbot.bus.queue import MessageBus
    from marketbot.config.loader import get_data_dir, load_config
    from marketbot.cron.service import CronService

    config = load_config()
    sync_workspace_templates(config.workspace_path)

    bus = MessageBus()
    provider = _make_provider(config)

    # Create cron service for tool usage (no callback needed for CLI unless running)
    cron_store_path = get_data_dir() / "cron" / "jobs.json"
    cron = CronService(cron_store_path)

    if logs:
        logger.enable("marketbot")
    else:
        logger.disable("marketbot")

    agent_loop = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=config.workspace_path,
        model=config.agents.defaults.model,
        temperature=config.agents.defaults.temperature,
        max_tokens=config.agents.defaults.max_tokens,
        max_iterations=config.agents.defaults.max_tool_iterations,
        memory_window=config.agents.defaults.memory_window,
        reasoning_effort=config.agents.defaults.reasoning_effort,
        brave_api_key=config.tools.web.search.api_key or None,
        web_proxy=config.tools.web.proxy or None,
        browser_config=config.tools.browser,
        exec_config=config.tools.exec,
        cron_service=cron,
        restrict_to_workspace=config.tools.restrict_to_workspace,
        mcp_servers=config.tools.mcp_servers,
        channels_config=config.channels,
        market_config=config.tools.market,
        memory_layer=config.agents.defaults.memory_layer,
        layered_consolidation=config.agents.defaults.layered_consolidation,
    )

    # Show spinner when logs are off (no output to miss); skip when logs are on
    def _thinking_ctx():
        if logs:
            from contextlib import nullcontext
            return nullcontext()
        # Animated spinner is safe to use with prompt_toolkit input handling
        return console.status("[dim]marketbot is thinking...[/dim]", spinner="dots")

    async def _cli_progress(content: str, *, tool_hint: bool = False) -> None:
        ch = agent_loop.channels_config
        if ch and tool_hint and not ch.send_tool_hints:
            return
        if ch and not tool_hint and not ch.send_progress:
            return
        console.print(f"  [dim]↳ {content}[/dim]")

    if message:
        # Single message mode — direct call, no bus needed
        async def run_once():
            with _thinking_ctx():
                response = await agent_loop.process_direct(message, session_id, on_progress=_cli_progress)
            _print_agent_response(response, render_markdown=markdown)
            await agent_loop.close_mcp()

        asyncio.run(run_once())
    else:
        # Interactive mode — route through bus like other channels
        from marketbot.bus.events import InboundMessage
        _init_prompt_session()
        console.print(f"{__logo__} Interactive mode (type [bold]exit[/bold] or [bold]Ctrl+C[/bold] to quit)")
        console.print(f"[dim]{_format_browser_runtime_summary(config)}[/dim]\n")

        if ":" in session_id:
            cli_channel, cli_chat_id = session_id.split(":", 1)
        else:
            cli_channel, cli_chat_id = "cli", session_id

        def _handle_signal(signum, frame):
            sig_name = signal.Signals(signum).name
            _restore_terminal()
            console.print(f"\nReceived {sig_name}, goodbye!")
            sys.exit(0)

        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)
        # SIGHUP is not available on Windows
        if hasattr(signal, 'SIGHUP'):
            signal.signal(signal.SIGHUP, _handle_signal)
        # Ignore SIGPIPE to prevent silent process termination when writing to closed pipes
        # SIGPIPE is not available on Windows
        if hasattr(signal, 'SIGPIPE'):
            signal.signal(signal.SIGPIPE, signal.SIG_IGN)

        async def run_interactive():
            bus_task = asyncio.create_task(agent_loop.run())
            turn_done = asyncio.Event()
            turn_done.set()
            turn_response: list[str] = []

            async def _consume_outbound():
                while True:
                    try:
                        msg = await asyncio.wait_for(bus.consume_outbound(), timeout=1.0)
                        if msg.metadata.get("_progress"):
                            is_tool_hint = msg.metadata.get("_tool_hint", False)
                            ch = agent_loop.channels_config
                            if ch and is_tool_hint and not ch.send_tool_hints:
                                pass
                            elif ch and not is_tool_hint and not ch.send_progress:
                                pass
                            else:
                                console.print(f"  [dim]↳ {msg.content}[/dim]")
                        elif not turn_done.is_set():
                            if msg.content:
                                turn_response.append(msg.content)
                            turn_done.set()
                        elif msg.content:
                            console.print()
                            _print_agent_response(msg.content, render_markdown=markdown)
                    except asyncio.TimeoutError:
                        continue
                    except asyncio.CancelledError:
                        break

            outbound_task = asyncio.create_task(_consume_outbound())

            try:
                while True:
                    try:
                        _flush_pending_tty_input()
                        user_input = await _read_interactive_input_async()
                        command = user_input.strip()
                        if not command:
                            continue

                        if _is_exit_command(command):
                            _restore_terminal()
                            console.print("\nGoodbye!")
                            break

                        turn_done.clear()
                        turn_response.clear()

                        await bus.publish_inbound(InboundMessage(
                            channel=cli_channel,
                            sender_id="user",
                            chat_id=cli_chat_id,
                            content=user_input,
                        ))

                        with _thinking_ctx():
                            await turn_done.wait()

                        if turn_response:
                            _print_agent_response(turn_response[0], render_markdown=markdown)
                    except KeyboardInterrupt:
                        _restore_terminal()
                        console.print("\nGoodbye!")
                        break
                    except EOFError:
                        _restore_terminal()
                        console.print("\nGoodbye!")
                        break
            finally:
                agent_loop.stop()
                outbound_task.cancel()
                await asyncio.gather(bus_task, outbound_task, return_exceptions=True)
                await agent_loop.close_mcp()

        asyncio.run(run_interactive())


# ============================================================================
# Market Commands
# ============================================================================


market_app = typer.Typer(help="Market analysis commands")
app.add_typer(market_app, name="market")

rl_app = typer.Typer(help="Reinforcement learning utilities")
app.add_typer(rl_app, name="rl")


@market_app.command("report")
def market_report(
    symbols: str = typer.Option("", "--symbols", "-s", help="Comma-separated symbols, e.g. NVDA,SPY,GLD"),
    headline: str = typer.Option("", "--headline", "-h", help="Optional key headline"),
    body: str = typer.Option("", "--body", help="Optional headline detail/body"),
    timezone: str = typer.Option("America/New_York", "--timezone", help="Timezone for report session labeling"),
    session: str = typer.Option("auto", "--session", help="Report session: auto, premarket, intraday, close"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON instead of markdown brief"),
    save: bool = typer.Option(False, "--save", help="Save markdown report to workspace/reports"),
    notify: bool = typer.Option(False, "--notify", help="Send summary + report attachment to a channel"),
    notify_channel: str = typer.Option("", "--notify-channel", help="Target channel: telegram, slack, discord, feishu"),
    chat_id: str = typer.Option("", "--chat-id", help="Target chat/channel id for --notify"),
):
    """Generate a market brief directly from market tools."""
    from marketbot.agent.tools.market import MarketBriefTool
    from marketbot.config.loader import load_config

    normalized_session = session.strip().lower() or "auto"
    if normalized_session not in {"auto", "premarket", "intraday", "close"}:
        raise typer.BadParameter("session must be one of: auto, premarket, intraday, close")

    config = load_config()
    notify_target: tuple[str, str] | None = None
    if notify:
        notify_target = _pick_notify_target(
            config,
            preferred_channel=notify_channel,
            preferred_chat_id=chat_id,
        )
    selected_symbols = _parse_symbol_csv(symbols) or config.tools.market.default_symbols
    tool = MarketBriefTool(config.tools.market)

    async def run_once() -> dict:
        raw = await tool.execute(
            symbols=selected_symbols,
            headline=headline,
            body=body,
            includeNews=True,
            includeMacro=True,
            includeSocial=True,
        )
        return json.loads(raw)

    payload = asyncio.run(run_once())
    brief_markdown = payload.get("briefMarkdown", "")
    resolved_session = (
        infer_market_report_session(datetime.now(resolve_market_timezone(timezone)))
        if normalized_session == "auto"
        else normalized_session
    )
    report_markdown = render_market_report_document(
        payload,
        symbols=selected_symbols,
        headline=headline,
        session=resolved_session,
        timezone_name=timezone,
    )
    report_path: Path | None = None

    if (save or notify) and report_markdown:
        report_path = default_market_report_path(config.workspace_path, resolved_session, timezone)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_markdown, encoding="utf-8")
        if save:
            console.print(f"[green]✓[/green] Saved report to {report_path}")

    if notify:
        if notify_target is None:
            raise typer.BadParameter("notify target resolution failed")
        channel_name, target_chat_id = notify_target
        if report_path is None:
            raise typer.BadParameter("notify requires a generated report")
        notify_text = render_market_report_notification(
            payload,
            symbols=selected_symbols,
            session=resolved_session,
            timezone_name=timezone,
            report_path=report_path,
            channel=channel_name,
        )
        asyncio.run(_send_message_once(config, channel_name, target_chat_id, notify_text, [str(report_path)]))
        console.print(f"[green]✓[/green] Sent report to {channel_name}:{target_chat_id}")

    if json_output:
        console.print_json(data=payload)
    else:
        console.print(Markdown(brief_markdown or "No market brief generated."))


@market_app.command("heartbeat-setup")
def market_heartbeat_setup(
    symbols: str = typer.Option("", "--symbols", "-s", help="Comma-separated symbols to monitor"),
    timezone: str = typer.Option("America/New_York", "--timezone", "-t", help="IANA timezone, e.g. America/New_York"),
    overwrite: bool = typer.Option(False, "--overwrite", help="Replace existing HEARTBEAT.md content"),
):
    """Create or append a heartbeat template for recurring market reports."""
    from marketbot.config.loader import load_config

    config = load_config()
    heartbeat_path = config.workspace_path / "HEARTBEAT.md"
    content = _build_market_heartbeat_template(_parse_symbol_csv(symbols), timezone=timezone)

    if heartbeat_path.exists() and not overwrite:
        existing = heartbeat_path.read_text(encoding="utf-8")
        if content.strip() not in existing:
            heartbeat_path.write_text(existing.rstrip() + "\n\n---\n\n" + content, encoding="utf-8")
    else:
        heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
        heartbeat_path.write_text(content, encoding="utf-8")

    console.print(f"[green]✓[/green] Updated {heartbeat_path}")


@rl_app.command("evaluate")
def rl_evaluate(
    symbol: str = typer.Option("", "--symbol", help="Ticker symbol for the offline episode"),
    prices: str = typer.Option("", "--prices", help="Comma-separated historical prices"),
    task_file: Path | None = typer.Option(None, "--task-file", help="Optional JSON task file"),
    task_key: str = typer.Option("adhoc", "--task-key", help="Task key used for the offline episode"),
    action: str = typer.Option("buy", "--action", help="Initial action: buy, reduce, watch, sell, flat"),
    position_pct: float = typer.Option(1.0, "--position-pct", min=0.0, max=1.0, help="Target position size"),
    steps: int = typer.Option(0, "--steps", min=0, help="Bars to advance; 0 means until episode end"),
    drawdown_coef: float = typer.Option(0.5, "--drawdown-coef", min=0.0, help="Drawdown penalty coefficient"),
    turnover_coef: float = typer.Option(0.02, "--turnover-coef", min=0.0, help="Turnover penalty coefficient"),
    slippage_bps: float = typer.Option(5.0, "--slippage-bps", min=0.0, help="Slippage in basis points"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON result"),
):
    """Evaluate a single offline market episode with the local RL environment."""
    from marketbot.rl.env.market_env import LocalMarketEnv

    if task_file is not None:
        task_payload = json.loads(task_file.read_text(encoding="utf-8"))
        resolved_key = str(task_payload.get("task_key") or task_key)
        task_meta = dict(task_payload)
        task_meta.pop("task_key", None)
    else:
        clean_symbol = symbol.strip().upper()
        parsed_prices = _parse_float_csv(prices)
        if not clean_symbol:
            raise typer.BadParameter("--symbol is required when --task-file is not provided")
        if len(parsed_prices) < 2:
            raise typer.BadParameter("--prices must contain at least two values")
        resolved_key = task_key
        task_meta = {
            "symbol": clean_symbol,
            "prices": parsed_prices,
            "instruction": f"Trade {clean_symbol} for offline evaluation.",
            "drawdown_coef": drawdown_coef,
            "turnover_coef": turnover_coef,
            "slippage_bps": slippage_bps,
        }

    env = LocalMarketEnv(task_catalog={resolved_key: task_meta})
    lease = asyncio.run(env.allocate(resolved_key, request_id="cli"))
    lease_id = str(lease["lease_id"])
    asyncio.run(env.reset(lease_id, task_meta=task_meta, run_ctx={"uid": "cli"}))
    if action.strip().lower() != "watch" or position_pct > 0:
        asyncio.run(
            env.exec_tool(
                lease_id,
                "submit_trade_action",
                {"action": action.strip().lower(), "position_pct": position_pct},
            )
        )
    advance_steps = steps if steps > 0 else max(len(task_meta.get("prices", [])) - 1, 1)
    asyncio.run(env.exec_tool(lease_id, "advance_time", {"steps": advance_steps}))
    details = env.evaluate_details(lease_id)
    asyncio.run(env.close(lease_id))

    if json_output:
        console.print_json(json.dumps(details, ensure_ascii=False))
        return

    reward = details["reward"]
    console.print("[bold]Offline RL Evaluation[/bold]")
    console.print(f"Task: {details['taskKey']} | Symbol: {details['symbol']}")
    console.print(
        "Reward: "
        f"{reward['score']:.4f} | Return: {reward['realized_return']:.4f} | "
        f"MaxDD: {details['maxDrawdown']:.4f} | Turnover: {details['turnover']:.4f}"
    )


@rl_app.command("build-dataset")
def rl_build_dataset(
    input_path: Path | None = typer.Option(None, "--input", help="Input rollout JSONL"),
    output_path: Path | None = typer.Option(None, "--output", help="Output dataset JSONL"),
    dataset_type: str = typer.Option("auto", "--type", help="Dataset type: auto, signal, episode"),
):
    """Convert rollout logs into lightweight dataset records."""
    from marketbot.config.loader import load_config
    from marketbot.rl.dataset import (
        build_market_episode_dataset_records,
        build_market_signal_dataset_records,
        detect_rollout_type,
        load_market_signal_rollouts,
        write_jsonl,
    )

    config = load_config()
    workspace = config.workspace_path
    default_input = workspace / config.tools.market.policy.rollout_log_path
    source = input_path or default_input
    requested_type = dataset_type.strip().lower() or "auto"
    if requested_type not in {"auto", "signal", "episode"}:
        raise typer.BadParameter("--type must be one of: auto, signal, episode")

    events = load_market_signal_rollouts(source)
    if not events:
        raise typer.BadParameter(f"no rollout events found in {source}")
    resolved_type = detect_rollout_type(events) if requested_type == "auto" else requested_type
    if resolved_type == "episode":
        records = build_market_episode_dataset_records(events)
        default_output = workspace / "rl" / "datasets" / "market_episode_dataset.jsonl"
    else:
        records = build_market_signal_dataset_records(events)
        default_output = workspace / "rl" / "datasets" / "market_signal_dataset.jsonl"
    target = output_path or default_output
    if not records:
        raise typer.BadParameter(f"no dataset records could be built from {source}")
    written = write_jsonl(target, records)
    console.print(f"[green]✓[/green] Wrote {len(records)} {resolved_type} records to {written}")


@rl_app.command("collect")
def rl_collect(
    symbol: str = typer.Option(..., "--symbol", help="Ticker symbol for the offline episode"),
    prices: str = typer.Option(..., "--prices", help="Comma-separated historical prices"),
    price_change_pct: float | None = typer.Option(None, "--price-change-pct", help="Recent price change percent"),
    news_sentiment: float = typer.Option(0.0, "--news-sentiment", min=-1.0, max=1.0, help="News sentiment"),
    social_sentiment: float = typer.Option(0.0, "--social-sentiment", min=-1.0, max=1.0, help="Social sentiment"),
    macro_risk: float = typer.Option(0.0, "--macro-risk", min=0.0, max=1.0, help="Macro risk"),
    evidence: str = typer.Option("", "--evidence", help="Semicolon-separated evidence strings"),
    task_key: str = typer.Option("market_signal_episode", "--task-key", help="Task key for the episode"),
    steps: int = typer.Option(0, "--steps", min=0, help="Bars to advance; 0 means until episode end"),
    output_path: Path | None = typer.Option(None, "--output", help="Episode JSONL output path"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON result"),
):
    """Collect one offline episode by mapping market_signal into the RL environment."""
    from marketbot.config.loader import load_config
    from marketbot.rl.collector import append_episode_log, collect_market_signal_episode

    config = load_config()
    workspace = config.workspace_path
    clean_symbol = symbol.strip().upper()
    parsed_prices = _parse_float_csv(prices)
    if len(parsed_prices) < 2:
        raise typer.BadParameter("--prices must contain at least two values")
    evidence_items = [item.strip() for item in evidence.split(";") if item.strip()]
    event = collect_market_signal_episode(
        config=config,
        workspace=workspace,
        symbol=clean_symbol,
        prices=parsed_prices,
        price_change_pct=price_change_pct,
        news_sentiment=news_sentiment,
        social_sentiment=social_sentiment,
        macro_risk=macro_risk,
        evidence=evidence_items,
        task_key=task_key,
        steps=steps,
    )
    target = output_path or (workspace / "rl" / "episodes" / "market_signal_episodes.jsonl")
    written = append_episode_log(target, event)

    if json_output:
        console.print_json(json.dumps(event, ensure_ascii=False))
        return

    evaluation = event["environment"]["evaluation"]
    reward = evaluation["reward"]
    signal = event["signal"]
    console.print("[bold]Collected RL Episode[/bold]")
    console.print(
        f"Signal: {signal['action'].upper()} | Position: {signal['positionPct']:.4f} | "
        f"Confidence: {signal['confidence']:.4f}"
    )
    console.print(
        "Reward: "
        f"{reward['score']:.4f} | Return: {reward['realized_return']:.4f} | "
        f"MaxDD: {evaluation['maxDrawdown']:.4f} | Turnover: {evaluation['turnover']:.4f}"
    )
    console.print(f"[green]✓[/green] Appended episode to {written}")


@rl_app.command("train")
def rl_train(
    dataset_path: Path | None = typer.Option(None, "--dataset", help="Input dataset JSONL"),
    adapter_name: str = typer.Option("jsonl-supervised", "--adapter", help="Trainer adapter name"),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Training artifact output directory"),
    dry_run: bool = typer.Option(True, "--dry-run/--no-dry-run", help="Dry-run export only"),
    emit_slime_script: bool = typer.Option(False, "--emit-slime-script", help="Emit a Slime launch script template when supported"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Export a dataset into a trainer-ready artifact format."""
    from marketbot.config.loader import load_config
    from marketbot.rl.trainer.adapter import get_trainer_adapter

    config = load_config()
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / adapter_name)
    adapter = get_trainer_adapter(adapter_name)
    summary = adapter.train(source, target_dir, dry_run=dry_run)
    if emit_slime_script:
        if not hasattr(adapter, "emit_script_template"):
            raise typer.BadParameter(f"adapter does not support --emit-slime-script: {adapter_name}")
        script_path = target_dir / "run_slime_train.sh"
        written_script = adapter.emit_script_template(summary, script_path)
        summary.script_path = str(written_script)

    if json_output:
        console.print_json(json.dumps(summary.to_dict(), ensure_ascii=False))
        return

    console.print("[bold]RL Train Export[/bold]")
    console.print(f"Adapter: {summary.adapter}")
    console.print(f"Examples: {summary.example_count}")
    console.print(f"Artifacts: {summary.artifact_path}")
    console.print(f"Manifest: {summary.manifest_path}")
    if summary.script_path:
        console.print(f"Script: {summary.script_path}")
    if summary.dry_run:
        console.print("[dim]Dry-run only: no external trainer was invoked.[/dim]")


@rl_app.command("export-openclaw")
def rl_export_openclaw(
    dataset_path: Path | None = typer.Option(None, "--dataset", help="Input dataset JSONL"),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Bundle output directory"),
    openclaw_root: Path | None = typer.Option(None, "--openclaw-root", help="OpenClaw-RL checkout root"),
    dry_run: bool = typer.Option(True, "--dry-run/--no-dry-run", help="Dry-run export only"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Export a Slime/OpenClaw-compatible bundle with generate shim and launch script."""
    from marketbot.config.loader import load_config
    from marketbot.rl.trainer.openclaw_export import detect_openclaw_root, export_openclaw_bundle

    config = load_config()
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / "openclaw_export")
    marketbot_root = Path(__file__).resolve().parents[2]
    resolved_openclaw_root = openclaw_root or detect_openclaw_root(marketbot_root)
    summary = export_openclaw_bundle(
        source,
        target_dir,
        marketbot_root=marketbot_root,
        openclaw_root=resolved_openclaw_root,
        dry_run=dry_run,
    )

    if json_output:
        console.print_json(json.dumps(summary.to_dict(), ensure_ascii=False))
        return

    console.print("[bold]OpenClaw Export[/bold]")
    console.print(f"Examples: {summary.adapter_summary.example_count}")
    console.print(f"Artifacts: {summary.adapter_summary.artifact_path}")
    console.print(f"Manifest: {summary.adapter_summary.manifest_path}")
    console.print(f"Generate Shim: {summary.generate_path}")
    console.print(f"Script: {summary.script_path}")
    console.print(f"README: {summary.readme_path}")
    console.print(f"OpenClaw Root: {summary.openclaw_root}")
    console.print(f"OpenClaw Launcher: {summary.terminal_script_path}")
    console.print(f"Env Script: {summary.env_script_path}")
    console.print(f"Remote Script: {summary.remote_script_path}")
    console.print(f"Task Catalog: {summary.task_catalog_path}")
    console.print(f"Env Template: {summary.env_example_path}")
    if summary.adapter_summary.dry_run:
        console.print("[dim]Dry-run only: no external trainer was invoked.[/dim]")


@rl_app.command("serve-env")
def rl_serve_env(
    host: str = typer.Option("127.0.0.1", "--host", help="Bind host"),
    port: int = typer.Option(18080, "--port", min=0, max=65535, help="Bind port"),
    task_catalog_path: Path | None = typer.Option(None, "--task-catalog", help="Optional JSON task catalog"),
    allow_dynamic_tasks: bool = typer.Option(True, "--allow-dynamic-tasks/--no-allow-dynamic-tasks", help="Allow allocate on unknown task keys and fill task metadata on reset"),
):
    """Run an HTTP RL environment server compatible with OpenClaw terminal env clients."""
    from marketbot.rl.env.server import MarketEnvHttpServer, load_task_catalog

    task_catalog = load_task_catalog(task_catalog_path)
    server = MarketEnvHttpServer(
        host=host,
        port=port,
        task_catalog=task_catalog,
        allow_dynamic_tasks=allow_dynamic_tasks,
    )
    console.print("[bold]RL Env Server[/bold]")
    console.print(f"Listening: {server.base_url}")
    console.print(f"Dynamic Tasks: {allow_dynamic_tasks}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover
        console.print("\n[dim]Shutting down RL env server.[/dim]")
    finally:
        server.shutdown()


@rl_app.command("launch-openclaw")
def rl_launch_openclaw(
    dataset_path: Path | None = typer.Option(None, "--dataset", help="Input dataset JSONL"),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Bundle output directory"),
    openclaw_root: Path | None = typer.Option(None, "--openclaw-root", help="OpenClaw-RL checkout root"),
    remote_env: bool = typer.Option(True, "--remote-env/--local-env", help="Launch against remote HTTP env server or local in-process env"),
    env_wait_s: float = typer.Option(15.0, "--env-wait-s", min=0.0, help="Max seconds to wait for env server health"),
    dry_run: bool = typer.Option(True, "--dry-run/--no-dry-run", help="Print launch plan only"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Export a bundle and launch the matching OpenClaw wrapper."""
    import os
    import subprocess

    from marketbot.config.loader import load_config
    from marketbot.rl.trainer.openclaw_export import detect_openclaw_root, export_openclaw_bundle

    config = load_config()
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / "openclaw_export")
    marketbot_root = Path(__file__).resolve().parents[2]
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
    report_archive_paths = _resolve_openclaw_report_paths(reports_index_path)
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
            if not _wait_for_http_health(str(payload["envHealthUrl"]), env_wait_s):
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
            "envStdout": _tail_text(env_stdout_path) if remote_env else None,
            "envStderr": _tail_text(env_stderr_path) if remote_env else None,
            "trainStdout": _tail_text(train_stdout_path),
            "trainStderr": _tail_text(train_stderr_path),
        }

    if launch_error is not None:
        payload.update(_classify_openclaw_launch_error(launch_error, launch_failure_reason))
        payload["status"] = "failed"
        payload["completedAt"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        payload["error"] = str(launch_error)
        summary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        report_payload = _build_openclaw_run_report(Path(summary.bundle_dir))
        training_report_path.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        runs_index_path = _append_openclaw_runs_index(report_payload)
        report_archive = _write_openclaw_runs_archive(runs_index_path, completed_at=payload["completedAt"])
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
    report_payload = _build_openclaw_run_report(Path(summary.bundle_dir))
    training_report_path.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    runs_index_path = _append_openclaw_runs_index(report_payload)
    report_archive = _write_openclaw_runs_archive(runs_index_path, completed_at=payload["completedAt"])
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


@rl_app.command("inspect-openclaw-run")
def rl_inspect_openclaw_run(
    bundle_dir: Path = typer.Option(..., "--bundle-dir", help="OpenClaw export bundle directory"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Inspect an OpenClaw export bundle, logs, and configured checkpoint directory."""
    target = Path(bundle_dir)
    if not target.exists():
        raise typer.BadParameter(f"bundle dir not found: {target}")
    payload = _build_openclaw_run_report(target)

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


@rl_app.command("list-openclaw-runs")
def rl_list_openclaw_runs(
    index_path: Path | None = typer.Option(None, "--index-path", help="Path to runs_index.jsonl"),
    outcome: str | None = typer.Option(None, "--outcome", help="Filter by run outcome"),
    group_by: str | None = typer.Option(None, "--group-by", help="Group summary by: outcome"),
    compare_field: str = typer.Option("score", "--compare-field", help="Metric to compare: score, reward, loss, step"),
    limit: int = typer.Option(10, "--limit", min=1, help="Maximum number of runs to show"),
    summary_only: bool = typer.Option(False, "--summary-only", help="Show summary only without individual runs"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """List indexed OpenClaw training runs from runs_index.jsonl."""
    from marketbot.config.loader import load_config

    config = load_config()
    workspace = Path(config.workspace_path)
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    records = _load_jsonl_objects(target)
    payload = _build_runs_index_payload(
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
        compare_value = _extract_compare_metric(item, compare_field)
        table.add_row(
            str(item.get("completedAt") or item.get("recordedAt") or "-"),
            str(item.get("runOutcome") or "-"),
            str(item.get("failureReason") or "-"),
            str(metrics.get("step") or item.get("checkpointLatestStep") or "-"),
            str(compare_value if compare_value is not None else "-"),
            str(item.get("bundleDir") or "-"),
        )
    console.print(table)


@rl_app.command("compare-openclaw-runs")
def rl_compare_openclaw_runs(
    index_path: Path | None = typer.Option(None, "--index-path", help="Path to runs_index.jsonl"),
    outcome: str | None = typer.Option(None, "--outcome", help="Filter by run outcome"),
    group_by: str | None = typer.Option("outcome", "--group-by", help="Group summary by: outcome"),
    compare_field: str = typer.Option("score", "--compare-field", help="Metric to compare: score, reward, loss, step"),
    limit: int = typer.Option(20, "--limit", min=1, help="Maximum number of runs to include"),
    output_format: str = typer.Option("markdown", "--format", help="Output format: markdown, csv, json"),
    output_path: Path | None = typer.Option(None, "--output-path", help="Optional path to write the comparison report"),
):
    """Compare indexed OpenClaw training runs and optionally export a report."""
    from marketbot.config.loader import load_config

    config = load_config()
    workspace = Path(config.workspace_path)
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    records = _load_jsonl_objects(target)
    payload = _build_runs_index_payload(
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
        rendered = _render_openclaw_runs_csv(payload)
    elif normalized_format == "markdown":
        rendered = _render_openclaw_runs_markdown(payload)
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


@rl_app.command("latest-openclaw-report")
def rl_latest_openclaw_report(
    index_path: Path | None = typer.Option(None, "--index-path", help="Path to runs_index.jsonl"),
    report_format: str = typer.Option("markdown", "--format", help="Report format: markdown or csv"),
    print_content: bool = typer.Option(False, "--print-content", help="Print the report contents instead of only the path"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Locate the latest dated OpenClaw comparison report."""
    from marketbot.config.loader import load_config

    config = load_config()
    workspace = Path(config.workspace_path)
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    normalized_format = report_format.strip().lower()
    if normalized_format not in {"markdown", "csv"}:
        raise typer.BadParameter(f"unsupported format: {report_format}")
    latest_path = _find_latest_openclaw_report(target, normalized_format)
    if latest_path is None:
        raise typer.BadParameter(f"no {normalized_format} report found under: {target.parent / 'reports'}")
    latest_index = _load_latest_openclaw_index_payload(target)
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
        "contentPreview": _preview_text(content) if (json_output and print_content and content is not None) else None,
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


@rl_app.command("latest-openclaw-metrics")
def rl_latest_openclaw_metrics(
    index_path: Path | None = typer.Option(None, "--index-path", help="Path to runs_index.jsonl"),
    min_success_rate: float | None = typer.Option(None, "--min-success-rate", help="Fail if success rate is below this threshold"),
    min_avg: float | None = typer.Option(None, "--min-avg", help="Fail if compareSummary.avg is below this threshold"),
    min_best: float | None = typer.Option(None, "--min-best", help="Fail if compareSummary.best.value is below this threshold"),
    max_worst: float | None = typer.Option(None, "--max-worst", help="Fail if compareSummary.worst.value is above this threshold"),
    emit_github_output: bool = typer.Option(False, "--emit-github-output", help="Write key metrics to the GitHub Actions GITHUB_OUTPUT file"),
    emit_prometheus: bool = typer.Option(False, "--emit-prometheus", help="Print Prometheus exposition text instead of the default summary"),
    json_output: bool = typer.Option(False, "--json", help="Print raw JSON summary"),
):
    """Return the latest OpenClaw report summary in a machine-friendly shape."""
    from marketbot.config.loader import load_config

    config = load_config()
    workspace = Path(config.workspace_path)
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    payload = _build_latest_openclaw_metrics_payload(
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
        _write_latest_openclaw_metrics_github_output(payload, Path(github_output))
    if json_output:
        console.print_json(json.dumps(payload, ensure_ascii=False))
        if not payload["ok"]:
            raise typer.Exit(1)
        return
    if emit_prometheus:
        console.print(_render_latest_openclaw_metrics_prometheus(payload), end="")
        if not payload["ok"]:
            raise typer.Exit(1)
        return

    console.print("[bold]Latest OpenClaw Metrics[/bold]")
    console.print(f"Date: {payload['date']}")
    console.print(f"Compare Field: {payload['compareField']}")
    console.print(f"Runs: {payload['filteredCount']} / {payload['totalCount']}")
    console.print(f"Success: {payload['successCount']} | Rate: {payload['successRate']:.2%}" if payload["successRate"] is not None else f"Success: {payload['successCount']} | Rate: -")
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


@rl_app.command("serve-metrics")
def rl_serve_metrics(
    host: str = typer.Option("127.0.0.1", "--host", help="Bind host"),
    port: int = typer.Option(19100, "--port", min=0, max=65535, help="Bind port"),
    index_path: Path | None = typer.Option(None, "--index-path", help="Path to runs_index.jsonl"),
    min_success_rate: float | None = typer.Option(None, "--min-success-rate", help="Threshold for success rate"),
    min_avg: float | None = typer.Option(None, "--min-avg", help="Threshold for compareSummary.avg"),
    min_best: float | None = typer.Option(None, "--min-best", help="Threshold for compareSummary.best.value"),
    max_worst: float | None = typer.Option(None, "--max-worst", help="Threshold for compareSummary.worst.value"),
):
    """Serve latest OpenClaw metrics over HTTP for Prometheus scraping."""
    from marketbot.config.loader import load_config
    from marketbot.rl.metrics_server import MetricsHttpServer

    config = load_config()
    workspace = Path(config.workspace_path)
    target = index_path or (workspace / "rl" / "training" / "runs_index.jsonl")
    server = MetricsHttpServer(
        host=host,
        port=port,
        metrics_payload_factory=lambda: _build_latest_openclaw_metrics_payload(
            target,
            min_success_rate=min_success_rate,
            min_avg=min_avg,
            min_best=min_best,
            max_worst=max_worst,
        ),
        metrics_renderer=_render_latest_openclaw_metrics_prometheus,
        alerts_builder=lambda payload: payload.get("alertsState") or _build_openclaw_alerts_payload(payload),
        alertmanager_renderer=_render_openclaw_alertmanager_payload,
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


# ============================================================================
# Skills Commands
# ============================================================================


skills_app = typer.Typer(help="Search and install skills")
app.add_typer(skills_app, name="skills")


@skills_app.command("search")
def skills_search(
    query: str = typer.Argument(..., help="What kind of skill you want"),
    limit: int = typer.Option(5, "--limit", min=1, max=20, help="Maximum results"),
):
    """Search local skills first, then curated external skill catalogs."""
    from marketbot.config.loader import load_config

    config = load_config()
    loader = SkillsLoader(config.workspace_path)

    local_results = loader.search_local_skills(query, limit=limit)
    if local_results:
        table = Table(title="Local Skills")
        table.add_column("Skill", style="cyan")
        table.add_column("Source", style="green")
        table.add_column("Description", style="yellow")
        for item in local_results:
            table.add_row(item["name"], item.get("source", "local"), item.get("description", ""))
        console.print(table)
        return

    external_results = loader.search_external_skills(query, limit=limit)
    if not external_results:
        console.print("[yellow]No local or curated external skills matched.[/yellow]")
        raise typer.Exit(0)

    table = Table(title="External Skill Suggestions")
    table.add_column("Skill", style="cyan")
    table.add_column("Category", style="green")
    table.add_column("Description", style="yellow")
    table.add_column("Install", style="magenta")
    for item in external_results:
        table.add_row(
            item["name"],
            item.get("category", ""),
            item.get("description", ""),
            f"marketbot skills install {item['name']}",
        )
    console.print(table)
    for item in external_results:
        console.print(f"[dim]Install: marketbot skills install {item['name']}[/dim]")
    console.print("[dim]Catalogs: awesome-openclaw-skills -> openclaw/skills[/dim]")


@skills_app.command("install")
def skills_install(
    identifier: str = typer.Argument(..., help="Curated skill slug or openclaw GitHub skill URL"),
    force: bool = typer.Option(False, "--force", help="Overwrite existing workspace skill"),
):
    """Install a curated external skill into workspace/skills."""
    from marketbot.config.loader import load_config

    config = load_config()
    loader = SkillsLoader(config.workspace_path)
    try:
        installed = loader.install_external_skill(identifier, force=force)
    except FileExistsError as exc:
        console.print(f"[yellow]{exc}[/yellow]")
        console.print("[dim]Use --force to replace the existing workspace skill.[/dim]")
        raise typer.Exit(1) from exc
    except ValueError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(1) from exc
    except Exception as exc:
        console.print(f"[red]Failed to install skill: {exc}[/red]")
        raise typer.Exit(1) from exc

    console.print(f"[green]✓[/green] Installed skill to {installed}")
    console.print("[dim]Start a new agent session to load the new skill.[/dim]")


# ============================================================================
# Channel Commands
# ============================================================================


channels_app = typer.Typer(help="Manage channels")
app.add_typer(channels_app, name="channels")


@channels_app.command("status")
def channels_status():
    """Show channel status."""
    from marketbot.config.loader import load_config

    config = load_config()

    table = Table(title="Channel Status")
    table.add_column("Channel", style="cyan")
    table.add_column("Enabled", style="green")
    table.add_column("Configuration", style="yellow")

    # WhatsApp
    wa = config.channels.whatsapp
    table.add_row(
        "WhatsApp",
        "✓" if wa.enabled else "✗",
        wa.bridge_url
    )

    dc = config.channels.discord
    table.add_row(
        "Discord",
        "✓" if dc.enabled else "✗",
        dc.gateway_url
    )

    # Feishu
    fs = config.channels.feishu
    fs_config = f"app_id: {fs.app_id[:10]}..." if fs.app_id else "[dim]not configured[/dim]"
    table.add_row(
        "Feishu",
        "✓" if fs.enabled else "✗",
        fs_config
    )

    # Mochat
    mc = config.channels.mochat
    mc_base = mc.base_url or "[dim]not configured[/dim]"
    table.add_row(
        "Mochat",
        "✓" if mc.enabled else "✗",
        mc_base
    )

    # Telegram
    tg = config.channels.telegram
    tg_config = f"token: {tg.token[:10]}..." if tg.token else "[dim]not configured[/dim]"
    table.add_row(
        "Telegram",
        "✓" if tg.enabled else "✗",
        tg_config
    )

    # Slack
    slack = config.channels.slack
    slack_config = "socket" if slack.app_token and slack.bot_token else "[dim]not configured[/dim]"
    table.add_row(
        "Slack",
        "✓" if slack.enabled else "✗",
        slack_config
    )

    # DingTalk
    dt = config.channels.dingtalk
    dt_config = f"client_id: {dt.client_id[:10]}..." if dt.client_id else "[dim]not configured[/dim]"
    table.add_row(
        "DingTalk",
        "✓" if dt.enabled else "✗",
        dt_config
    )

    # QQ
    qq = config.channels.qq
    qq_config = f"app_id: {qq.app_id[:10]}..." if qq.app_id else "[dim]not configured[/dim]"
    table.add_row(
        "QQ",
        "✓" if qq.enabled else "✗",
        qq_config
    )

    # Email
    em = config.channels.email
    em_config = em.imap_host if em.imap_host else "[dim]not configured[/dim]"
    table.add_row(
        "Email",
        "✓" if em.enabled else "✗",
        em_config
    )

    console.print(table)


def _get_bridge_dir() -> Path:
    """Get the bridge directory, setting it up if needed."""
    import shutil
    import subprocess

    # User's bridge location
    user_bridge = Path.home() / ".marketbot" / "bridge"

    # Check if already built
    if (user_bridge / "dist" / "index.js").exists():
        return user_bridge

    # Check for npm
    if not shutil.which("npm"):
        console.print("[red]npm not found. Please install Node.js >= 18.[/red]")
        raise typer.Exit(1)

    # Find source bridge: first check package data, then source dir
    pkg_bridge = Path(__file__).parent.parent / "bridge"  # marketbot/bridge (installed)
    src_bridge = Path(__file__).parent.parent.parent / "bridge"  # repo root/bridge (dev)

    source = None
    if (pkg_bridge / "package.json").exists():
        source = pkg_bridge
    elif (src_bridge / "package.json").exists():
        source = src_bridge

    if not source:
        console.print("[red]Bridge source not found.[/red]")
        console.print("Try reinstalling: pip install --force-reinstall marketbot")
        raise typer.Exit(1)

    console.print(f"{__logo__} Setting up bridge...")

    # Copy to user directory
    user_bridge.parent.mkdir(parents=True, exist_ok=True)
    if user_bridge.exists():
        shutil.rmtree(user_bridge)
    shutil.copytree(source, user_bridge, ignore=shutil.ignore_patterns("node_modules", "dist"))

    # Install and build
    try:
        console.print("  Installing dependencies...")
        subprocess.run(["npm", "install"], cwd=user_bridge, check=True, capture_output=True)

        console.print("  Building...")
        subprocess.run(["npm", "run", "build"], cwd=user_bridge, check=True, capture_output=True)

        console.print("[green]✓[/green] Bridge ready\n")
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Build failed: {e}[/red]")
        if e.stderr:
            console.print(f"[dim]{e.stderr.decode()[:500]}[/dim]")
        raise typer.Exit(1)

    return user_bridge


@channels_app.command("login")
def channels_login():
    """Link device via QR code."""
    import subprocess

    from marketbot.config.loader import load_config

    config = load_config()
    bridge_dir = _get_bridge_dir()

    console.print(f"{__logo__} Starting bridge...")
    console.print("Scan the QR code to connect.\n")

    env = {**os.environ}
    if config.channels.whatsapp.bridge_token:
        env["BRIDGE_TOKEN"] = config.channels.whatsapp.bridge_token

    try:
        subprocess.run(["npm", "start"], cwd=bridge_dir, check=True, env=env)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Bridge failed: {e}[/red]")
    except FileNotFoundError:
        console.print("[red]npm not found. Please install Node.js.[/red]")


# ============================================================================
# Status Commands
# ============================================================================


@app.command()
def status(
    json_output: bool = typer.Option(False, "--json", help="Output machine-readable JSON status."),
):
    """Show marketbot status."""
    from marketbot.config.loader import get_config_path, load_config

    config_path = get_config_path()
    config = load_config()
    workspace = config.workspace_path
    payload = _build_status_payload(config, config_path)

    if json_output:
        console.print_json(data=payload)
        return

    console.print(f"{__logo__} marketbot Status\n")

    console.print(f"Config: {config_path} {'[green]✓[/green]' if config_path.exists() else '[red]✗[/red]'}")
    console.print(f"Workspace: {workspace} {'[green]✓[/green]' if workspace.exists() else '[red]✗[/red]'}")

    browser_cfg = config.tools.browser
    browser_enabled = bool(browser_cfg.enabled)
    browser_command = str(browser_cfg.command or "bb-browser").strip() or "bb-browser"
    browser_binary = shutil.which(browser_command) if browser_enabled else None
    browser_status = "[green]✓[/green]" if browser_enabled else "[dim]disabled[/dim]"
    if browser_enabled and not browser_binary:
        browser_status = "[yellow]! command not found[/yellow]"
    console.print(f"Browser: {browser_status}")
    if browser_enabled:
        console.print(f"Browser mode: {browser_cfg.mode}")
        console.print(f"Browser command: {browser_command}")
        console.print("Browser eval: " + ("[red]enabled[/red]" if browser_cfg.allow_eval else "[dim]disabled[/dim]"))
        console.print(
            "Browser request capture: "
            + ("[yellow]enabled[/yellow]" if browser_cfg.allow_request_capture else "[dim]disabled[/dim]")
        )
        console.print(
            "Browser request bodies: "
            + ("[red]enabled[/red]" if browser_cfg.allow_request_bodies else "[dim]disabled[/dim]")
        )
        if browser_cfg.allow_sites:
            console.print(f"Browser allowSites: {', '.join(browser_cfg.allow_sites)}")
        if browser_cfg.allow_adapters:
            console.print(f"Browser allowAdapters: {', '.join(browser_cfg.allow_adapters)}")
        if browser_cfg.allow_domains:
            console.print(f"Browser allowDomains: {', '.join(browser_cfg.allow_domains)}")
        if browser_cfg.allow_url_prefixes:
            console.print(f"Browser allowUrlPrefixes: {', '.join(browser_cfg.allow_url_prefixes)}")

    if config_path.exists():
        from marketbot.providers.registry import PROVIDERS

        console.print(f"Model: {config.agents.defaults.model}")

        # Check API keys from registry
        for spec in PROVIDERS:
            p = getattr(config.providers, spec.name, None)
            if p is None:
                continue
            if spec.is_oauth:
                console.print(f"{spec.label}: [green]✓ (OAuth)[/green]")
            elif spec.is_local:
                # Local deployments show api_base instead of api_key
                if p.api_base:
                    console.print(f"{spec.label}: [green]✓ {p.api_base}[/green]")
                else:
                    console.print(f"{spec.label}: [dim]not set[/dim]")
            else:
                has_key = bool(p.api_key)
                console.print(f"{spec.label}: {'[green]✓[/green]' if has_key else '[dim]not set[/dim]'}")


def _build_status_payload(config: Config, config_path: Path) -> dict[str, Any]:
    """Build machine-readable status payload for CLI and automation."""
    workspace = config.workspace_path
    browser_cfg = config.tools.browser
    browser_enabled = bool(browser_cfg.enabled)
    browser_command = str(browser_cfg.command or "bb-browser").strip() or "bb-browser"
    browser_binary = shutil.which(browser_command) if browser_enabled else None

    payload: dict[str, Any] = {
        "config": {
            "path": str(config_path),
            "exists": config_path.exists(),
        },
        "workspace": {
            "path": str(workspace),
            "exists": workspace.exists(),
        },
        "agent": {
            "model": config.agents.defaults.model,
        },
        "browser": {
            "enabled": browser_enabled,
            "mode": browser_cfg.mode,
            "command": browser_command,
            "commandFound": bool(browser_binary),
            "allowEval": bool(browser_cfg.allow_eval),
            "allowRequestCapture": bool(browser_cfg.allow_request_capture),
            "allowRequestBodies": bool(browser_cfg.allow_request_bodies),
            "allowSites": list(browser_cfg.allow_sites),
            "allowAdapters": list(browser_cfg.allow_adapters),
            "allowDomains": list(browser_cfg.allow_domains),
            "allowUrlPrefixes": list(browser_cfg.allow_url_prefixes),
        },
        "providers": [],
    }

    from marketbot.providers.registry import PROVIDERS

    providers: list[dict[str, Any]] = []
    for spec in PROVIDERS:
        p = getattr(config.providers, spec.name, None)
        if p is None:
            continue
        entry: dict[str, Any] = {
            "name": spec.name,
            "label": spec.label,
            "type": "oauth" if spec.is_oauth else "local" if spec.is_local else "api",
            "configured": False,
        }
        if spec.is_oauth:
            entry["configured"] = True
        elif spec.is_local:
            entry["configured"] = bool(p.api_base)
            if p.api_base:
                entry["apiBase"] = p.api_base
        else:
            entry["configured"] = bool(p.api_key)
        providers.append(entry)
    payload["providers"] = providers

    return payload


def _format_browser_runtime_summary(config: Config) -> str:
    """Render a compact browser safety summary for startup logs."""
    browser = _build_status_payload(config, Path("."))["browser"]
    if not browser["enabled"]:
        return "Browser: disabled"

    bits = [
        f"mode={browser['mode']}",
        f"command={browser['command']}",
        f"command_found={'yes' if browser['commandFound'] else 'no'}",
        f"eval={'on' if browser['allowEval'] else 'off'}",
        f"request_capture={'on' if browser['allowRequestCapture'] else 'off'}",
        f"request_bodies={'on' if browser['allowRequestBodies'] else 'off'}",
    ]
    if browser["allowSites"]:
        bits.append(f"sites={len(browser['allowSites'])}")
    if browser["allowAdapters"]:
        bits.append(f"adapters={len(browser['allowAdapters'])}")
    if browser["allowDomains"]:
        bits.append(f"domains={len(browser['allowDomains'])}")
    if browser["allowUrlPrefixes"]:
        bits.append(f"url_prefixes={len(browser['allowUrlPrefixes'])}")
    return "Browser: " + " | ".join(bits)


# ============================================================================
# OAuth Login
# ============================================================================

provider_app = typer.Typer(help="Manage providers")
app.add_typer(provider_app, name="provider")


_LOGIN_HANDLERS: dict[str, callable] = {}


def _register_login(name: str):
    def decorator(fn):
        _LOGIN_HANDLERS[name] = fn
        return fn
    return decorator


@provider_app.command("login")
def provider_login(
    provider: str = typer.Argument(..., help="OAuth provider (e.g. 'openai-codex', 'github-copilot')"),
):
    """Authenticate with an OAuth provider."""
    from marketbot.providers.registry import PROVIDERS

    key = provider.replace("-", "_")
    spec = next((s for s in PROVIDERS if s.name == key and s.is_oauth), None)
    if not spec:
        names = ", ".join(s.name.replace("_", "-") for s in PROVIDERS if s.is_oauth)
        console.print(f"[red]Unknown OAuth provider: {provider}[/red]  Supported: {names}")
        raise typer.Exit(1)

    handler = _LOGIN_HANDLERS.get(spec.name)
    if not handler:
        console.print(f"[red]Login not implemented for {spec.label}[/red]")
        raise typer.Exit(1)

    console.print(f"{__logo__} OAuth Login - {spec.label}\n")
    handler()


@_register_login("openai_codex")
def _login_openai_codex() -> None:
    try:
        from oauth_cli_kit import get_token, login_oauth_interactive
        token = None
        try:
            token = get_token()
        except Exception:
            pass
        if not (token and token.access):
            console.print("[cyan]Starting interactive OAuth login...[/cyan]\n")
            token = login_oauth_interactive(
                print_fn=lambda s: console.print(s),
                prompt_fn=lambda s: typer.prompt(s),
            )
        if not (token and token.access):
            console.print("[red]✗ Authentication failed[/red]")
            raise typer.Exit(1)
        console.print(f"[green]✓ Authenticated with OpenAI Codex[/green]  [dim]{token.account_id}[/dim]")
    except ImportError:
        console.print("[red]oauth_cli_kit not installed. Run: pip install oauth-cli-kit[/red]")
        raise typer.Exit(1)


@_register_login("github_copilot")
def _login_github_copilot() -> None:
    import asyncio

    console.print("[cyan]Starting GitHub Copilot device flow...[/cyan]\n")

    async def _trigger():
        from litellm import acompletion
        await acompletion(model="github_copilot/gpt-4o", messages=[{"role": "user", "content": "hi"}], max_tokens=1)

    try:
        asyncio.run(_trigger())
        console.print("[green]✓ Authenticated with GitHub Copilot[/green]")
    except Exception as e:
        console.print(f"[red]Authentication error: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()

"""Financial research workflows available without an LLM provider."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import typer

finance_app = typer.Typer(help="Evidence, investment thesis checks, portfolio risk, and change alerts")


def finance_config(config_path: Path | None, workspace: Path | None = None):
    from marketbot.config.loader import load_config

    if config_path is not None and not config_path.expanduser().is_file():
        raise typer.BadParameter("config file does not exist")
    config = load_config(config_path.expanduser() if config_path else None, strict=True)
    if workspace is not None:
        config.agents.defaults.workspace = str(workspace.expanduser().resolve())
    return config


@finance_app.command("call")
def call_finance_tool(
    tool: str = typer.Argument(..., help="Financial tool name, e.g. thesis_tracker or market_watch"),
    input_file: Path = typer.Option(..., "--input", "-i", exists=True, dir_okay=False, help="JSON tool arguments"),
    config_path: Path | None = typer.Option(None, "--config", "-c"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w"),
):
    """Run a financial tool using its native schema and persist research evidence."""
    from marketbot.agent.tools.finance_evidence import FinanceEvidenceTool
    from marketbot.agent.tools.registry import ToolRegistry
    from marketbot.domain.market.plugin import create_market_tools

    config = finance_config(config_path, workspace)
    try:
        if input_file.stat().st_size > 1_000_000:
            raise ValueError("input exceeds 1 MB")
        arguments = json.loads(input_file.read_text(encoding="utf-8"))
        if not isinstance(arguments, dict):
            raise ValueError("input must be a JSON object")
    except (ValueError, OSError) as exc:
        raise typer.BadParameter(str(exc)) from None
    registry = ToolRegistry()
    for item in create_market_tools(config.tools.market, config.workspace_path):
        if (item.name.startswith("market_") and item.name not in {"market_source_plan", "market_watch"}) or item.name == "portfolio_risk":
            item = FinanceEvidenceTool(item, config.workspace_path)
        registry.register(item)
    if not registry.has(tool):
        raise typer.BadParameter("unknown or disabled financial tool")
    result = asyncio.run(registry.execute(tool, arguments))
    typer.echo(result)
    parsed = json.loads(result)
    if parsed.get("error") or parsed.get("ok") is False:
        raise typer.Exit(1)


async def poll_watch(config: Any, watch_id: str) -> dict[str, Any]:
    """Collect source observations and evaluate a saved watch deterministically."""
    from marketbot.agent.tools.finance_evidence import capture_finance_result
    from marketbot.agent.tools.market import MarketSnapshotTool
    from marketbot.agent.tools.watch import MarketWatchTool

    if not config.tools.market.enabled:
        return {"ok": False, "error": {"type": "finance_disabled", "message": "Financial tools are disabled in this configuration"}}
    watch_tool = MarketWatchTool(config.workspace_path)
    saved = json.loads(await watch_tool.execute(action="get", watchId=watch_id))
    if saved.get("error") or saved.get("ok") is False:
        return saved
    # Watch records use a durable spec; the public API shape is normalized here.
    watch = saved.get("watch", saved)
    if not watch.get("active", True):
        return {"ok": False, "error": {"type": "watch_inactive", "message": "This watch is disabled"}}
    spec = watch.get("spec", watch)
    symbols = spec.get("symbols") or [row["symbol"] for row in spec.get("holdings", [])]
    tool = MarketSnapshotTool(config.tools.market, workspace=config.workspace_path)
    observations, warnings = [], []
    size = max(1, int(config.tools.market.snapshot_max_symbols))
    for start in range(0, len(symbols), size):
        result = capture_finance_result(config.workspace_path, "market_snapshot", await tool.execute(symbols=symbols[start:start + size]))
        payload = json.loads(result)
        warnings.extend(payload.get("warnings", []))
        for row in payload.get("quotes", []):
            observations.append({
                "symbol": row["symbol"], "price": row.get("price"),
                "currency": row.get("currency"), "source": row.get("provider") or payload.get("source"),
                "observedAt": row.get("observedAt"), "evidenceIds": [row["evidenceId"]] if row.get("evidenceId") else [],
            })
    result = json.loads(await watch_tool.execute(action="evaluate", watchId=watch_id, observations=observations))
    result["collectionWarnings"] = warnings
    return result


@finance_app.command("poll")
def poll(
    watch_id: str = typer.Argument(...),
    config_path: Path | None = typer.Option(None, "--config", "-c"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w"),
):
    """Refresh a saved watch from public quotes; unknown times/FX remain data gaps."""
    config = finance_config(config_path, workspace)
    result = asyncio.run(poll_watch(config, watch_id))
    typer.echo(json.dumps(result, ensure_ascii=False))
    if result.get("error") or result.get("ok") is False:
        raise typer.Exit(1)


@finance_app.command("schedule")
def schedule(
    watch_id: str = typer.Argument(...),
    every_minutes: int = typer.Option(15, "--every-minutes", min=1),
    deliver: bool = typer.Option(False, "--deliver", help="Deliver changes through a configured channel"),
    channel: str | None = typer.Option(None, "--channel"),
    to: str | None = typer.Option(None, "--to"),
    config_path: Path | None = typer.Option(None, "--config", "-c"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w"),
):
    """Schedule ongoing checks; start marketbot gateway to run them."""
    from marketbot.cron.service import CronService
    from marketbot.cron.types import CronPayload, CronSchedule
    from marketbot.domain.market.watch import WatchStore

    config = finance_config(config_path, workspace)
    result = WatchStore(config.workspace_path).get(watch_id)
    watch = result.get("watch") if result.get("ok") else None
    if watch is None or not watch.get("active", True):
        raise typer.BadParameter("active watch not found")
    if deliver and (not channel or not to):
        raise typer.BadParameter("--deliver requires --channel and --to")
    if deliver:
        settings = getattr(config.channels, str(channel), None)
        if settings is None or not getattr(settings, "enabled", False):
            raise typer.BadParameter("delivery channel must be enabled in the configuration")
    cron = CronService(config.workspace_path / "cron" / "jobs.json")
    for job in cron.list_jobs(include_disabled=True):
        if job.payload.kind == "finance_watch" and job.payload.scope_key == watch_id and job.enabled:
            raise typer.BadParameter(f"watch already scheduled as {job.id}; use cron commands to change it")
    job = cron.add_job(
        f"Finance watch {watch_id}", CronSchedule(kind="every", every_ms=every_minutes * 60_000), "",
        payload=CronPayload(kind="finance_watch", scope_key=watch_id, deliver=deliver, channel=channel, to=to),
    )
    typer.echo(json.dumps({"jobId": job.id, "watchId": watch_id, "everyMinutes": every_minutes, "deliver": deliver, "runner": "marketbot gateway --finance-only"}))


@finance_app.command("schedule-list")
def list_schedules(
    config_path: Path | None = typer.Option(None, "--config", "-c"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w"),
):
    """List enabled and disabled financial watch jobs in the configured workspace."""
    from marketbot.cron.service import CronService

    config = finance_config(config_path, workspace)
    try:
        jobs = CronService(config.workspace_path / "cron" / "jobs.json").list_jobs(include_disabled=True)
    except (ValueError, OSError) as exc:
        raise typer.BadParameter(str(exc)) from None
    rows = [{"jobId": job.id, "watchId": job.payload.scope_key, "name": job.name, "enabled": job.enabled,
             "schedule": {"kind": job.schedule.kind, "everyMs": job.schedule.every_ms, "atMs": job.schedule.at_ms,
                          "expr": job.schedule.expr, "timezone": job.schedule.tz},
             "deliver": job.payload.deliver, "channel": job.payload.channel, "to": job.payload.to,
             "state": {"nextRunAtMs": job.state.next_run_at_ms, "lastRunAtMs": job.state.last_run_at_ms,
                       "lastStatus": job.state.last_status, "lastError": job.state.last_error}}
            for job in jobs if job.payload.kind == "finance_watch"]
    typer.echo(json.dumps({"jobs": rows, "count": len(rows)}, ensure_ascii=False))


@finance_app.command("unschedule")
def unschedule(
    job_id: str = typer.Argument(..., help="Financial jobId returned by schedule or schedule-list"),
    config_path: Path | None = typer.Option(None, "--config", "-c"),
    workspace: Path | None = typer.Option(None, "--workspace", "-w"),
):
    """Remove a finance watch's schedule while preserving its definition and alert history."""
    from marketbot.cron.service import CronService

    config = finance_config(config_path, workspace)
    cron = CronService(config.workspace_path / "cron" / "jobs.json")
    try:
        job = next((item for item in cron.list_jobs(include_disabled=True) if item.id == job_id), None)
        if job is None or job.payload.kind != "finance_watch":
            raise ValueError("Financial scheduled job not found; use finance schedule-list for its jobId")
        if not cron.remove_job(job_id):
            raise ValueError("Financial scheduled job could not be removed")
    except (ValueError, OSError) as exc:
        raise typer.BadParameter(str(exc)) from None
    typer.echo(json.dumps({"removed": True, "jobId": job_id, "watchId": job.payload.scope_key}))

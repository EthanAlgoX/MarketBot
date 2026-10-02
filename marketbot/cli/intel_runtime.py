"""Shared intel collection and scheduling helpers for CLI commands."""

from __future__ import annotations

import json
from pathlib import Path

import typer


def open_intel_db(config_path: Path | None = None, *, workspace: Path | None = None):
    """Open and initialize the intel database for the configured workspace."""
    from marketbot.config.loader import load_config
    from marketbot.domain.intel.storage import connect_intel_db, init_intel_schema

    config = load_config(config_path)
    if workspace is not None:
        config.agents.defaults.workspace = str(workspace.expanduser().resolve())
    conn = connect_intel_db(config.workspace_path)
    init_intel_schema(conn)
    return config, conn


async def collect_intel_sources(conn, *, scope: str, scope_key: str):
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


def render_intel_collect_summary(results, *, language: str = "en") -> str:
    """Render a compact summary for intel collection runs."""
    total_sources = len(results)
    ok_count = sum(1 for item in results if item.ok)
    inserted = sum(int(getattr(item, "items_inserted", 0) or 0) for item in results)
    from marketbot.i18n import msg

    lines = [
        msg(
            f"Intel collect completed: {ok_count}/{total_sources} sources ok.",
            f"情报采集完成：{ok_count}/{total_sources} 个来源成功。",
            language,
        ),
        msg(f"Inserted items: {inserted}", f"新增条目：{inserted}", language),
    ]
    errors = [item for item in results if not item.ok and item.error]
    if errors:
        lines.append(msg("Errors:", "错误：", language))
        lines.extend(f"- source #{item.source_id}: {item.error}" for item in errors[:5])
    return "\n".join(lines)


def build_intel_daily_digest(
    conn, *, scope: str, scope_key: str, hours: int, limit: int, language: str = "en"
):
    """Build and load the latest daily digest for a scope."""
    from marketbot.domain.intel.digest import build_daily_digest
    from marketbot.domain.intel.storage import get_digest

    digest_id = build_daily_digest(
        conn, scope=scope, scope_key=scope_key, hours=hours, limit=limit, language=language
    )
    digest = get_digest(conn, digest_id)
    if digest is None:
        raise ValueError("The newly created intel digest could not be loaded")
    return digest_id, digest


def build_cron_schedule(
    *,
    every_minutes: int | None,
    cron_expr: str | None,
    tz: str | None,
):
    """Build a cron schedule from simple CLI options."""
    from marketbot.cron.types import CronSchedule

    if every_minutes is not None and cron_expr:
        raise typer.BadParameter("use either --every-minutes or --cron-expr, not both")
    if every_minutes is not None:
        if every_minutes <= 0:
            raise typer.BadParameter("--every-minutes must be > 0")
        return CronSchedule(kind="every", every_ms=every_minutes * 60 * 1000)
    if cron_expr:
        from zoneinfo import ZoneInfo

        from croniter import croniter

        if not croniter.is_valid(cron_expr):
            raise typer.BadParameter("--cron-expr must be a valid cron expression")
        if tz:
            try:
                ZoneInfo(tz)
            except (KeyError, ValueError):
                raise typer.BadParameter("--tz must be a valid IANA timezone") from None
        return CronSchedule(kind="cron", expr=cron_expr, tz=tz)
    raise typer.BadParameter("one of --every-minutes or --cron-expr is required")


def schedule_intel_job(
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


def load_intel_cron_service(config_path: Path | None = None):
    """Load the workspace cron service used by intel scheduled jobs."""
    from marketbot.config.loader import load_config
    from marketbot.cron.service import CronService

    config = load_config(config_path)
    cron_store_path = config.workspace_path / "cron" / "jobs.json"
    return CronService(cron_store_path)


def build_source_config_json(url: str) -> str:
    """Build serialized source config JSON for source-add commands."""
    return json.dumps({"url": url}, ensure_ascii=False)

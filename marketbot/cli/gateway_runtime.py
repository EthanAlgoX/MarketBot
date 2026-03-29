"""Shared gateway execution helpers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Awaitable, Callable

from marketbot.runtime.diagnostics import collect_runtime_diagnostics, format_bus_runtime_summary


def build_runtime_delivery_metadata(*, bus: Any = None, session_manager: Any = None) -> dict[str, Any]:
    """Build outbound metadata carrying shared runtime diagnostics when available."""
    return collect_runtime_diagnostics(bus=bus, session_manager=session_manager)


def pick_heartbeat_target(*, channels: Any, session_manager: Any) -> tuple[str, str]:
    """Pick a routable channel/chat target for heartbeat-triggered messages."""
    enabled = set(channels.enabled_channels)
    for item in session_manager.list_sessions():
        key = item.get("key") or ""
        if ":" not in key:
            continue
        channel, chat_id = key.split(":", 1)
        if channel in {"cli", "system"}:
            continue
        if channel in enabled and chat_id:
            return channel, chat_id
    return "cli", "direct"


def create_cron_job_handler(
    *,
    config_path: Path | None,
    bus: Any,
    agent: Any,
    open_intel_db: Callable[[Path | None], tuple[Any, Any]],
    collect_intel_sources: Callable[..., Awaitable[Any]],
    render_intel_collect_summary: Callable[[Any], str],
    build_intel_daily_digest: Callable[..., Any],
):
    """Build the cron job callback used by the gateway."""

    async def on_cron_job(job: Any) -> str | None:
        from marketbot.agent.tools.cron import CronTool
        from marketbot.agent.tools.message import MessageTool
        from marketbot.bus.events import OutboundMessage

        if job.payload.kind == "intel_collect":
            _, intel_conn = open_intel_db(config_path)
            try:
                results = await collect_intel_sources(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                )
                return render_intel_collect_summary(results)
            finally:
                intel_conn.close()

        if job.payload.kind == "intel_digest_daily":
            _, intel_conn = open_intel_db(config_path)
            try:
                _, digest = build_intel_daily_digest(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                    hours=job.payload.hours,
                    limit=job.payload.limit,
                )
                if job.payload.deliver and job.payload.to:
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
            await bus.publish_outbound(
                OutboundMessage(
                    channel=job.payload.channel or "cli",
                    chat_id=job.payload.to,
                    content=response,
                )
            )
        return response

    return on_cron_job


def create_heartbeat_execute_handler(
    *,
    config: Any,
    agent: Any,
    heartbeat_delivery: dict[str, object],
    pick_target: Callable[[], tuple[str, str]],
    extract_market_heartbeat_spec: Callable[[str], dict[str, Any] | None],
    render_market_report_document: Callable[..., str],
    default_market_report_path: Callable[[Path, str, str], Path],
):
    """Build the heartbeat execution callback used by the gateway."""

    async def on_heartbeat_execute(tasks: str) -> str:
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

        channel, chat_id = pick_target()

        async def _silent(*_args, **_kwargs):
            pass

        return await agent.process_direct(
            tasks,
            session_key="heartbeat",
            channel=channel,
            chat_id=chat_id,
            on_progress=_silent,
        )

    return on_heartbeat_execute


def create_heartbeat_notify_handler(
    *,
    bus: Any,
    heartbeat_delivery: dict[str, object],
    session_manager: Any | None,
    pick_target: Callable[[], tuple[str, str]],
    render_market_report_notification: Callable[..., str],
):
    """Build the heartbeat delivery callback used by the gateway."""

    async def on_heartbeat_notify(response: str) -> None:
        from marketbot.bus.events import OutboundMessage

        channel, chat_id = pick_target()
        if channel == "cli":
            return
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
                    metadata={
                        "market_report": {"session": session, "path": str(report_path)},
                        **build_runtime_delivery_metadata(bus=bus, session_manager=session_manager),
                    },
                )
            )
            return

        await bus.publish_outbound(
            OutboundMessage(
                channel=channel,
                chat_id=chat_id,
                content=response,
                metadata=build_runtime_delivery_metadata(bus=bus, session_manager=session_manager),
            )
        )

    return on_heartbeat_notify


async def run_gateway_services(
    *,
    agent: Any,
    bus: Any,
    channels: Any,
    cron: Any,
    heartbeat: Any,
    console: Any,
) -> None:
    """Run the gateway service bundle and stop it cleanly."""
    try:
        console.print(f"[dim]{format_bus_runtime_summary(bus)}[/dim]")
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

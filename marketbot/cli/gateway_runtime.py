"""Shared gateway execution helpers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Awaitable, Callable

import typer
from loguru import logger

from marketbot.cron.service import CronService
from marketbot.runtime.diagnostics import collect_runtime_diagnostics, format_bus_runtime_summary

NATIVE_JOB_KINDS = frozenset({"finance_watch", "intel_collect", "intel_digest_daily"})


class NativeJobsRequiredError(ValueError):
    """A model-dependent task cannot run in the native scheduler."""


class NativeCronService(CronService):
    """Stop before consuming unsupported jobs, including externally added ones."""

    def __init__(self, store_path: Path):
        super().__init__(store_path)
        self.blocked = asyncio.Event()
        self.blocked_error: NativeJobsRequiredError | None = None

    def validate_jobs(self) -> None:
        unsupported = [
            job.id for job in self.list_jobs() if job.payload.kind not in NATIVE_JOB_KINDS
        ]
        if unsupported:
            raise NativeJobsRequiredError(
                "--finance-only cannot run model-dependent cron jobs: "
                + ", ".join(unsupported)
                + ". Use a model-enabled gateway or remove these jobs; they were preserved."
            )

    async def _execute_job(self, job: Any) -> None:
        if job.payload.kind not in NATIVE_JOB_KINDS:
            self.blocked_error = NativeJobsRequiredError(
                f"--finance-only rejected newly added model-dependent cron job {job.id}; the job was preserved."
            )
            logger.error(str(self.blocked_error))
            self.stop()
            self.blocked.set()
            return
        await super()._execute_job(job)


async def run_native_gateway_services(*, bus: Any, channels: Any, cron: NativeCronService) -> None:
    """Run native jobs and configured delivery, with an explicit chat rejection."""
    from marketbot.bus.events import OutboundMessage

    async def reject_chat() -> None:
        while True:
            message = await bus.consume_inbound()
            await bus.publish_outbound(
                OutboundMessage(
                    channel=message.channel,
                    chat_id=message.chat_id,
                    content="This gateway runs finance/intel scheduled jobs only. Chat requires a model-enabled gateway.",
                )
            )

    async def wait_for_unsupported_job() -> None:
        await cron.blocked.wait()
        raise cron.blocked_error or NativeJobsRequiredError("Native scheduler stopped")

    tasks = []
    try:
        await cron.start()
        tasks = [
            asyncio.create_task(reject_chat()),
            asyncio.create_task(channels.start_all()),
            asyncio.create_task(wait_for_unsupported_job()),
        ]
        await asyncio.gather(*tasks)
    finally:
        cron.stop()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await channels.stop_all()


def run_finance_only_gateway(
    *,
    config: Any,
    config_path: Path | None,
    console: Any,
    open_intel_db: Callable[..., tuple[Any, Any]],
    collect_intel_sources: Callable[..., Awaitable[Any]],
    render_intel_collect_summary: Callable[[Any], str],
    build_intel_daily_digest: Callable[..., Any],
) -> None:
    """Start the explicit provider-free finance/intel scheduler."""
    from marketbot.bus.queue import MessageBus
    from marketbot.channels.manager import ChannelManager

    bus = MessageBus()
    cron = NativeCronService(config.workspace_path / "cron" / "jobs.json")
    try:
        cron.validate_jobs()
    except NativeJobsRequiredError as exc:
        raise typer.BadParameter(str(exc)) from None
    cron.on_job = create_cron_job_handler(
        config_path=config_path,
        workspace=config.workspace_path,
        native_only=True,
        bus=bus,
        agent=None,
        open_intel_db=open_intel_db,
        collect_intel_sources=collect_intel_sources,
        render_intel_collect_summary=render_intel_collect_summary,
        build_intel_daily_digest=build_intel_daily_digest,
        language=config.agents.defaults.language,
    )
    channels = ChannelManager(config, bus)
    console.print("Finance-only gateway: native finance/intel scheduled jobs.")
    console.print("LLM chat and heartbeat disabled.")
    console.print(f"Native cron jobs: {cron.status()['jobs']}")
    console.print(
        "Delivery channels: "
        + (", ".join(channels.enabled_channels) or "none (local results only)")
    )
    try:
        asyncio.run(run_native_gateway_services(bus=bus, channels=channels, cron=cron))
    except KeyboardInterrupt:
        console.print("\nShutting down finance-only gateway...")
    except NativeJobsRequiredError as exc:
        console.print(str(exc), markup=False, soft_wrap=True)
        raise typer.Exit(1) from None


def build_runtime_delivery_metadata(
    *, bus: Any = None, session_manager: Any = None
) -> dict[str, Any]:
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
    workspace: Path | None = None,
    native_only: bool = False,
    language: str = "en",
):
    """Build the cron job callback used by the gateway."""
    enqueued_alert_ids: set[str] = set()

    async def on_cron_job(job: Any) -> str | None:
        from marketbot.agent.tools.cron import CronTool
        from marketbot.agent.tools.message import MessageTool
        from marketbot.bus.events import OutboundMessage

        if native_only and job.payload.kind not in NATIVE_JOB_KINDS:
            raise NativeJobsRequiredError("This cron job requires a model-enabled gateway")
        runtime_workspace = workspace or getattr(agent, "workspace", None)
        if job.payload.kind == "finance_watch":
            from marketbot.agent.tools.watch import MarketWatchTool
            from marketbot.cli.finance_runtime import finance_config, poll_watch

            config = finance_config(config_path, runtime_workspace)
            result = await poll_watch(config, job.payload.scope_key)
            if (result.get("error") or result.get("ok") is False) and result.get(
                "status"
            ) != "data_gap":
                raise RuntimeError("Scheduled finance watch failed; inspect its local state")
            watch_tool = MarketWatchTool(config.workspace_path)
            if job.payload.deliver and job.payload.to:
                settings = getattr(config.channels, str(job.payload.channel), None)
                if settings is None or not getattr(settings, "enabled", False):
                    raise RuntimeError(
                        "Finance watch delivery channel is disabled; pending alerts were preserved"
                    )
                outbox = json.loads(
                    await watch_tool.execute(action="outbox", watchId=job.payload.scope_key)
                )
                if outbox.get("ok") is False:
                    raise RuntimeError(
                        "Finance watch outbox is unavailable; pending alerts were preserved"
                    )
                alerts = [
                    item
                    for item in outbox.get("alerts", [])
                    if item["alertId"] not in enqueued_alert_ids
                ]
            else:
                alerts = result.get("alerts", [])
            if not alerts:
                return None
            response = json.dumps(
                {"watchId": job.payload.scope_key, "alerts": alerts}, ensure_ascii=False
            )
            if job.payload.deliver and job.payload.to:
                await bus.publish_outbound(
                    OutboundMessage(
                        channel=job.payload.channel or "cli",
                        chat_id=job.payload.to,
                        content=response,
                        metadata={"kind": "finance-watch", "watchId": job.payload.scope_key},
                    )
                )
                # Enqueueing is not proof of remote delivery. Keep the durable
                # outbox pending until explicitly acknowledged; on restart it
                # retries with the same IDs. Deduplicate polling in this process.
                enqueued_alert_ids.update(item["alertId"] for item in alerts)
            return response

        if job.payload.kind == "intel_collect":
            _, intel_conn = (
                open_intel_db(config_path, workspace=runtime_workspace)
                if runtime_workspace
                else open_intel_db(config_path)
            )
            try:
                results = await collect_intel_sources(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                )
                if results and not any(item.ok for item in results):
                    raise RuntimeError(
                        "All intel sources failed; inspect intel source-list for details"
                    )
                return render_intel_collect_summary(results, language=language)
            finally:
                intel_conn.close()

        if job.payload.kind == "intel_digest_daily":
            _, intel_conn = (
                open_intel_db(config_path, workspace=runtime_workspace)
                if runtime_workspace
                else open_intel_db(config_path)
            )
            try:
                _, digest = build_intel_daily_digest(
                    intel_conn,
                    scope=job.payload.scope,
                    scope_key=job.payload.scope_key,
                    hours=job.payload.hours,
                    limit=job.payload.limit,
                    language=language,
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
                tool = MarketBriefTool(
                    config.tools.market,
                    workspace=config.workspace_path,
                    language=config.agents.defaults.language,
                )
                payload = json.loads(
                    await tool.execute(
                        symbols=list(heartbeat_spec["symbols"]),
                        includeNews=True,
                        includeMacro=True,
                        includeSocial=True,
                    )
                )
                from marketbot.agent.tools.finance_evidence import capture_finance_result

                payload = json.loads(
                    capture_finance_result(
                        config.workspace_path,
                        "market_brief",
                        json.dumps(payload, ensure_ascii=False),
                    )
                )
                report_markdown = render_market_report_document(
                    payload,
                    symbols=list(heartbeat_spec["symbols"]),
                    headline="",
                    session=str(heartbeat_spec["session"]),
                    timezone_name=str(heartbeat_spec["timezone"]),
                    language=config.agents.defaults.language,
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
    language: str = "en",
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
                language=language,
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

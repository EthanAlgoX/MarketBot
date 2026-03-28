"""Shared market CLI execution helpers."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

import typer
from rich.markdown import Markdown


def normalize_market_report_session(session: str) -> str:
    """Validate and normalize the market report session name."""
    normalized = session.strip().lower() or "auto"
    if normalized not in {"auto", "premarket", "intraday", "close"}:
        typer.echo("session must be one of: auto, premarket, intraday, close")
        raise typer.BadParameter("session must be one of: auto, premarket, intraday, close")
    return normalized


async def fetch_market_report_payload(
    *,
    tool: Any,
    selected_symbols: list[str],
    headline: str,
    body: str,
) -> dict[str, Any]:
    """Fetch the raw market brief payload from the market tool."""
    raw = await tool.execute(
        symbols=selected_symbols,
        headline=headline,
        body=body,
        includeNews=True,
        includeMacro=True,
        includeSocial=True,
    )
    return json.loads(raw)


def resolve_market_report_session(
    *,
    normalized_session: str,
    timezone: str,
    infer_market_report_session: Callable[[datetime], str],
    resolve_market_timezone: Callable[[str], Any],
) -> str:
    """Resolve the concrete report session, inferring when set to auto."""
    if normalized_session != "auto":
        return normalized_session
    return infer_market_report_session(datetime.now(resolve_market_timezone(timezone)))


def maybe_persist_market_report(
    *,
    config: Any,
    report_markdown: str,
    resolved_session: str,
    timezone: str,
    save: bool,
    notify: bool,
    console: Any,
    default_market_report_path: Callable[[Path, str, str], Path],
) -> Path | None:
    """Persist the rendered report when save/notify requires a file."""
    report_path: Path | None = None
    if (save or notify) and report_markdown:
        report_path = default_market_report_path(config.workspace_path, resolved_session, timezone)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_markdown, encoding="utf-8")
        if save:
            console.print(f"[green]✓[/green] Saved report to {report_path}")
    return report_path


def render_market_report_output(*, console: Any, payload: dict[str, Any], json_output: bool) -> None:
    """Render the final CLI output for market report."""
    if json_output:
        console.print_json(data=payload)
        return
    brief_markdown = payload.get("briefMarkdown", "")
    console.print(Markdown(brief_markdown or "No market brief generated."))


def run_market_report(
    *,
    config: Any,
    symbols: str,
    headline: str,
    body: str,
    timezone: str,
    session: str,
    json_output: bool,
    save: bool,
    notify: bool,
    notify_channel: str,
    chat_id: str,
    console: Any,
    parse_symbol_csv: Callable[[str | None], list[str]],
    pick_notify_target: Callable[..., tuple[str, str] | None],
    send_message_once: Callable[[Any, str, str, str, list[str] | None], Awaitable[None]],
    market_brief_tool_factory: Callable[[Any], Any],
    infer_market_report_session: Callable[[datetime], str],
    resolve_market_timezone: Callable[[str], Any],
    render_market_report_document: Callable[..., str],
    default_market_report_path: Callable[[Path, str, str], Path],
    render_market_report_notification: Callable[..., str],
) -> None:
    """Execute the market report CLI flow."""
    normalized_session = normalize_market_report_session(session)
    notify_target: tuple[str, str] | None = None
    if notify:
        notify_target = pick_notify_target(
            config,
            preferred_channel=notify_channel,
            preferred_chat_id=chat_id,
        )

    selected_symbols = parse_symbol_csv(symbols) or config.tools.market.default_symbols
    tool = market_brief_tool_factory(config.tools.market)
    payload = asyncio.run(
        fetch_market_report_payload(
            tool=tool,
            selected_symbols=selected_symbols,
            headline=headline,
            body=body,
        )
    )
    resolved_session = resolve_market_report_session(
        normalized_session=normalized_session,
        timezone=timezone,
        infer_market_report_session=infer_market_report_session,
        resolve_market_timezone=resolve_market_timezone,
    )
    report_markdown = render_market_report_document(
        payload,
        symbols=selected_symbols,
        headline=headline,
        session=resolved_session,
        timezone_name=timezone,
    )
    report_path = maybe_persist_market_report(
        config=config,
        report_markdown=report_markdown,
        resolved_session=resolved_session,
        timezone=timezone,
        save=save,
        notify=notify,
        console=console,
        default_market_report_path=default_market_report_path,
    )

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
        asyncio.run(send_message_once(config, channel_name, target_chat_id, notify_text, [str(report_path)]))
        console.print(f"[green]✓[/green] Sent report to {channel_name}:{target_chat_id}")

    render_market_report_output(console=console, payload=payload, json_output=json_output)

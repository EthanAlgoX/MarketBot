"""Shared CLI status rendering helpers."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from rich.table import Table
from marketbot.runtime.diagnostics import collect_runtime_diagnostics


def render_channels_status_table(config: Any) -> Table:
    """Build the channel status table for CLI output."""
    table = Table(title="Channel Status")
    table.add_column("Channel", style="cyan")
    table.add_column("Enabled", style="green")
    table.add_column("Configuration", style="yellow")

    wa = config.channels.whatsapp
    table.add_row("WhatsApp", "✓" if wa.enabled else "✗", wa.bridge_url)

    dc = config.channels.discord
    table.add_row("Discord", "✓" if dc.enabled else "✗", dc.gateway_url)

    fs = config.channels.feishu
    fs_config = f"app_id: {fs.app_id[:10]}..." if fs.app_id else "[dim]not configured[/dim]"
    table.add_row("Feishu", "✓" if fs.enabled else "✗", fs_config)

    mc = config.channels.mochat
    mc_base = mc.base_url or "[dim]not configured[/dim]"
    table.add_row("Mochat", "✓" if mc.enabled else "✗", mc_base)

    tg = config.channels.telegram
    tg_config = f"token: {tg.token[:10]}..." if tg.token else "[dim]not configured[/dim]"
    table.add_row("Telegram", "✓" if tg.enabled else "✗", tg_config)

    slack = config.channels.slack
    slack_config = "socket" if slack.app_token and slack.bot_token else "[dim]not configured[/dim]"
    table.add_row("Slack", "✓" if slack.enabled else "✗", slack_config)

    dt = config.channels.dingtalk
    dt_config = f"client_id: {dt.client_id[:10]}..." if dt.client_id else "[dim]not configured[/dim]"
    table.add_row("DingTalk", "✓" if dt.enabled else "✗", dt_config)

    qq = config.channels.qq
    qq_config = f"app_id: {qq.app_id[:10]}..." if qq.app_id else "[dim]not configured[/dim]"
    table.add_row("QQ", "✓" if qq.enabled else "✗", qq_config)

    em = config.channels.email
    em_config = em.imap_host if em.imap_host else "[dim]not configured[/dim]"
    table.add_row("Email", "✓" if em.enabled else "✗", em_config)
    return table


def build_status_payload(
    config: Any,
    config_path: Path,
    *,
    bus: Any | None = None,
    session_manager: Any | None = None,
) -> dict[str, Any]:
    """Build machine-readable status payload for CLI and automation."""
    workspace = config.workspace_path
    browser_cfg = config.tools.browser
    browser_enabled = bool(browser_cfg.enabled)
    browser_command = str(browser_cfg.command or "bb-browser").strip() or "bb-browser"
    browser_binary = shutil.which(browser_command) if browser_enabled else None
    twitter_cfg = config.tools.twitter_cli
    twitter_enabled = bool(twitter_cfg.enabled)
    twitter_command = str(twitter_cfg.command or "twitter").strip() or "twitter"
    twitter_binary = shutil.which(twitter_command) if twitter_enabled else None
    lark_cfg = config.tools.lark_cli
    lark_enabled = bool(lark_cfg.enabled)
    lark_command = str(lark_cfg.command or "lark-cli").strip() or "lark-cli"
    lark_binary = shutil.which(lark_command) if lark_enabled else None

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
        "larkCli": {
            "enabled": lark_enabled,
            "command": lark_command,
            "commandFound": bool(lark_binary),
            "configDir": str(lark_cfg.config_dir or ""),
            "allowWrite": bool(lark_cfg.allow_write),
            "allowAuth": bool(lark_cfg.allow_auth),
        },
        "twitterCli": {
            "enabled": twitter_enabled,
            "command": twitter_command,
            "commandFound": bool(twitter_binary),
            "browser": str(twitter_cfg.browser or ""),
            "chromeProfile": str(twitter_cfg.chrome_profile or ""),
            "proxy": str(twitter_cfg.proxy or ""),
            "homeDir": str(twitter_cfg.home_dir or ""),
            "allowWrite": bool(twitter_cfg.allow_write),
        },
        "providers": [],
    }
    payload.update(collect_runtime_diagnostics(bus=bus, session_manager=session_manager))

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


def format_browser_runtime_summary(config: Any) -> str:
    """Render a compact browser safety summary for startup logs."""
    browser = build_status_payload(config, Path("."))["browser"]
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


def render_status(
    console: Any,
    *,
    logo: str,
    config: Any,
    config_path: Path,
    bus: Any | None = None,
    session_manager: Any | None = None,
) -> None:
    """Render the human-readable status command output."""
    payload = build_status_payload(config, config_path, bus=bus, session_manager=session_manager)
    workspace = config.workspace_path
    browser = payload["browser"]
    twitter_cli = payload["twitterCli"]
    lark_cli = payload["larkCli"]

    console.print(f"{logo} marketbot Status\n")
    console.print(f"Config: {config_path} {'[green]✓[/green]' if config_path.exists() else '[red]✗[/red]'}")
    console.print(f"Workspace: {workspace} {'[green]✓[/green]' if workspace.exists() else '[red]✗[/red]'}")

    browser_status = "[green]✓[/green]" if browser["enabled"] else "[dim]disabled[/dim]"
    if browser["enabled"] and not browser["commandFound"]:
        browser_status = "[yellow]! command not found[/yellow]"
    console.print(f"Browser: {browser_status}")
    if browser["enabled"]:
        console.print(f"Browser mode: {browser['mode']}")
        console.print(f"Browser command: {browser['command']}")
        console.print("Browser eval: " + ("[red]enabled[/red]" if browser["allowEval"] else "[dim]disabled[/dim]"))
        console.print(
            "Browser request capture: "
            + ("[yellow]enabled[/yellow]" if browser["allowRequestCapture"] else "[dim]disabled[/dim]")
        )
        console.print(
            "Browser request bodies: "
            + ("[red]enabled[/red]" if browser["allowRequestBodies"] else "[dim]disabled[/dim]")
        )
        if browser["allowSites"]:
            console.print(f"Browser allowSites: {', '.join(browser['allowSites'])}")
        if browser["allowAdapters"]:
            console.print(f"Browser allowAdapters: {', '.join(browser['allowAdapters'])}")
        if browser["allowDomains"]:
            console.print(f"Browser allowDomains: {', '.join(browser['allowDomains'])}")
        if browser["allowUrlPrefixes"]:
            console.print(f"Browser allowUrlPrefixes: {', '.join(browser['allowUrlPrefixes'])}")

    lark_status = "[green]✓[/green]" if lark_cli["enabled"] else "[dim]disabled[/dim]"
    if lark_cli["enabled"] and not lark_cli["commandFound"]:
        lark_status = "[yellow]! command not found[/yellow]"
    console.print(f"Lark CLI: {lark_status}")
    if lark_cli["enabled"]:
        console.print(f"Lark CLI command: {lark_cli['command']}")
        if lark_cli["configDir"]:
            console.print(f"Lark CLI configDir: {lark_cli['configDir']}")
        console.print(
            "Lark CLI writes: " + ("[yellow]enabled[/yellow]" if lark_cli["allowWrite"] else "[dim]disabled[/dim]")
        )
        console.print(
            "Lark CLI auth: " + ("[yellow]enabled[/yellow]" if lark_cli["allowAuth"] else "[dim]disabled[/dim]")
        )

    twitter_status = "[green]✓[/green]" if twitter_cli["enabled"] else "[dim]disabled[/dim]"
    if twitter_cli["enabled"] and not twitter_cli["commandFound"]:
        twitter_status = "[yellow]! command not found[/yellow]"
    console.print(f"Twitter CLI: {twitter_status}")
    if twitter_cli["enabled"]:
        console.print(f"Twitter CLI command: {twitter_cli['command']}")
        if twitter_cli["browser"]:
            console.print(f"Twitter CLI browser: {twitter_cli['browser']}")
        if twitter_cli["chromeProfile"]:
            console.print(f"Twitter CLI chromeProfile: {twitter_cli['chromeProfile']}")
        if twitter_cli["proxy"]:
            console.print(f"Twitter CLI proxy: {twitter_cli['proxy']}")
        if twitter_cli["homeDir"]:
            console.print(f"Twitter CLI homeDir: {twitter_cli['homeDir']}")
        console.print(
            "Twitter CLI writes: "
            + ("[yellow]enabled[/yellow]" if twitter_cli["allowWrite"] else "[dim]disabled[/dim]")
        )

    if config_path.exists():
        console.print(f"Model: {config.agents.defaults.model}")
        for spec in payload["providers"]:
            if spec["type"] == "oauth":
                console.print(f"{spec['label']}: [green]✓ (OAuth)[/green]")
            elif spec["type"] == "local":
                if spec.get("apiBase"):
                    console.print(f"{spec['label']}: [green]✓ {spec['apiBase']}[/green]")
                else:
                    console.print(f"{spec['label']}: [dim]not set[/dim]")
            else:
                configured = bool(spec["configured"])
                console.print(f"{spec['label']}: {'[green]✓[/green]' if configured else '[dim]not set[/dim]'}")
    if payload.get("bus"):
        inbound = payload["bus"]["inbound"]
        outbound = payload["bus"]["outbound"]
        console.print(
            "Queue inbound: "
            + f"{inbound['size']}/{inbound['maxsize']} "
            + f"(published={inbound['published']}, wait={inbound['publish_wait_s']:.3f}s)"
        )
        console.print(
            "Queue outbound: "
            + f"{outbound['size']}/{outbound['maxsize']} "
            + f"(published={outbound['published']}, wait={outbound['publish_wait_s']:.3f}s)"
        )
    if payload.get("sessions"):
        sessions = payload["sessions"]
        console.print(
            "Sessions: "
            + f"stored={sessions['storedSessions']} "
            + f"cached={sessions['cachedSessions']} "
            + f"cached_messages={sessions['cachedMessages']}"
        )
        console.print(
            "Session storage: "
            + f"bytes={sessions['storedBytes']} "
            + f"legacy={sessions['legacySessions']} "
            + f"compact_threshold={sessions['compactMetadataThreshold']}"
        )

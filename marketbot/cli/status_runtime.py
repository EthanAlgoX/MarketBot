"""Shared CLI status rendering helpers."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from rich.table import Table

from marketbot.config.finance import mcp_configuration_status
from marketbot.config.loader import get_language
from marketbot.i18n import msg
from marketbot.runtime.diagnostics import collect_runtime_diagnostics


def _local_command_status(command: Any) -> dict[str, Any]:
    """Check a configured executable without running it or inspecting credentials."""
    command_text = str(command or "")
    configured = bool(command_text.strip())
    available = bool(shutil.which(command_text)) if configured else False
    return {
        "command": command_text,
        "commandConfigured": configured,
        "commandAvailable": available,
        "commandFound": available,  # Compatibility with existing status consumers.
    }


def render_channels_status_table(config: Any) -> Table:
    """Build the channel status table for CLI output."""
    language = get_language(config)
    table = Table(title=msg("Channel Status", "渠道状态", language))
    table.add_column(msg("Channel", "渠道", language), style="cyan")
    table.add_column(msg("Enabled", "已启用", language), style="green")
    table.add_column(msg("Configuration", "配置", language), style="yellow")
    missing = f"[dim]{msg('not configured', '未配置', language)}[/dim]"

    wa = config.channels.whatsapp
    table.add_row("WhatsApp", "✓" if wa.enabled else "✗", wa.bridge_url)

    dc = config.channels.discord
    table.add_row("Discord", "✓" if dc.enabled else "✗", dc.gateway_url)

    fs = config.channels.feishu
    fs_config = f"app_id: {fs.app_id[:10]}..." if fs.app_id else missing
    table.add_row("Feishu", "✓" if fs.enabled else "✗", fs_config)

    mc = config.channels.mochat
    mc_base = mc.base_url or missing
    table.add_row("Mochat", "✓" if mc.enabled else "✗", mc_base)

    tg = config.channels.telegram
    tg_config = f"token: {tg.token[:10]}..." if tg.token else missing
    table.add_row("Telegram", "✓" if tg.enabled else "✗", tg_config)

    slack = config.channels.slack
    slack_config = "socket" if slack.app_token and slack.bot_token else missing
    table.add_row("Slack", "✓" if slack.enabled else "✗", slack_config)

    dt = config.channels.dingtalk
    dt_config = f"client_id: {dt.client_id[:10]}..." if dt.client_id else missing
    table.add_row("DingTalk", "✓" if dt.enabled else "✗", dt_config)

    qq = config.channels.qq
    qq_config = f"app_id: {qq.app_id[:10]}..." if qq.app_id else missing
    table.add_row("QQ", "✓" if qq.enabled else "✗", qq_config)

    em = config.channels.email
    em_config = em.imap_host if em.imap_host else missing
    table.add_row("Email", "✓" if em.enabled else "✗", em_config)
    matrix = config.channels.matrix
    table.add_row("Matrix", "✓" if matrix.enabled else "✗", matrix.homeserver)
    return table


def build_channels_status_payload(config: Any) -> dict[str, Any]:
    """Build machine-readable channel status for CLI automation."""
    channels = config.channels
    return {
        "language": get_language(config),
        "channels": [
            {
                "name": "whatsapp",
                "enabled": bool(channels.whatsapp.enabled),
                "configuration": {"bridgeUrl": channels.whatsapp.bridge_url},
            },
            {
                "name": "discord",
                "enabled": bool(channels.discord.enabled),
                "configuration": {"gatewayUrl": channels.discord.gateway_url},
            },
            {
                "name": "feishu",
                "enabled": bool(channels.feishu.enabled),
                "configuration": {"appIdConfigured": bool(channels.feishu.app_id)},
            },
            {
                "name": "mochat",
                "enabled": bool(channels.mochat.enabled),
                "configuration": {"baseUrlConfigured": bool(channels.mochat.base_url)},
            },
            {
                "name": "telegram",
                "enabled": bool(channels.telegram.enabled),
                "configuration": {"tokenConfigured": bool(channels.telegram.token)},
            },
            {
                "name": "slack",
                "enabled": bool(channels.slack.enabled),
                "configuration": {
                    "appTokenConfigured": bool(channels.slack.app_token),
                    "botTokenConfigured": bool(channels.slack.bot_token),
                },
            },
            {
                "name": "dingtalk",
                "enabled": bool(channels.dingtalk.enabled),
                "configuration": {"clientIdConfigured": bool(channels.dingtalk.client_id)},
            },
            {
                "name": "qq",
                "enabled": bool(channels.qq.enabled),
                "configuration": {"appIdConfigured": bool(channels.qq.app_id)},
            },
            {
                "name": "email",
                "enabled": bool(channels.email.enabled),
                "configuration": {"imapHostConfigured": bool(channels.email.imap_host)},
            },
            {
                "name": "matrix",
                "enabled": bool(channels.matrix.enabled),
                "configuration": {
                    "homeserver": channels.matrix.homeserver,
                    "userIdConfigured": bool(channels.matrix.user_id),
                    "accessTokenConfigured": bool(channels.matrix.access_token),
                },
            },
        ]
    }


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
    twitter_cfg = config.tools.twitter_cli
    twitter_enabled = bool(twitter_cfg.enabled)
    lark_cfg = config.tools.lark_cli
    lark_enabled = bool(lark_cfg.enabled)
    xhs_cfg = config.tools.xiaohongshu_cli

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
            "language": get_language(config),
        },
        "finance": {
            "enabled": bool(config.tools.market.enabled),
            "quoteSource": config.tools.market.quote_source,
            "defaultSymbols": list(config.tools.market.default_symbols),
        },
        "mcp": mcp_configuration_status(config),
        "browser": {
            "enabled": browser_enabled,
            "mode": browser_cfg.mode,
            **_local_command_status(browser_cfg.command),
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
            **_local_command_status(lark_cfg.command),
            "configDir": str(lark_cfg.config_dir or ""),
            "allowWrite": bool(lark_cfg.allow_write),
            "allowAuth": bool(lark_cfg.allow_auth),
        },
        "twitterCli": {
            "enabled": twitter_enabled,
            **_local_command_status(twitter_cfg.command),
            "browser": str(twitter_cfg.browser or ""),
            "chromeProfile": str(twitter_cfg.chrome_profile or ""),
            "proxy": str(twitter_cfg.proxy or ""),
            "homeDir": str(twitter_cfg.home_dir or ""),
            "allowWrite": bool(twitter_cfg.allow_write),
        },
        "xiaohongshuCli": {
            "enabled": bool(xhs_cfg.enabled),
            **_local_command_status(xhs_cfg.command),
            "cookieSource": str(xhs_cfg.cookie_source or "auto"),
            "homeDir": str(xhs_cfg.home_dir or ""),
            "timeoutS": int(xhs_cfg.timeout_s),
            "allowWrite": bool(xhs_cfg.allow_write),
            "allowedWriteOperations": ["post"] if xhs_cfg.allow_write else [],
            "authenticationStatus": "not_checked",
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
            entry["configured"] = None
            entry["authenticationStatus"] = "not_checked"
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
    language = get_language(config)
    workspace = config.workspace_path
    browser = payload["browser"]
    twitter_cli = payload["twitterCli"]
    lark_cli = payload["larkCli"]
    xhs_cli = payload["xiaohongshuCli"]

    def show(english: str, chinese: str, value: Any) -> None:
        console.print(f"{msg(english, chinese, language)}: {value}", markup=False, soft_wrap=True)

    def enabled(value: bool) -> str:
        return msg("enabled", "已启用", language) if value else msg("disabled", "已禁用", language)

    def cli_status(settings: dict[str, Any]) -> str:
        if not settings["enabled"]:
            return enabled(False)
        return "✓" if settings["commandAvailable"] else msg("! command not found", "! 未找到可执行命令", language)

    console.print(msg(f"{logo} marketbot Status\n", f"{logo} marketbot 状态\n", language), markup=False)
    show("Language", "语言", "English (en)" if language == "en" else "中文（zh）")
    show("Config", "配置", f"{config_path} {'✓' if config_path.exists() else '✗'}")
    show("Workspace", "工作区", f"{workspace} {'✓' if workspace.exists() else '✗'}")
    show("Finance tools", "金融工具", enabled(payload["finance"]["enabled"]))
    for server in payload["mcp"]:
        show(f"MCP {server['name']}", f"MCP {server['name']}", f"{server['state']} ({server['transport']})")
        if server["enabled"] and server["missingEnv"]:
            show("  Missing environment", "  缺少环境变量", ", ".join(server["missingEnv"]))

    show("Browser", "浏览器", cli_status(browser))
    if browser["enabled"]:
        show("Browser mode", "浏览器模式", browser["mode"])
        show("Browser command", "浏览器命令", browser["command"])
        show("Browser eval", "浏览器脚本执行", enabled(browser["allowEval"]))
        show("Browser request capture", "浏览器请求捕获", enabled(browser["allowRequestCapture"]))
        show("Browser request bodies", "浏览器请求正文", enabled(browser["allowRequestBodies"]))
        if browser["allowSites"]:
            show("Browser allowSites", "浏览器允许的网站", ", ".join(browser["allowSites"]))
        if browser["allowAdapters"]:
            show("Browser allowAdapters", "浏览器允许的适配器", ", ".join(browser["allowAdapters"]))
        if browser["allowDomains"]:
            show("Browser allowDomains", "浏览器允许的域名", ", ".join(browser["allowDomains"]))
        if browser["allowUrlPrefixes"]:
            show("Browser allowUrlPrefixes", "浏览器允许的 URL 前缀", ", ".join(browser["allowUrlPrefixes"]))

    show("Lark CLI", "飞书 CLI", cli_status(lark_cli))
    if lark_cli["enabled"]:
        show("Lark CLI command", "飞书 CLI 命令", lark_cli["command"])
        if lark_cli["configDir"]:
            show("Lark CLI configDir", "飞书 CLI 配置目录", lark_cli["configDir"])
        show("Lark CLI writes", "飞书 CLI 写入权限", enabled(lark_cli["allowWrite"]))
        show("Lark CLI auth", "飞书 CLI 授权操作", enabled(lark_cli["allowAuth"]))

    show("Twitter CLI", "Twitter CLI", cli_status(twitter_cli))
    if twitter_cli["enabled"]:
        show("Twitter CLI command", "Twitter CLI 命令", twitter_cli["command"])
        if twitter_cli["browser"]:
            show("Twitter CLI browser", "Twitter CLI 浏览器", twitter_cli["browser"])
        if twitter_cli["chromeProfile"]:
            show("Twitter CLI chromeProfile", "Twitter CLI 浏览器用户配置", twitter_cli["chromeProfile"])
        if twitter_cli["proxy"]:
            show("Twitter CLI proxy", "Twitter CLI 代理", twitter_cli["proxy"])
        if twitter_cli["homeDir"]:
            show("Twitter CLI homeDir", "Twitter CLI 数据目录", twitter_cli["homeDir"])
        show("Twitter CLI writes", "Twitter CLI 写入权限", enabled(twitter_cli["allowWrite"]))

    show("Xiaohongshu CLI", "小红书 CLI", cli_status(xhs_cli))
    if xhs_cli["enabled"]:
        show("Xiaohongshu CLI command", "小红书 CLI 命令", xhs_cli["command"])
        show("Xiaohongshu CLI cookie source", "小红书 CLI Cookie 来源", xhs_cli["cookieSource"])
        if xhs_cli["homeDir"]:
            show("Xiaohongshu CLI homeDir", "小红书 CLI 数据目录", xhs_cli["homeDir"])
        show("Xiaohongshu CLI writes (post)", "小红书 CLI 发布权限（post）", enabled(xhs_cli["allowWrite"]))
        show("Xiaohongshu CLI", "小红书 CLI", msg("login status not checked", "未检查登录状态", language))

    if config_path.exists():
        show("Model", "模型", config.agents.defaults.model)
        for spec in payload["providers"]:
            if spec["type"] == "oauth":
                show(spec["label"], spec["label"], msg("OAuth login status not checked", "未检查 OAuth 登录状态", language))
            elif spec["type"] == "local":
                show(spec["label"], spec["label"], f"✓ {spec['apiBase']}" if spec.get("apiBase") else msg("not set", "未设置", language))
            else:
                show(spec["label"], spec["label"], "✓" if spec["configured"] else msg("not set", "未设置", language))
    if payload.get("bus"):
        inbound = payload["bus"]["inbound"]
        outbound = payload["bus"]["outbound"]
        show("Queue inbound", "接收队列", f"{inbound['size']}/{inbound['maxsize']} (published={inbound['published']}, wait={inbound['publish_wait_s']:.3f}s)")
        show("Queue outbound", "发送队列", f"{outbound['size']}/{outbound['maxsize']} (published={outbound['published']}, wait={outbound['publish_wait_s']:.3f}s)")
    if payload.get("sessions"):
        sessions = payload["sessions"]
        show("Sessions", "会话", f"stored={sessions['storedSessions']} cached={sessions['cachedSessions']} cached_messages={sessions['cachedMessages']}")
        show("Session storage", "会话存储", f"bytes={sessions['storedBytes']} legacy={sessions['legacySessions']} compact_threshold={sessions['compactMetadataThreshold']}")

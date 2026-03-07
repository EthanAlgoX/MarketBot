"""CLI commands for marketbot."""

import asyncio
import json
import os
import select
import signal
import sys
from datetime import datetime
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

console = Console()
EXIT_COMMANDS = {"exit", "quit", "/exit", "/quit", ":q"}

# ---------------------------------------------------------------------------
# CLI input: prompt_toolkit for editing, paste, history, and display
# ---------------------------------------------------------------------------

_PROMPT_SESSION: PromptSession | None = None
_SAVED_TERM_ATTRS = None  # original termios settings, restored on exit


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
        console.print(f"{__logo__} Interactive mode (type [bold]exit[/bold] or [bold]Ctrl+C[/bold] to quit)\n")

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
def status():
    """Show marketbot status."""
    from marketbot.config.loader import get_config_path, load_config

    config_path = get_config_path()
    config = load_config()
    workspace = config.workspace_path

    console.print(f"{__logo__} marketbot Status\n")

    console.print(f"Config: {config_path} {'[green]✓[/green]' if config_path.exists() else '[red]✗[/red]'}")
    console.print(f"Workspace: {workspace} {'[green]✓[/green]' if workspace.exists() else '[red]✗[/red]'}")

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

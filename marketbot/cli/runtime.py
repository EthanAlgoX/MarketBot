"""Shared runtime construction helpers for CLI commands."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import typer
from rich.console import Console

from marketbot.config.schema import Config


@dataclass(slots=True)
class AgentRuntime:
    """Shared runtime objects used by CLI entrypoints."""

    bus: Any
    provider: Any
    cron: Any
    agent_loop: Any


def make_provider(config: Config, console: Console):
    """Create the configured LLM provider."""
    from marketbot.providers.azure_openai_provider import AzureOpenAIProvider
    from marketbot.providers.custom_provider import CustomProvider
    from marketbot.providers.litellm_provider import LiteLLMProvider
    from marketbot.providers.openai_codex_provider import OpenAICodexProvider
    from marketbot.providers.registry import find_by_name

    model = config.agents.defaults.model
    provider_name = config.get_provider_name(model)
    provider_config = config.get_provider(model)

    if provider_name == "openai_codex" or model.startswith("openai-codex/"):
        return OpenAICodexProvider(default_model=model)

    if provider_name == "custom":
        return CustomProvider(
            api_key=provider_config.api_key if provider_config else "no-key",
            api_base=config.get_api_base(model) or "http://localhost:8000/v1",
            default_model=model,
            extra_headers=provider_config.extra_headers if provider_config else None,
        )

    if provider_name == "azure_openai":
        if not provider_config or not provider_config.api_key or not provider_config.api_base:
            console.print("[red]Error: Azure OpenAI requires api_key and api_base.[/red]")
            console.print("Set them in ~/.marketbot/config.json under providers.azure_openai section")
            console.print("Use the model field to specify the deployment name.")
            raise typer.Exit(1)
        return AzureOpenAIProvider(
            api_key=provider_config.api_key,
            api_base=provider_config.api_base,
            default_model=model,
        )

    spec = find_by_name(provider_name)
    if not model.startswith("bedrock/") and not (provider_config and provider_config.api_key) and not (spec and spec.is_oauth):
        console.print("[red]Error: No API key configured.[/red]")
        console.print("Set one in ~/.marketbot/config.json under providers section")
        raise typer.Exit(1)

    return LiteLLMProvider(
        api_key=provider_config.api_key if provider_config else None,
        api_base=config.get_api_base(model),
        default_model=model,
        extra_headers=provider_config.extra_headers if provider_config else None,
        provider_name=provider_name,
    )


def build_agent_runtime(
    config: Config,
    *,
    console: Console,
    cron_store_path: Path,
    session_manager: Any | None = None,
) -> AgentRuntime:
    """Build the shared bus/provider/cron/agent objects used by CLI entrypoints."""
    from marketbot.agent.loop import AgentLoop
    from marketbot.bus.queue import MessageBus
    from marketbot.cron.service import CronService

    bus = MessageBus()
    provider = make_provider(config, console)
    cron = CronService(cron_store_path)
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
        xiaohongshu_cli_config=config.tools.xiaohongshu_cli,
        twitter_cli_config=config.tools.twitter_cli,
        lark_cli_config=config.tools.lark_cli,
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
    return AgentRuntime(bus=bus, provider=provider, cron=cron, agent_loop=agent_loop)

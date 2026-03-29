from __future__ import annotations

import typer
from rich.console import Console

from marketbot.cli.runtime import build_agent_runtime, make_provider
from marketbot.config.schema import Config
from marketbot.providers.litellm_provider import LiteLLMProvider


def test_make_provider_requires_api_key_for_non_oauth_model() -> None:
    config = Config()
    config.agents.defaults.model = "gpt-4o-mini"

    try:
        make_provider(config, Console())
    except typer.Exit as exc:
        assert exc.exit_code == 1
    else:  # pragma: no cover - defensive
        raise AssertionError("Expected missing API key to raise typer.Exit")


def test_build_agent_runtime_wires_config_into_agent_loop(monkeypatch, tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.agents.defaults.model = "test-model"
    config.tools.web.search.api_key = "brave-key"
    config.tools.web.proxy = "http://127.0.0.1:8080"
    config.tools.restrict_to_workspace = True
    session_manager = object()

    captured: dict[str, object] = {}

    class _FakeBus:
        pass

    class _FakeCronService:
        def __init__(self, path):
            captured["cron_path"] = path

    class _FakeAgentLoop:
        def __init__(self, **kwargs):
            captured["agent_kwargs"] = kwargs

    provider = object()

    monkeypatch.setattr("marketbot.cli.runtime.make_provider", lambda config, console: provider)
    monkeypatch.setattr("marketbot.bus.queue.MessageBus", _FakeBus)
    monkeypatch.setattr("marketbot.cron.service.CronService", _FakeCronService)
    monkeypatch.setattr("marketbot.agent.loop.AgentLoop", _FakeAgentLoop)

    runtime = build_agent_runtime(
        config,
        console=Console(),
        cron_store_path=tmp_path / "cron" / "jobs.json",
        session_manager=session_manager,
    )

    assert runtime.provider is provider
    assert isinstance(runtime.bus, _FakeBus)
    assert isinstance(runtime.cron, _FakeCronService)
    assert isinstance(runtime.agent_loop, _FakeAgentLoop)
    assert captured["cron_path"] == tmp_path / "cron" / "jobs.json"
    assert captured["agent_kwargs"]["provider"] is provider
    assert captured["agent_kwargs"]["workspace"] == config.workspace_path
    assert captured["agent_kwargs"]["session_manager"] is session_manager
    assert captured["agent_kwargs"]["brave_api_key"] == "brave-key"
    assert captured["agent_kwargs"]["web_proxy"] == "http://127.0.0.1:8080"
    assert captured["agent_kwargs"]["restrict_to_workspace"] is True


def test_make_provider_passes_custom_extra_headers() -> None:
    config = Config()
    config.agents.defaults.model = "custom-model"
    config.providers.custom.api_key = "key"
    config.providers.custom.api_base = "https://example.com/v1"
    config.providers.custom.extra_headers = {"X-Test": "abc"}

    provider = make_provider(config, Console())

    assert provider._default_headers["X-Test"] == "abc"


def test_litellm_provider_builds_minimax_auth_headers(monkeypatch) -> None:
    monkeypatch.setenv("MINIMAX_API_KEY", "stale")
    provider = LiteLLMProvider(
        api_key="fresh-key",
        default_model="MiniMax-M2.5-highspeed",
        provider_name="minimax",
        extra_headers={"X-Test": "abc"},
    )

    headers = provider._request_extra_headers("MiniMax-M2.5-highspeed", "minimax/MiniMax-M2.5-highspeed")

    assert headers["Authorization"] == "Bearer fresh-key"
    assert headers["X-Test"] == "abc"

import json
from pathlib import Path

import pytest
from rich.console import Console

import marketbot.cli.status_runtime as status_runtime
from marketbot.bus.events import InboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.cli.status_runtime import (
    build_status_payload,
    render_channels_status_table,
    render_status,
)
from marketbot.config.schema import Config


def test_build_status_payload_reports_browser_and_provider_configuration(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.agents.defaults.model = "openrouter/openai/gpt-4.1-mini"
    config.tools.browser.enabled = True
    config.tools.browser.command = "bb-browser"
    config.providers.openrouter.api_key = "sk-test"

    payload = build_status_payload(config, tmp_path / "config.json")

    assert payload["workspace"]["path"] == str(tmp_path)
    assert payload["agent"]["model"] == "openrouter/openai/gpt-4.1-mini"
    assert payload["browser"]["enabled"] is True
    assert payload["browser"]["command"] == "bb-browser"
    assert any(p["name"] == "openrouter" and p["configured"] is True for p in payload["providers"])


def test_build_status_payload_reports_lark_cli_configuration(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.tools.lark_cli.enabled = True
    config.tools.lark_cli.command = "lark-cli"
    config.tools.lark_cli.config_dir = "/tmp/lark-cli"
    config.tools.lark_cli.allow_write = True
    config.tools.lark_cli.allow_auth = False

    payload = build_status_payload(config, tmp_path / "config.json")

    assert payload["larkCli"]["enabled"] is True
    assert payload["larkCli"]["command"] == "lark-cli"
    assert payload["larkCli"]["configDir"] == "/tmp/lark-cli"
    assert payload["larkCli"]["allowWrite"] is True
    assert payload["larkCli"]["allowAuth"] is False


def test_build_status_payload_reports_twitter_cli_configuration(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.tools.twitter_cli.enabled = True
    config.tools.twitter_cli.command = "twitter"
    config.tools.twitter_cli.browser = "chrome"
    config.tools.twitter_cli.chrome_profile = "Profile 2"
    config.tools.twitter_cli.proxy = "socks5://127.0.0.1:1080"
    config.tools.twitter_cli.home_dir = "/tmp/twitter-home"
    config.tools.twitter_cli.allow_write = True

    payload = build_status_payload(config, tmp_path / "config.json")

    assert payload["twitterCli"]["enabled"] is True
    assert payload["twitterCli"]["command"] == "twitter"
    assert payload["twitterCli"]["browser"] == "chrome"
    assert payload["twitterCli"]["chromeProfile"] == "Profile 2"
    assert payload["twitterCli"]["proxy"] == "socks5://127.0.0.1:1080"
    assert payload["twitterCli"]["homeDir"] == "/tmp/twitter-home"
    assert payload["twitterCli"]["allowWrite"] is True


@pytest.mark.parametrize(
    ("enabled", "command", "available"),
    [(True, "installed-tool", True), (False, "installed-tool", True), (True, "missing-tool", False), (True, "", False)],
)
def test_local_cli_status_separates_enablement_configuration_and_availability(
    tmp_path, monkeypatch, enabled, command, available,
) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    checks = []

    def which(name):
        checks.append(name)
        return "/usr/local/bin/installed-tool" if name == "installed-tool" else None

    monkeypatch.setattr(status_runtime.shutil, "which", which)
    for section in (config.tools.browser, config.tools.lark_cli, config.tools.twitter_cli, config.tools.xiaohongshu_cli):
        section.enabled = enabled
        section.command = command

    payload = build_status_payload(config, tmp_path / "config.json")

    for name in ("browser", "larkCli", "twitterCli", "xiaohongshuCli"):
        assert payload[name]["enabled"] is enabled
        assert payload[name]["command"] == command
        assert payload[name]["commandConfigured"] is bool(command)
        assert payload[name]["commandAvailable"] is available
        assert payload[name]["commandFound"] is available
    cli_checks = [name for name in checks if name in {"installed-tool", "missing-tool", ""}]
    assert cli_checks == ([command] * 4 if command else [])


@pytest.mark.parametrize("allow_write", [False, True])
def test_xiaohongshu_status_reports_permissions_without_inspecting_credentials(
    tmp_path, monkeypatch, allow_write,
) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")
    xhs = config.tools.xiaohongshu_cli
    xhs.enabled = True
    xhs.command = str(tmp_path / "cli[local]" / "xiaohongshu-command")
    xhs.cookie_source = "chrome"
    xhs.home_dir = str(tmp_path / "home[local]")
    xhs.timeout_s = 60
    xhs.allow_write = allow_write
    cookie_file = Path(xhs.home_dir) / "cookies.json"
    cookie_file.parent.mkdir()
    cookie_file.write_text('{"Cookie": "private-cookie", "Authorization": "private-header"}')
    monkeypatch.setenv("XHS_COOKIE", "private-environment-cookie")
    monkeypatch.setattr(status_runtime.shutil, "which", lambda command: "/usr/local/bin/xhs" if command == xhs.command else None)
    original_open = Path.open

    def guarded_open(path, *args, **kwargs):
        assert path != cookie_file, "status must not inspect cookie contents"
        return original_open(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", guarded_open)
    payload = build_status_payload(config, tmp_path / "config.json")

    assert payload["xiaohongshuCli"] == {
        "enabled": True,
        "command": xhs.command,
        "commandConfigured": True,
        "commandAvailable": True,
        "commandFound": True,
        "cookieSource": "chrome",
        "homeDir": xhs.home_dir,
        "timeoutS": 60,
        "allowWrite": allow_write,
        "allowedWriteOperations": ["post"] if allow_write else [],
        "authenticationStatus": "not_checked",
    }
    console = Console(record=True, width=20)
    render_status(console, logo="", config=config, config_path=tmp_path / "config.json")
    rendered = console.export_text()
    assert xhs.command in rendered
    assert xhs.home_dir in rendered
    assert "Xiaohongshu CLI" in rendered
    for secret in ("private-cookie", "private-header", "private-environment-cookie"):
        assert secret not in json.dumps(payload)
        assert secret not in rendered


def test_status_json_cli_includes_xiaohongshu_configuration(tmp_path, monkeypatch) -> None:
    from typer.testing import CliRunner

    from marketbot.cli.commands import app
    from marketbot.config.loader import save_config

    home = tmp_path / "isolated-home"
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    monkeypatch.setattr(status_runtime.shutil, "which", lambda command: None)
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")
    config.tools.xiaohongshu_cli.enabled = True
    config.providers.openrouter.api_key = "private-model-key"
    path = tmp_path / "settings.json"
    save_config(config, path)

    result = CliRunner().invoke(app, ["--config", str(path), "status", "--json"])

    assert result.exit_code == 0, result.exception
    xhs = json.loads(result.stdout)["xiaohongshuCli"]
    assert xhs["enabled"] is True
    assert xhs["commandConfigured"] is True
    assert xhs["commandAvailable"] is False
    assert xhs["allowWrite"] is False
    assert xhs["allowedWriteOperations"] == []
    assert xhs["authenticationStatus"] == "not_checked"
    assert "private-model-key" not in result.stdout
    assert not home.exists()
    assert not config.workspace_path.exists()


def test_render_channels_status_table_contains_enabled_and_masked_values() -> None:
    config = Config()
    config.channels.telegram.enabled = True
    config.channels.telegram.token = "1234567890abcdef"
    config.channels.feishu.app_id = "cli_app_id_123456"

    table = render_channels_status_table(config)
    console = Console(record=True, width=120)
    console.print(table)
    rendered = console.export_text()

    assert "Channel Status" in rendered
    assert "Configuration" in rendered
    assert "Telegram" in rendered
    assert "token: 1234567890" in rendered
    assert "Feishu" in rendered
    assert "app_id: cli_app_id" in rendered


async def test_build_status_payload_includes_bus_stats(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    bus = MessageBus(inbound_maxsize=2, outbound_maxsize=3)

    await bus.publish_inbound(InboundMessage(channel="cli", sender_id="u", chat_id="c", content="hello"))

    payload = build_status_payload(config, tmp_path / "config.json", bus=bus)

    assert payload["bus"]["inbound"]["size"] == 1
    assert payload["bus"]["inbound"]["maxsize"] == 2
    assert payload["bus"]["outbound"]["maxsize"] == 3


def test_build_status_payload_includes_session_stats(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    class _Sessions:
        @staticmethod
        def stats():
            return {
                "storedSessions": 2,
                "storedBytes": 128,
                "legacySessions": 0,
                "cachedSessions": 1,
                "cachedMessages": 5,
                "compactMetadataThreshold": 8,
            }

    payload = build_status_payload(config, tmp_path / "config.json", session_manager=_Sessions())

    assert payload["sessions"]["storedSessions"] == 2
    assert payload["sessions"]["storedBytes"] == 128
    assert payload["sessions"]["cachedMessages"] == 5

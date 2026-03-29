from pathlib import Path

from rich.console import Console

from marketbot.bus.events import InboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.cli.status_runtime import build_status_payload, render_channels_status_table
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

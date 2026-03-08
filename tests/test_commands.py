import json
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from typer.testing import CliRunner

from marketbot.cli.commands import app
from marketbot.config.schema import Config
from marketbot.providers.litellm_provider import LiteLLMProvider
from marketbot.providers.openai_codex_provider import _strip_model_prefix
from marketbot.providers.registry import find_by_model

runner = CliRunner()


@pytest.fixture
def mock_paths():
    """Mock config/workspace paths for test isolation."""
    with patch("marketbot.config.loader.get_config_path") as mock_cp, \
         patch("marketbot.config.loader.save_config") as mock_sc, \
         patch("marketbot.config.loader.load_config") as mock_lc, \
         patch("marketbot.utils.helpers.get_workspace_path") as mock_ws:

        base_dir = Path("./test_onboard_data")
        if base_dir.exists():
            shutil.rmtree(base_dir)
        base_dir.mkdir()

        config_file = base_dir / "config.json"
        workspace_dir = base_dir / "workspace"

        mock_cp.return_value = config_file
        mock_ws.return_value = workspace_dir
        mock_sc.side_effect = lambda config: config_file.write_text("{}")

        yield config_file, workspace_dir

        if base_dir.exists():
            shutil.rmtree(base_dir)


def test_onboard_fresh_install(mock_paths):
    """No existing config — should create from scratch."""
    config_file, workspace_dir = mock_paths

    result = runner.invoke(app, ["onboard"])

    assert result.exit_code == 0
    assert "Created config" in result.stdout
    assert "Created workspace" in result.stdout
    assert "marketbot is ready" in result.stdout
    assert config_file.exists()
    assert (workspace_dir / "AGENTS.md").exists()
    assert (workspace_dir / "memory" / "MEMORY.md").exists()


def test_onboard_existing_config_refresh(mock_paths):
    """Config exists, user declines overwrite — should refresh (load-merge-save)."""
    config_file, workspace_dir = mock_paths
    config_file.write_text('{"existing": true}')

    result = runner.invoke(app, ["onboard"], input="n\n")

    assert result.exit_code == 0
    assert "Config already exists" in result.stdout
    assert "existing values preserved" in result.stdout
    assert workspace_dir.exists()
    assert (workspace_dir / "AGENTS.md").exists()


def test_onboard_existing_config_overwrite(mock_paths):
    """Config exists, user confirms overwrite — should reset to defaults."""
    config_file, workspace_dir = mock_paths
    config_file.write_text('{"existing": true}')

    result = runner.invoke(app, ["onboard"], input="y\n")

    assert result.exit_code == 0
    assert "Config already exists" in result.stdout
    assert "Config reset to defaults" in result.stdout
    assert workspace_dir.exists()


def test_onboard_existing_workspace_safe_create(mock_paths):
    """Workspace exists — should not recreate, but still add missing templates."""
    config_file, workspace_dir = mock_paths
    workspace_dir.mkdir(parents=True)
    config_file.write_text("{}")

    result = runner.invoke(app, ["onboard"], input="n\n")

    assert result.exit_code == 0
    assert "Created workspace" not in result.stdout
    assert "Created AGENTS.md" in result.stdout
    assert (workspace_dir / "AGENTS.md").exists()


def test_config_matches_github_copilot_codex_with_hyphen_prefix():
    config = Config()
    config.agents.defaults.model = "github-copilot/gpt-5.3-codex"

    assert config.get_provider_name() == "github_copilot"


def test_config_matches_openai_codex_with_hyphen_prefix():
    config = Config()
    config.agents.defaults.model = "openai-codex/gpt-5.1-codex"

    assert config.get_provider_name() == "openai_codex"


def test_find_by_model_prefers_explicit_prefix_over_generic_codex_keyword():
    spec = find_by_model("github-copilot/gpt-5.3-codex")

    assert spec is not None
    assert spec.name == "github_copilot"


def test_litellm_provider_canonicalizes_github_copilot_hyphen_prefix():
    provider = LiteLLMProvider(default_model="github-copilot/gpt-5.3-codex")

    resolved = provider._resolve_model("github-copilot/gpt-5.3-codex")

    assert resolved == "github_copilot/gpt-5.3-codex"


def test_openai_codex_strip_prefix_supports_hyphen_and_underscore():
    assert _strip_model_prefix("openai-codex/gpt-5.1-codex") == "gpt-5.1-codex"
    assert _strip_model_prefix("openai_codex/gpt-5.1-codex") == "gpt-5.1-codex"


def test_market_report_command_renders_markdown(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.agent.tools.market.MarketBriefTool.execute", new=AsyncMock(return_value='{"briefMarkdown":"## Market Brief\\n\\n- NVDA: BUY","marketState":"bullish","signals":[{"symbol":"NVDA","action":"buy"}]}')):
        result = runner.invoke(app, ["market", "report", "--symbols", "NVDA,SPY"])

    assert result.exit_code == 0
    assert "Market Brief" in result.stdout
    assert "NVDA: BUY" in result.stdout


def test_market_heartbeat_setup_writes_template(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["market", "heartbeat-setup", "--symbols", "NVDA,SPY", "--overwrite"])

    assert result.exit_code == 0
    heartbeat = tmp_path / "HEARTBEAT.md"
    assert heartbeat.exists()
    content = heartbeat.read_text(encoding="utf-8")
    assert "NVDA, SPY" in content
    assert "09:30 local market open" in content
    assert "<!-- marketbot:mode market-report -->" in content
    assert "<!-- marketbot:timezone America/New_York -->" in content
    assert "<!-- marketbot:symbols NVDA,SPY -->" in content
    assert "<!-- marketbot:windows 09:20-09:40,11:55-12:10,15:55-16:10 -->" in content


def test_market_report_save_writes_standardized_document(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    payload = {
        "asOf": "2026-03-07T01:23:45Z",
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "marketState": "bullish",
        "marketSentimentIndex": 0.71,
        "signals": [
            {
                "symbol": "NVDA",
                "action": "buy",
                "confidence": 0.82,
                "score": 0.66,
                "signalCard": "Action: BUY\nWhy: momentum positive\nRisk: size <= 5%",
            }
        ],
        "scenarios": {
            "aggressive": ["Press NVDA longs"],
            "neutral": ["Scale entries"],
            "defensive": ["Honor stop losses"],
        },
        "macro": {"regime": "risk-on", "macroRisk": 0.31, "warnings": []},
        "social": {
            "overallSentiment": 0.24,
            "perSymbol": [{"symbol": "NVDA", "sentiment": 0.42, "confidence": 0.61, "mentions": 18}],
            "warnings": [],
        },
        "news": {
            "items": [
                {
                    "symbol": "NVDA",
                    "title": "NVIDIA launches new AI chip",
                    "source": "Reuters",
                    "publishedAt": "2026-03-07T01:10:00Z",
                }
            ],
            "warnings": [],
        },
        "snapshot": {"warnings": []},
        "dataReliability": {
            "overallStatus": "ok",
            "components": {
                "snapshot": {"status": "ok", "sourceHealth": {"mock": {"status": "ok"}}},
                "news": {"status": "ok", "sourceHealth": {"mock": {"status": "ok"}}},
                "macro": {"status": "ok", "sourceHealth": {"manual": {"status": "ok"}}},
            },
        },
    }

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.agent.tools.market.MarketBriefTool.execute", new=AsyncMock(return_value=json.dumps(payload))):
        result = runner.invoke(
            app,
            ["market", "report", "--symbols", "NVDA,SPY", "--session", "premarket", "--save"],
        )

    assert result.exit_code == 0
    reports = list((tmp_path / "reports").glob("market_report_premarket_*.md"))
    assert len(reports) == 1
    content = reports[0].read_text(encoding="utf-8")
    assert "# Market Report" in content
    assert "- Session: premarket" in content
    assert "## Signals" in content
    assert "### NVDA" in content
    assert "## Scenario Playbook" in content
    assert "## News Flow" in content
    assert "## Capability & Data Notes" in content
    assert "Data Reliability: ok" in content
    assert "## Tool Output" in content


def test_market_report_rejects_invalid_session(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["market", "report", "--session", "overnight"])

    assert result.exit_code != 0
    assert "session must be one of" in result.stdout


def test_market_report_notify_sends_to_explicit_channel(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.channels.telegram.enabled = True
    config.channels.telegram.token = "test-token"
    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "marketState": "bullish",
        "marketSentimentIndex": 0.72,
        "signals": [{"symbol": "NVDA", "action": "buy", "confidence": 0.81}],
        "macro": {"regime": "risk-on", "macroRisk": 0.22},
        "dataReliability": {"overallStatus": "ok"},
    }
    send_mock = AsyncMock()

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.agent.tools.market.MarketBriefTool.execute", new=AsyncMock(return_value=json.dumps(payload))), \
         patch("marketbot.cli.commands._send_message_once", new=send_mock):
        result = runner.invoke(
            app,
            [
                "market",
                "report",
                "--symbols",
                "NVDA",
                "--notify",
                "--notify-channel",
                "telegram",
                "--chat-id",
                "10001",
            ],
        )

    assert result.exit_code == 0
    assert "Sent report to telegram:10001" in result.stdout
    reports = list((tmp_path / "reports").glob("market_report_*"))
    assert len(reports) == 1
    send_mock.assert_awaited_once()
    args = send_mock.await_args.args
    assert args[1] == "telegram"
    assert args[2] == "10001"
    assert "Market Report Alert" in args[3]
    assert "Reliability: ok" in args[3]
    assert args[4] == [str(reports[0])]


def test_market_report_notify_can_use_recent_session(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.channels.telegram.enabled = True
    config.channels.telegram.token = "test-token"
    send_mock = AsyncMock()

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.agent.tools.market.MarketBriefTool.execute", new=AsyncMock(return_value='{"briefMarkdown":"## Market Brief","marketState":"neutral","signals":[],"macro":{"regime":"neutral","macroRisk":0.4}}')), \
         patch("marketbot.session.manager.SessionManager.list_sessions", return_value=[{"key": "telegram:recent-chat"}]), \
         patch("marketbot.cli.commands._send_message_once", new=send_mock):
        result = runner.invoke(app, ["market", "report", "--notify"])

    assert result.exit_code == 0
    send_mock.assert_awaited_once()
    assert send_mock.await_args.args[1] == "telegram"
    assert send_mock.await_args.args[2] == "recent-chat"


def test_market_report_notify_requires_chat_id_for_explicit_channel(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.channels.telegram.enabled = True

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["market", "report", "--notify", "--notify-channel", "telegram"])

    assert result.exit_code != 0
    assert "chat-id is required" in result.stdout

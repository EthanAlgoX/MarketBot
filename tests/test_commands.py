import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from typer.testing import CliRunner

from marketbot.agent.skills import SkillsLoader
from marketbot.cli.commands import (
    _build_openclaw_alerts_payload,
    _format_browser_runtime_summary,
    _render_openclaw_alertmanager_payload,
    app,
)
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


def test_rl_evaluate_command_outputs_summary():
    result = runner.invoke(
        app,
        [
            "rl",
            "evaluate",
            "--symbol",
            "SPY",
            "--prices",
            "100,105,110",
            "--position-pct",
            "0.5",
        ],
    )

    assert result.exit_code == 0
    assert "Offline RL Evaluation" in result.stdout
    assert "Symbol: SPY" in result.stdout
    assert "Reward:" in result.stdout


def test_rl_build_dataset_uses_default_rollout_log(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    rollout_path = tmp_path / "rl" / "market_signal.jsonl"
    rollout_path.parent.mkdir(parents=True, exist_ok=True)
    rollout_path.write_text(
        json.dumps(
            {
                "ts": "2026-03-12T00:00:00Z",
                "event": "market_signal_decision",
                "features": {
                    "symbol": "NVDA",
                    "price_change_pct": 2.5,
                    "news_sentiment": 0.7,
                    "social_sentiment": 0.4,
                    "macro_risk": 0.2,
                    "evidence": ["snapshot=strong", "news=positive"],
                },
                "decision": {
                    "structured_action": {
                        "action": "buy",
                        "position_pct": 0.08,
                        "stop_loss_pct": 0.03,
                        "take_profit_pct": 0.06,
                        "holding_horizon": "swing",
                        "confidence": 0.8,
                        "evidence_keys": ["snapshot", "news"],
                    },
                    "score": 0.64,
                    "policy_name": "heuristic_v1",
                    "policy_mode": "heuristic",
                },
                "result": {
                    "action": "buy",
                    "positionPct": 0.08,
                    "stopLossPct": 0.03,
                    "confidence": 0.8,
                    "score": 0.64,
                },
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "build-dataset"])

    assert result.exit_code == 0
    assert "Wrote 1 signal records" in result.stdout
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    assert dataset_path.exists()
    record = json.loads(dataset_path.read_text(encoding="utf-8").strip())
    assert record["task"]["symbol"] == "NVDA"
    assert record["label"]["action"] == "buy"


def test_rl_collect_command_appends_episode_log(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "collect",
                "--symbol",
                "NVDA",
                "--prices",
                "100,108,112",
                "--price-change-pct",
                "4.2",
                "--news-sentiment",
                "0.7",
                "--social-sentiment",
                "0.5",
                "--macro-risk",
                "0.1",
                "--evidence",
                "snapshot=strong;news=positive;macro=stable",
            ],
        )

    assert result.exit_code == 0
    assert "Collected RL Episode" in result.stdout
    assert "Signal: BUY" in result.stdout
    episode_log = tmp_path / "rl" / "episodes" / "market_signal_episodes.jsonl"
    assert episode_log.exists()
    event = json.loads(episode_log.read_text(encoding="utf-8").strip())
    assert event["event"] == "market_signal_episode"
    assert event["signal"]["structuredAction"]["action"] == "buy"
    assert event["environment"]["submit"]["applied"]["action"] == "buy"
    assert event["environment"]["evaluation"]["reward"]["score"] > 0


def test_rl_build_dataset_auto_detects_episode_logs(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    episode_path = tmp_path / "rl" / "episodes.jsonl"
    episode_path.parent.mkdir(parents=True, exist_ok=True)
    episode_path.write_text(
        json.dumps(
            {
                "ts": "2026-03-12T00:00:00Z",
                "event": "market_signal_episode",
                "task": {
                    "taskKey": "market_signal_episode",
                    "symbol": "NVDA",
                    "prices": [100.0, 108.0, 112.0],
                    "requestedSteps": 2,
                },
                "signal": {
                    "action": "buy",
                    "positionPct": 0.08,
                    "confidence": 0.8,
                    "score": 0.64,
                    "structuredAction": {
                        "action": "buy",
                        "position_pct": 0.08,
                        "stop_loss_pct": 0.03,
                        "take_profit_pct": 0.06,
                        "holding_horizon": "swing",
                        "confidence": 0.8,
                        "evidence_keys": ["snapshot", "news"],
                    },
                },
                "environment": {
                    "evaluation": {
                        "turnover": 0.08,
                        "maxDrawdown": 0.0,
                        "finalSnapshot": {"price": 112.0},
                        "finalPortfolio": {"equity": 1.0096},
                        "actionHistory": [{"action": "buy", "positionPct": 0.08}],
                        "reward": {
                            "realized_return": 0.0096,
                            "max_drawdown_penalty": 0.0,
                            "turnover_penalty": 0.0016,
                            "slippage_penalty": 0.00004,
                            "score": 0.00796,
                        },
                    }
                },
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "build-dataset", "--input", str(episode_path)])

    assert result.exit_code == 0
    assert "Wrote 1 episode records" in result.stdout
    dataset_path = tmp_path / "rl" / "datasets" / "market_episode_dataset.jsonl"
    assert dataset_path.exists()
    record = json.loads(dataset_path.read_text(encoding="utf-8").strip())
    assert record["task"]["symbol"] == "NVDA"
    assert record["trajectory"]["signal"]["action"] == "buy"
    assert record["reward"]["score"] == 0.00796


def test_rl_train_exports_jsonl_supervised_artifacts(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_signal_0",
                "prompt": "Analyze NVDA with price_change_pct=2.5, news_sentiment=0.7, social_sentiment=0.4, macro_risk=0.2.",
                "task": {"symbol": "NVDA", "objective": "predict structured market action"},
                "features": {"symbol": "NVDA"},
                "label": {
                    "action": "buy",
                    "position_pct": 0.08,
                    "stop_loss_pct": 0.03,
                    "confidence": 0.8,
                    "score": 0.64,
                },
                "metadata": {"event": "market_signal_decision"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "train", "--dataset", str(dataset_path)])

    assert result.exit_code == 0
    assert "RL Train Export" in result.stdout
    assert "Adapter: jsonl-supervised" in result.stdout
    artifact_path = tmp_path / "rl" / "training" / "jsonl-supervised" / "train.jsonl"
    manifest_path = tmp_path / "rl" / "training" / "jsonl-supervised" / "manifest.json"
    assert artifact_path.exists()
    assert manifest_path.exists()
    example = json.loads(artifact_path.read_text(encoding="utf-8").strip())
    assert example["source_type"] == "signal"
    assert json.loads(example["completion"])["action"] == "buy"


def test_rl_train_exports_episode_dataset_examples(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_episode_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_episode_0",
                "prompt": "Trade NVDA over an offline episode with 3 prices and evaluate the structured action for reward optimization.",
                "task": {
                    "task_key": "market_signal_episode",
                    "symbol": "NVDA",
                    "prices": [100.0, 108.0, 112.0],
                    "requested_steps": 2,
                    "objective": "maximize episode reward",
                },
                "trajectory": {
                    "signal": {
                        "action": "buy",
                        "position_pct": 0.08,
                        "confidence": 0.8,
                        "score": 0.64,
                    },
                    "actions": [{"action": "buy", "positionPct": 0.08}],
                    "final_snapshot": {"price": 112.0},
                    "final_portfolio": {"equity": 1.0096},
                },
                "reward": {"score": 0.00796},
                "metadata": {"event": "market_signal_episode"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "train",
                "--dataset",
                str(dataset_path),
                "--output-dir",
                str(tmp_path / "artifacts"),
            ],
        )

    assert result.exit_code == 0
    artifact_path = tmp_path / "artifacts" / "train.jsonl"
    example = json.loads(artifact_path.read_text(encoding="utf-8").strip())
    assert example["source_type"] == "episode"
    assert json.loads(example["completion"])["episode_reward"] == 0.00796


def test_rl_train_exports_slime_jsonl_signal_tasks(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_signal_0",
                "prompt": "Analyze NVDA with price_change_pct=2.5, news_sentiment=0.7, social_sentiment=0.4, macro_risk=0.2.",
                "task": {"symbol": "NVDA", "objective": "predict structured market action"},
                "features": {"symbol": "NVDA", "price_change_pct": 2.5},
                "label": {
                    "action": "buy",
                    "position_pct": 0.08,
                    "stop_loss_pct": 0.03,
                    "confidence": 0.8,
                    "score": 0.64,
                },
                "metadata": {"event": "market_signal_decision"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "train",
                "--dataset",
                str(dataset_path),
                "--adapter",
                "slime-jsonl",
                "--output-dir",
                str(tmp_path / "slime_export"),
            ],
        )

    assert result.exit_code == 0
    assert "Adapter: slime-jsonl" in result.stdout
    artifact_path = tmp_path / "slime_export" / "train.jsonl"
    manifest_path = tmp_path / "slime_export" / "manifest.json"
    assert artifact_path.exists()
    assert manifest_path.exists()
    record = json.loads(artifact_path.read_text(encoding="utf-8").strip())
    assert record["task"]["task_name"] == "market_signal::NVDA"
    assert record["task"]["data_source"] == "marketbot_market_signal"
    assert record["task"]["score"] == 0.64
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["inputKey"] == "task"
    assert manifest["rewardKey"] == "score"
    assert manifest["recommendedArgs"]["input_key"] == "task"
    assert manifest["recommendedArgs"]["reward_key"] == "score"
    assert manifest["recommendedArgs"]["prompt_data"] == str(artifact_path)
    assert manifest["recommendedArgs"]["custom_generate_function_path"] == "marketbot.rl.slime_generate.generate"


def test_rl_train_exports_slime_jsonl_episode_tasks(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_episode_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_episode_0",
                "prompt": "Trade NVDA over an offline episode with 3 prices and evaluate the structured action for reward optimization.",
                "task": {
                    "task_key": "market_signal_episode",
                    "symbol": "NVDA",
                    "prices": [100.0, 108.0, 112.0],
                    "requested_steps": 2,
                    "objective": "maximize episode reward",
                },
                "trajectory": {
                    "signal": {
                        "action": "buy",
                        "position_pct": 0.08,
                        "confidence": 0.8,
                        "score": 0.64,
                    }
                },
                "reward": {"score": 0.00796},
                "metadata": {"event": "market_signal_episode"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "train",
                "--dataset",
                str(dataset_path),
                "--adapter",
                "slime-jsonl",
                "--output-dir",
                str(tmp_path / "slime_episode_export"),
            ],
        )

    assert result.exit_code == 0
    artifact_path = tmp_path / "slime_episode_export" / "train.jsonl"
    record = json.loads(artifact_path.read_text(encoding="utf-8").strip())
    assert record["task"]["task_name"] == "market_episode::NVDA"
    assert record["task"]["task_type"] == "episode"
    assert record["task"]["score"] == 0.00796


def test_rl_train_can_emit_slime_script_template(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_signal_0",
                "prompt": "Analyze NVDA with price_change_pct=2.5, news_sentiment=0.7, social_sentiment=0.4, macro_risk=0.2.",
                "task": {"symbol": "NVDA", "objective": "predict structured market action"},
                "features": {"symbol": "NVDA", "price_change_pct": 2.5},
                "label": {
                    "action": "buy",
                    "position_pct": 0.08,
                    "stop_loss_pct": 0.03,
                    "confidence": 0.8,
                    "score": 0.64,
                },
                "metadata": {"event": "market_signal_decision"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "train",
                "--dataset",
                str(dataset_path),
                "--adapter",
                "slime-jsonl",
                "--output-dir",
                str(tmp_path / "slime_script_export"),
                "--emit-slime-script",
            ],
        )

    assert result.exit_code == 0
    assert "Script:" in result.stdout
    script_path = tmp_path / "slime_script_export" / "run_slime_train.sh"
    assert script_path.exists()
    script = script_path.read_text(encoding="utf-8")
    assert 'export ROLLOUT_PROMPT_DATA="' in script
    assert '--input-key "task"' in script
    assert '--reward-key "score"' in script


def test_rl_export_openclaw_emits_bundle(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text(
        json.dumps(
            {
                "id": "market_signal_0",
                "prompt": "Analyze NVDA with price_change_pct=2.5, news_sentiment=0.7, social_sentiment=0.4, macro_risk=0.2.",
                "task": {"symbol": "NVDA", "objective": "predict structured market action"},
                "features": {"symbol": "NVDA", "price_change_pct": 2.5},
                "label": {
                    "action": "buy",
                    "position_pct": 0.08,
                    "stop_loss_pct": 0.03,
                    "confidence": 0.8,
                    "score": 0.64,
                },
                "metadata": {"event": "market_signal_decision"},
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "export-openclaw",
                "--dataset",
                str(dataset_path),
                "--output-dir",
                str(tmp_path / "openclaw_export"),
            ],
        )

    assert result.exit_code == 0
    assert "OpenClaw Export" in result.stdout
    export_dir = tmp_path / "openclaw_export"
    assert (export_dir / "train.jsonl").exists()
    assert (export_dir / "manifest.json").exists()
    generate_path = export_dir / "generate.py"
    task_catalog_path = export_dir / "task_catalog.json"
    env_example_path = export_dir / "env.example"
    terminal_env_example_path = export_dir / "terminal_qwen3_8b.env.example"
    env_local_example_path = export_dir / "env.local.example"
    terminal_env_local_example_path = export_dir / "terminal_qwen3_8b.env.local.example"
    env_script_path = export_dir / "run_marketbot_env.sh"
    script_path = export_dir / "run_openclaw_train.sh"
    remote_script_path = export_dir / "run_openclaw_remote_env.sh"
    readme_path = export_dir / "README_OPENCLAW.md"
    assert generate_path.exists()
    assert task_catalog_path.exists()
    assert env_example_path.exists()
    assert terminal_env_example_path.exists()
    assert env_local_example_path.exists()
    assert terminal_env_local_example_path.exists()
    assert env_script_path.exists()
    assert script_path.exists()
    assert remote_script_path.exists()
    assert readme_path.exists()
    generate_source = generate_path.read_text(encoding="utf-8")
    assert 'MARKETBOT_ROOT = os.getenv("MARKETBOT_ROOT"' in generate_source
    assert "from marketbot.rl.slime_generate import generate" in generate_source
    task_catalog = json.loads(task_catalog_path.read_text(encoding="utf-8"))
    assert task_catalog["market_signal::NVDA"]["symbol"] == "NVDA"
    env_example = env_example_path.read_text(encoding="utf-8")
    assert 'export HF_CKPT="/path/to/model"' in env_example
    assert 'export ENV_SERVER_URL="http://${MARKETBOT_ENV_HOST}:${MARKETBOT_ENV_PORT}"' in env_example
    env_local_example = env_local_example_path.read_text(encoding="utf-8")
    assert 'Optional local-only overrides' in env_local_example
    terminal_env_example = terminal_env_example_path.read_text(encoding="utf-8")
    assert 'export NUM_GPUS="8"' in terminal_env_example
    assert 'export ROUTER_CONDA_ENV_PATH=""' in terminal_env_example
    assert 'export WORKER_URLS=""' in terminal_env_example
    terminal_env_local_example = terminal_env_local_example_path.read_text(encoding="utf-8")
    assert 'Optional local-only overrides' in terminal_env_local_example
    env_script = env_script_path.read_text(encoding="utf-8")
    assert 'ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/env.example}"' in env_script
    assert 'source "${ENV_FILE}"' in env_script
    assert 'ENV_LOCAL_FILE="${ENV_LOCAL_FILE:-' in env_script
    assert 'source "${ENV_LOCAL_FILE}"' in env_script
    assert 'TERMINAL_ENV_FILE="${TERMINAL_ENV_FILE:-' in env_script
    assert 'TERMINAL_ENV_LOCAL_FILE="${TERMINAL_ENV_LOCAL_FILE:-' in env_script
    assert 'python' in env_script
    assert 'marketbot.cli.commands rl serve-env' in env_script
    assert '--task-catalog "${TASK_CATALOG_PATH}"' in env_script
    script = script_path.read_text(encoding="utf-8")
    assert 'ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/env.example}"' in script
    assert 'source "${ENV_FILE}"' in script
    assert 'ENV_LOCAL_FILE="${ENV_LOCAL_FILE:-' in script
    assert 'TERMINAL_ENV_FILE="${TERMINAL_ENV_FILE:-' in script
    assert 'TERMINAL_ENV_LOCAL_FILE="${TERMINAL_ENV_LOCAL_FILE:-' in script
    assert 'export PYTHONPATH="${MARKETBOT_EXPORT_DIR}:${MARKETBOT_ROOT}:${PYTHONPATH:-}"' in script
    assert 'bash terminal-rl/terminal_qwen3_8b_rl.sh' in script
    remote_script = remote_script_path.read_text(encoding="utf-8")
    assert 'ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/env.example}"' in remote_script
    assert 'source "${ENV_FILE}"' in remote_script
    assert 'ENV_LOCAL_FILE="${ENV_LOCAL_FILE:-' in remote_script
    assert 'TERMINAL_ENV_FILE="${TERMINAL_ENV_FILE:-' in remote_script
    assert 'TERMINAL_ENV_LOCAL_FILE="${TERMINAL_ENV_LOCAL_FILE:-' in remote_script
    assert 'export ENV_SERVER_URL="${ENV_SERVER_URL:-http://${MARKETBOT_ENV_HOST}:${MARKETBOT_ENV_PORT}}"' in remote_script
    assert 'export START_ENV_POOL_SERVER="${START_ENV_POOL_SERVER:-0}"' in remote_script
    readme = readme_path.read_text(encoding="utf-8")
    assert "OPENCLAW_ROOT" in readme
    assert "generate.generate" in readme
    assert "terminal_qwen3_8b_rl.sh" in readme
    assert "run_marketbot_env.sh" in readme
    assert "run_openclaw_remote_env.sh" in readme
    assert "task_catalog.json" in readme
    assert "env.example" in readme
    assert "terminal_qwen3_8b.env.example" in readme
    assert "env.local.example" in readme
    assert "terminal_qwen3_8b.env.local.example" in readme
    assert f'cd "{export_dir}"' in readme


def test_rl_serve_env_bootstraps_server(tmp_path):
    class _DummyServer:
        def __init__(self, host, port, task_catalog, allow_dynamic_tasks):
            self.base_url = f"http://{host}:{port}"
            self.task_catalog = task_catalog
            self.allow_dynamic_tasks = allow_dynamic_tasks
            self.started = False
            self.stopped = False

        def serve_forever(self):
            self.started = True

        def shutdown(self):
            self.stopped = True

    dummy = _DummyServer("127.0.0.1", 19090, {}, True)
    task_catalog_path = tmp_path / "catalog.json"
    task_catalog_path.write_text(json.dumps({"seed_task": {"symbol": "SPY", "prices": [1.0, 1.1]}}), encoding="utf-8")

    with patch("marketbot.rl.env.server.MarketEnvHttpServer", return_value=dummy) as server_mock:
        result = runner.invoke(
            app,
            [
                "rl",
                "serve-env",
                "--host",
                "127.0.0.1",
                "--port",
                "19090",
                "--task-catalog",
                str(task_catalog_path),
            ],
        )

    assert result.exit_code == 0
    server_mock.assert_called_once()
    assert "RL Env Server" in result.stdout
    assert "Listening: http://127.0.0.1:19090" in result.stdout
    assert dummy.started is True
    assert dummy.stopped is True


def test_rl_launch_openclaw_dry_run_remote(tmp_path):
    class _FakeSummary:
        bundle_dir = str(tmp_path / "openclaw_bundle")
        script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_train.sh")
        remote_script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_remote_env.sh")
        env_script_path = str(tmp_path / "openclaw_bundle" / "run_marketbot_env.sh")
        adapter_summary = type("AdapterSummary", (), {"artifact_path": "artifact", "manifest_path": "manifest"})()

        def to_dict(self):
            return {
                "bundleDir": self.bundle_dir,
                "scriptPath": self.script_path,
                "remoteScriptPath": self.remote_script_path,
                "envScriptPath": self.env_script_path,
            }

    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text("{}\n", encoding="utf-8")

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.rl.trainer.openclaw_export.export_openclaw_bundle", return_value=_FakeSummary()) as export_mock:
        result = runner.invoke(
            app,
            [
                "rl",
                "launch-openclaw",
                "--dataset",
                str(dataset_path),
                "--remote-env",
            ],
        )

    assert result.exit_code == 0
    export_mock.assert_called_once()
    assert "OpenClaw Launch Plan" in result.stdout
    assert "Mode: remote-env" in result.stdout
    assert "Env Script:" in result.stdout
    assert "Health URL:" in result.stdout
    assert "Env Logs:" in result.stdout
    assert "Train Logs:" in result.stdout
    assert "Dry-run only: no processes were started." in result.stdout


def test_rl_launch_openclaw_runs_remote_sequence(tmp_path):
    class _FakeSummary:
        bundle_dir = str(tmp_path / "openclaw_bundle")
        script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_train.sh")
        remote_script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_remote_env.sh")
        env_script_path = str(tmp_path / "openclaw_bundle" / "run_marketbot_env.sh")
        adapter_summary = type("AdapterSummary", (), {"artifact_path": "artifact", "manifest_path": "manifest"})()

        def to_dict(self):
            return {
                "bundleDir": self.bundle_dir,
                "scriptPath": self.script_path,
                "remoteScriptPath": self.remote_script_path,
                "envScriptPath": self.env_script_path,
            }

    class _FakeProcess:
        def __init__(self):
            self.pid = 43210
            self.terminated = False
            self.waited = False

        def poll(self):
            return None if not self.terminated else 0

        def terminate(self):
            self.terminated = True

        def wait(self, timeout=None):
            self.waited = True
            return 0

    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text("{}\n", encoding="utf-8")
    fake_process = _FakeProcess()

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.rl.trainer.openclaw_export.export_openclaw_bundle", return_value=_FakeSummary()), \
         patch("subprocess.Popen", return_value=fake_process) as popen_mock, \
         patch("subprocess.run") as run_mock, \
         patch("marketbot.cli.commands._wait_for_http_health", return_value=True) as health_mock:
        result = runner.invoke(
            app,
            [
                "rl",
                "launch-openclaw",
                "--dataset",
                str(dataset_path),
                "--remote-env",
                "--no-dry-run",
                "--env-wait-s",
                "0",
            ],
        )

    assert result.exit_code == 0
    popen_mock.assert_called_once()
    run_mock.assert_called_once()
    health_mock.assert_called_once()
    _, popen_kwargs = popen_mock.call_args
    _, run_kwargs = run_mock.call_args
    assert popen_kwargs["stdout"].name.endswith("logs/env.stdout.log")
    assert popen_kwargs["stderr"].name.endswith("logs/env.stderr.log")
    assert run_kwargs["stdout"].name.endswith("logs/train.stdout.log")
    assert run_kwargs["stderr"].name.endswith("logs/train.stderr.log")
    assert fake_process.terminated is True
    assert fake_process.waited is True
    summary_path = tmp_path / "openclaw_bundle" / "run_summary.json"
    report_path = tmp_path / "openclaw_bundle" / "training_report.json"
    runs_index_path = tmp_path / "runs_index.jsonl"
    assert summary_path.exists()
    assert report_path.exists()
    assert runs_index_path.exists()
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    archive_dir = tmp_path / "reports" / summary_payload["completedAt"][:10].replace("-", "")
    archive_md = archive_dir / "summary.md"
    archive_csv = archive_dir / "summary.csv"
    latest_json = tmp_path / "reports" / "latest.json"
    assert archive_md.exists()
    assert archive_csv.exists()
    assert latest_json.exists()
    report_payload = json.loads(report_path.read_text(encoding="utf-8"))
    latest_payload = json.loads(latest_json.read_text(encoding="utf-8"))
    runs_index_lines = runs_index_path.read_text(encoding="utf-8").splitlines()
    assert len(runs_index_lines) == 1
    runs_index_entry = json.loads(runs_index_lines[0])
    assert summary_payload["status"] == "completed"
    assert summary_payload["runOutcome"] == "succeeded"
    assert summary_payload["failureReason"] is None
    assert summary_payload["exitCode"] == 0
    assert summary_payload["launchMode"] == "remote-env"
    assert summary_payload["envPid"] == 43210
    assert summary_payload["summaryPath"] == str(summary_path)
    assert report_payload["runSummary"]["status"] == "completed"
    assert report_payload["runSummary"]["runOutcome"] == "succeeded"
    assert report_payload["runSummary"]["envPid"] == 43210
    assert report_payload["files"]["trainingReport"] == str(report_path)
    assert report_payload["files"]["runsIndex"] == str(runs_index_path)
    assert report_payload["reportArchive"]["summaryMarkdown"] == str(archive_md)
    assert report_payload["reportArchive"]["summaryCsv"] == str(archive_csv)
    assert report_payload["reportArchive"]["latestJson"] == str(latest_json)
    assert latest_payload["summaryMarkdown"] == str(archive_md)
    assert latest_payload["summaryCsv"] == str(archive_csv)
    assert latest_payload["summary"]["successCount"] == 1
    assert latest_payload["compareSummary"]["field"] == "score"
    assert runs_index_entry["bundleDir"] == str(tmp_path / "openclaw_bundle")
    assert runs_index_entry["trainingReportPath"] == str(report_path)
    assert runs_index_entry["runOutcome"] == "succeeded"
    assert runs_index_entry["exitCode"] == 0
    assert "# OpenClaw Run Comparison" in archive_md.read_text(encoding="utf-8")
    assert "completedAt,runOutcome,failureReason,step,score,bundleDir,wandbUrl" in archive_csv.read_text(encoding="utf-8")
    assert "OpenClaw Launch" in result.stdout
    assert "Mode: remote-env" in result.stdout
    assert "Env PID: 43210" in result.stdout
    assert "Health URL:" in result.stdout
    assert "Env Logs:" in result.stdout
    assert "Train Logs:" in result.stdout
    assert "Summary:" in result.stdout
    assert "Training Report:" in result.stdout
    assert "Runs Index:" in result.stdout
    assert "Report Markdown:" in result.stdout
    assert "Report CSV:" in result.stdout
    assert "run_summary.json" in result.stdout
    assert "training_report.json" in result.stdout
    assert "runs_index.jsonl" in result.stdout
    assert "summary.md" in result.stdout
    assert "summary.csv" in result.stdout


def test_rl_launch_openclaw_reports_train_stderr_tail_on_failure(tmp_path):
    class _FakeSummary:
        bundle_dir = str(tmp_path / "openclaw_bundle")
        script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_train.sh")
        remote_script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_remote_env.sh")
        env_script_path = str(tmp_path / "openclaw_bundle" / "run_marketbot_env.sh")
        adapter_summary = type("AdapterSummary", (), {"artifact_path": "artifact", "manifest_path": "manifest"})()

        def to_dict(self):
            return {
                "bundleDir": self.bundle_dir,
                "scriptPath": self.script_path,
                "remoteScriptPath": self.remote_script_path,
                "envScriptPath": self.env_script_path,
            }

    class _FakeProcess:
        def __init__(self):
            self.pid = 43210
            self.terminated = False
            self.waited = False

        def poll(self):
            return None if not self.terminated else 0

        def terminate(self):
            self.terminated = True

        def wait(self, timeout=None):
            self.waited = True
            return 0

    def _failing_run(*args, **kwargs):
        stderr_handle = kwargs["stderr"]
        stderr_handle.write("trace line 1\ntrace line 2\nfatal training error\n")
        stderr_handle.flush()
        raise subprocess.CalledProcessError(returncode=1, cmd=args[0])

    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text("{}\n", encoding="utf-8")
    fake_process = _FakeProcess()

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.rl.trainer.openclaw_export.export_openclaw_bundle", return_value=_FakeSummary()), \
         patch("subprocess.Popen", return_value=fake_process), \
         patch("subprocess.run", side_effect=_failing_run), \
         patch("marketbot.cli.commands._wait_for_http_health", return_value=True):
        result = runner.invoke(
            app,
            [
                "rl",
                "launch-openclaw",
                "--dataset",
                str(dataset_path),
                "--remote-env",
                "--no-dry-run",
                "--env-wait-s",
                "0",
            ],
        )

    assert result.exit_code == 1
    summary_path = tmp_path / "openclaw_bundle" / "run_summary.json"
    report_path = tmp_path / "openclaw_bundle" / "training_report.json"
    runs_index_path = tmp_path / "runs_index.jsonl"
    assert summary_path.exists()
    assert report_path.exists()
    assert runs_index_path.exists()
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    archive_dir = tmp_path / "reports" / summary_payload["completedAt"][:10].replace("-", "")
    archive_md = archive_dir / "summary.md"
    archive_csv = archive_dir / "summary.csv"
    latest_json = tmp_path / "reports" / "latest.json"
    assert archive_md.exists()
    assert archive_csv.exists()
    assert latest_json.exists()
    report_payload = json.loads(report_path.read_text(encoding="utf-8"))
    runs_index_lines = runs_index_path.read_text(encoding="utf-8").splitlines()
    assert len(runs_index_lines) == 1
    runs_index_entry = json.loads(runs_index_lines[0])
    assert summary_payload["status"] == "failed"
    assert summary_payload["runOutcome"] == "failed"
    assert summary_payload["failureReason"] == "train_nonzero_exit"
    assert summary_payload["exitCode"] == 1
    assert summary_payload["launchMode"] == "remote-env"
    assert "returned non-zero exit status 1" in summary_payload["error"]
    assert summary_payload["logTail"]["trainStderr"].endswith("fatal training error")
    assert report_payload["runSummary"]["status"] == "failed"
    assert report_payload["runSummary"]["runOutcome"] == "failed"
    assert report_payload["logTail"]["trainStderr"].endswith("fatal training error")
    assert report_payload["files"]["runsIndex"] == str(runs_index_path)
    assert report_payload["reportArchive"]["summaryMarkdown"] == str(archive_md)
    assert report_payload["reportArchive"]["summaryCsv"] == str(archive_csv)
    assert report_payload["reportArchive"]["latestJson"] == str(latest_json)
    assert runs_index_entry["runOutcome"] == "failed"
    assert runs_index_entry["failureReason"] == "train_nonzero_exit"
    assert runs_index_entry["exitCode"] == 1
    assert "bundleDir" in archive_csv.read_text(encoding="utf-8")
    assert "OpenClaw Launch Failed" in result.stdout
    assert "Training Report:" in result.stdout
    assert "Runs Index:" in result.stdout
    assert "Report Markdown:" in result.stdout
    assert "Report CSV:" in result.stdout
    assert "Train stderr tail:" in result.stdout
    assert "fatal training error" in result.stdout


def test_rl_launch_openclaw_classifies_env_unhealthy(tmp_path):
    class _FakeSummary:
        bundle_dir = str(tmp_path / "openclaw_bundle")
        script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_train.sh")
        remote_script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_remote_env.sh")
        env_script_path = str(tmp_path / "openclaw_bundle" / "run_marketbot_env.sh")
        adapter_summary = type("AdapterSummary", (), {"artifact_path": "artifact", "manifest_path": "manifest"})()

        def to_dict(self):
            return {
                "bundleDir": self.bundle_dir,
                "scriptPath": self.script_path,
                "remoteScriptPath": self.remote_script_path,
                "envScriptPath": self.env_script_path,
            }

    class _FakeProcess:
        def __init__(self):
            self.pid = 43210
            self.terminated = False
            self.waited = False

        def poll(self):
            return None if not self.terminated else 0

        def terminate(self):
            self.terminated = True

        def wait(self, timeout=None):
            self.waited = True
            return 0

    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    dataset_path = tmp_path / "rl" / "datasets" / "market_signal_dataset.jsonl"
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_text("{}\n", encoding="utf-8")
    fake_process = _FakeProcess()

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.rl.trainer.openclaw_export.export_openclaw_bundle", return_value=_FakeSummary()), \
         patch("subprocess.Popen", return_value=fake_process) as popen_mock, \
         patch("subprocess.run") as run_mock, \
         patch("marketbot.cli.commands._wait_for_http_health", return_value=False):
        result = runner.invoke(
            app,
            [
                "rl",
                "launch-openclaw",
                "--dataset",
                str(dataset_path),
                "--remote-env",
                "--no-dry-run",
                "--env-wait-s",
                "0",
            ],
        )

    assert result.exit_code == 1
    popen_mock.assert_called_once()
    run_mock.assert_not_called()
    assert fake_process.terminated is True
    assert fake_process.waited is True
    summary_path = tmp_path / "openclaw_bundle" / "run_summary.json"
    report_path = tmp_path / "openclaw_bundle" / "training_report.json"
    runs_index_path = tmp_path / "runs_index.jsonl"
    assert summary_path.exists()
    assert report_path.exists()
    assert runs_index_path.exists()
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    report_payload = json.loads(report_path.read_text(encoding="utf-8"))
    runs_index_entry = json.loads(runs_index_path.read_text(encoding="utf-8").splitlines()[0])
    assert summary_payload["status"] == "failed"
    assert summary_payload["runOutcome"] == "env_unhealthy"
    assert summary_payload["failureReason"] == "env_unhealthy"
    assert summary_payload["exitCode"] == 1
    assert report_payload["runSummary"]["runOutcome"] == "env_unhealthy"
    assert runs_index_entry["runOutcome"] == "env_unhealthy"
    assert runs_index_entry["failureReason"] == "env_unhealthy"
    assert "Env server did not become healthy" in result.stdout
    assert "OpenClaw Launch Failed" in result.stdout


def test_rl_inspect_openclaw_run_summarizes_bundle(tmp_path):
    bundle_dir = tmp_path / "openclaw_bundle"
    logs_dir = bundle_dir / "logs"
    ckpt_dir = tmp_path / "checkpoints" / "marketbot-run"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (ckpt_dir / "global_step123").mkdir(parents=True, exist_ok=True)
    (ckpt_dir / "latest.pt").write_text("checkpoint", encoding="utf-8")
    (bundle_dir / "manifest.json").write_text("{}", encoding="utf-8")
    (bundle_dir / "train.jsonl").write_text("{}\n", encoding="utf-8")
    (bundle_dir / "run_summary.json").write_text(
        json.dumps(
            {
                "status": "completed",
                "runOutcome": "succeeded",
                "launchMode": "remote-env",
                "completedAt": "2026-03-13T10:00:00Z",
                "summaryPath": str(bundle_dir / "run_summary.json"),
            }
        ),
        encoding="utf-8",
    )
    (bundle_dir / "env.example").write_text(
        '\n'.join(
            [
                f'export SAVE_CKPT="{tmp_path / "unused"}"',
                'export ENV_SERVER_URL="http://127.0.0.1:18080"',
            ]
        ),
        encoding="utf-8",
    )
    (bundle_dir / "env.local").write_text(f'export SAVE_CKPT="{ckpt_dir}"\n', encoding="utf-8")
    (bundle_dir / "terminal_qwen3_8b.env.example").write_text('export NUM_GPUS="8"\n', encoding="utf-8")
    (bundle_dir / "terminal_qwen3_8b.env.local").write_text('export ACTOR_GPUS="2"\nexport ROLLOUT_GPUS="2"\n', encoding="utf-8")
    (logs_dir / "train.stdout.log").write_text(
        "step=120 score=0.72 loss=0.14 lr=1e-06\n"
        "wandb: https://wandb.ai/demo/project/runs/run-abc123\n"
        "step=123 score=0.75 loss=0.12 lr=9e-07\n"
        "training finished\n",
        encoding="utf-8",
    )
    (logs_dir / "train.stderr.log").write_text("warn1\nwarn2\n", encoding="utf-8")
    (logs_dir / "env.stdout.log").write_text("env up\n", encoding="utf-8")
    (logs_dir / "env.stderr.log").write_text("", encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "rl",
            "inspect-openclaw-run",
            "--bundle-dir",
            str(bundle_dir),
            "--json",
        ],
    )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["bundleDir"] == str(bundle_dir)
    assert payload["files"]["runSummary"] == str(bundle_dir / "run_summary.json")
    assert payload["files"]["trainingReport"] == str(bundle_dir / "training_report.json")
    assert payload["files"]["runsIndex"] == str(tmp_path / "runs_index.jsonl")
    assert payload["checkpoint"]["path"] == str(ckpt_dir)
    assert payload["checkpoint"]["exists"] is True
    assert payload["checkpoint"]["fileCount"] == 1
    assert payload["checkpoint"]["latestStep"] == 123
    assert payload["resolvedEnv"]["envServerUrl"] == "http://127.0.0.1:18080"
    assert payload["runSummary"]["status"] == "completed"
    assert payload["runSummary"]["runOutcome"] == "succeeded"
    assert payload["runSummary"]["launchMode"] == "remote-env"
    assert payload["training"]["wandbUrl"] == "https://wandb.ai/demo/project/runs/run-abc123"
    assert payload["training"]["wandbRunId"] == "run-abc123"
    assert payload["training"]["latestMetrics"]["step"] == 123
    assert payload["training"]["latestMetrics"]["score"] == 0.75
    assert payload["training"]["latestMetrics"]["loss"] == 0.12
    assert payload["logTail"]["trainStderr"].endswith("warn1\nwarn2")
    assert payload["logTail"]["trainStdout"].endswith("step=123 score=0.75 loss=0.12 lr=9e-07\ntraining finished")


def test_rl_list_openclaw_runs_returns_sorted_json(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "rl" / "training" / "runs_index.jsonl"
    runs_index_path.parent.mkdir(parents=True, exist_ok=True)
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-old"),
                        "runOutcome": "failed",
                        "failureReason": "train_nonzero_exit",
                        "completedAt": "2026-03-13T09:00:00Z",
                        "checkpointLatestStep": 90,
                        "latestMetrics": {"step": 90, "score": 0.61},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-new"),
                        "runOutcome": "succeeded",
                        "failureReason": None,
                        "completedAt": "2026-03-13T10:00:00Z",
                        "checkpointLatestStep": 123,
                        "latestMetrics": {"step": 123, "score": 0.75},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "list-openclaw-runs", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["indexPath"] == str(runs_index_path)
    assert payload["count"] == 2
    assert payload["totalCount"] == 2
    assert payload["filteredCount"] == 2
    assert payload["compareField"] == "score"
    assert payload["compareSummary"]["field"] == "score"
    assert payload["compareSummary"]["count"] == 2
    assert payload["compareSummary"]["best"]["bundleDir"] == str(tmp_path / "bundle-new")
    assert payload["compareSummary"]["best"]["value"] == 0.75
    assert payload["compareSummary"]["worst"]["bundleDir"] == str(tmp_path / "bundle-old")
    assert payload["runs"][0]["bundleDir"] == str(tmp_path / "bundle-new")
    assert payload["runs"][0]["runOutcome"] == "succeeded"
    assert payload["runs"][1]["bundleDir"] == str(tmp_path / "bundle-old")


def test_rl_list_openclaw_runs_filters_by_outcome(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"step": 123, "score": 0.75},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "env_unhealthy",
                        "failureReason": "env_unhealthy",
                        "completedAt": "2026-03-13T11:00:00Z",
                        "latestMetrics": {"step": 0, "score": 0.0},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "list-openclaw-runs",
                "--index-path",
                str(runs_index_path),
                "--outcome",
                "env_unhealthy",
                "--json",
            ],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["indexPath"] == str(runs_index_path)
    assert payload["outcome"] == "env_unhealthy"
    assert payload["count"] == 1
    assert payload["filteredCount"] == 1
    assert payload["runs"][0]["bundleDir"] == str(tmp_path / "bundle-b")
    assert payload["runs"][0]["runOutcome"] == "env_unhealthy"


def test_rl_list_openclaw_runs_compares_loss_with_lower_is_better(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "rl" / "training" / "runs_index.jsonl"
    runs_index_path.parent.mkdir(parents=True, exist_ok=True)
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-high-loss"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T09:00:00Z",
                        "latestMetrics": {"step": 90, "loss": 0.31},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-low-loss"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"step": 120, "loss": 0.12},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "list-openclaw-runs",
                "--compare-field",
                "loss",
                "--json",
            ],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["compareField"] == "loss"
    assert payload["compareSummary"]["field"] == "loss"
    assert payload["compareSummary"]["best"]["bundleDir"] == str(tmp_path / "bundle-low-loss")
    assert payload["compareSummary"]["best"]["value"] == 0.12
    assert payload["compareSummary"]["worst"]["bundleDir"] == str(tmp_path / "bundle-high-loss")
    assert payload["compareSummary"]["worst"]["value"] == 0.31


def test_rl_list_openclaw_runs_summary_only_returns_group_stats(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "rl" / "training" / "runs_index.jsonl"
    runs_index_path.parent.mkdir(parents=True, exist_ok=True)
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"score": 0.80},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "failed",
                        "completedAt": "2026-03-13T09:00:00Z",
                        "latestMetrics": {"score": 0.30},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            ["rl", "list-openclaw-runs", "--summary-only", "--group-by", "outcome", "--json"],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["runs"] == []
    assert payload["summary"]["count"] == 2
    assert payload["summary"]["successCount"] == 1
    assert payload["summary"]["successRate"] == 0.5
    assert payload["groupBy"] == "outcome"
    assert len(payload["groupedSummary"]) == 2
    grouped = {item["group"]: item for item in payload["groupedSummary"]}
    assert grouped["succeeded"]["count"] == 1
    assert grouped["succeeded"]["successRate"] == 1.0
    assert grouped["failed"]["count"] == 1
    assert grouped["failed"]["successRate"] == 0.0


def test_rl_list_openclaw_runs_grouped_text_output(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"score": 0.80},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "env_unhealthy",
                        "completedAt": "2026-03-13T11:00:00Z",
                        "latestMetrics": {"score": 0.10},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "list-openclaw-runs",
                "--index-path",
                str(runs_index_path),
                "--group-by",
                "outcome",
                "--summary-only",
            ],
        )

    assert result.exit_code == 0
    assert "OpenClaw Runs" in result.stdout
    assert "Group By: outcome" in result.stdout
    assert "Compare Summary:" in result.stdout
    assert "succeeded" in result.stdout
    assert "env_unhealthy" in result.stdout


def test_rl_compare_openclaw_runs_returns_json_payload(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "rl" / "training" / "runs_index.jsonl"
    runs_index_path.parent.mkdir(parents=True, exist_ok=True)
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"score": 0.80, "step": 120},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "failed",
                        "failureReason": "train_nonzero_exit",
                        "completedAt": "2026-03-13T09:00:00Z",
                        "latestMetrics": {"score": 0.20, "step": 90},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "compare-openclaw-runs", "--format", "json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["indexPath"] == str(runs_index_path)
    assert payload["compareField"] == "score"
    assert payload["summary"]["successRate"] == 0.5
    assert payload["groupBy"] == "outcome"
    assert payload["compareSummary"]["best"]["bundleDir"] == str(tmp_path / "bundle-a")
    assert payload["runs"][0]["bundleDir"] == str(tmp_path / "bundle-a")


def test_rl_compare_openclaw_runs_writes_markdown_report(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"score": 0.80, "step": 120},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "env_unhealthy",
                        "failureReason": "env_unhealthy",
                        "completedAt": "2026-03-13T11:00:00Z",
                        "latestMetrics": {"score": 0.10, "step": 0},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    output_path = tmp_path / "reports" / "openclaw_comparison.md"

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "compare-openclaw-runs",
                "--index-path",
                str(runs_index_path),
                "--output-path",
                str(output_path),
            ],
        )

    assert result.exit_code == 0
    assert output_path.exists()
    report = output_path.read_text(encoding="utf-8")
    assert "# OpenClaw Run Comparison" in report
    assert "## Grouped Summary" in report
    assert "bundle-a" in report
    assert "bundle-b" in report
    assert "OpenClaw Run Comparison" in result.stdout
    assert "Format: markdown" in result.stdout
    assert "Output:" in result.stdout
    assert "openclaw_comparison.md" in result.stdout


def test_rl_latest_openclaw_report_returns_latest_json(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_old = tmp_path / "rl" / "training" / "reports" / "20260312"
    reports_new = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_old.mkdir(parents=True, exist_ok=True)
    reports_new.mkdir(parents=True, exist_ok=True)
    (reports_old / "summary.md").write_text("# old\n", encoding="utf-8")
    (reports_new / "summary.md").write_text("# new\n", encoding="utf-8")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "latest-openclaw-report", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["format"] == "markdown"
    assert payload["date"] == "20260313"
    assert payload["path"] == str(reports_new / "summary.md")
    assert payload["content"] is None


def test_rl_latest_openclaw_report_prefers_latest_index(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_old = tmp_path / "rl" / "training" / "reports" / "20260312"
    reports_new = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_old.mkdir(parents=True, exist_ok=True)
    reports_new.mkdir(parents=True, exist_ok=True)
    (reports_old / "summary.md").write_text("# old\n", encoding="utf-8")
    (reports_new / "summary.md").write_text("# new\n", encoding="utf-8")
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260312",
                "summaryMarkdown": str(reports_old / "summary.md"),
                "summaryCsv": str(reports_old / "summary.csv"),
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "latest-openclaw-report", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["date"] == "20260312"
    assert payload["path"] == str(reports_old / "summary.md")


def test_rl_latest_openclaw_report_json_print_content_returns_preview(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "summary.md").write_text(
        "# OpenClaw Run Comparison\n\n## Summary\n\n- Success Count: 3\n- Success Rate: 75.00%\n\n## Runs\n\nline1\nline2\nline3\n",
        encoding="utf-8",
    )
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "summary": {"successCount": 3, "successRate": 0.75},
                "compareSummary": {"field": "score", "avg": 0.81},
                "groupedSummary": [{"group": "succeeded", "count": 3}],
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            ["rl", "latest-openclaw-report", "--json", "--print-content"],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["summary"]["successCount"] == 3
    assert payload["compareSummary"]["avg"] == 0.81
    assert payload["groupedSummary"][0]["group"] == "succeeded"
    assert payload["content"] is None
    assert payload["contentLineCount"] == 12
    assert "# OpenClaw Run Comparison" in payload["contentPreview"]
    assert "Success Rate: 75.00%" in payload["contentPreview"]


def test_rl_latest_openclaw_report_prints_csv_content(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    reports_dir = tmp_path / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "summary.csv").write_text("a,b\n1,2\n", encoding="utf-8")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "latest-openclaw-report",
                "--index-path",
                str(runs_index_path),
                "--format",
                "csv",
                "--print-content",
            ],
        )

    assert result.exit_code == 0
    assert "Latest OpenClaw Report" in result.stdout
    assert "Format: csv" in result.stdout
    assert "20260313" in result.stdout
    assert "summary.csv" in result.stdout
    assert "a,b" in result.stdout
    assert "1,2" in result.stdout


def test_rl_latest_openclaw_metrics_returns_latest_index_summary(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "reportsDir": str(reports_dir),
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "compareField": "score",
                "groupBy": "outcome",
                "totalCount": 4,
                "filteredCount": 4,
                "summary": {"successCount": 3, "successRate": 0.75},
                "compareSummary": {"field": "score", "count": 4, "avg": 0.81, "min": 0.2, "max": 0.94},
                "groupedSummary": [{"group": "succeeded", "count": 3, "successRate": 1.0}],
                "generatedAt": "2026-03-13T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["rl", "latest-openclaw-metrics", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["date"] == "20260313"
    assert payload["successCount"] == 3
    assert payload["successRate"] == 0.75
    assert payload["compareField"] == "score"
    assert payload["compareSummary"]["avg"] == 0.81
    assert payload["groupedSummary"][0]["group"] == "succeeded"


def test_rl_latest_openclaw_metrics_falls_back_to_runs_index(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    runs_index_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-a"),
                        "runOutcome": "succeeded",
                        "completedAt": "2026-03-13T10:00:00Z",
                        "latestMetrics": {"score": 0.80, "step": 120},
                    }
                ),
                json.dumps(
                    {
                        "bundleDir": str(tmp_path / "bundle-b"),
                        "runOutcome": "failed",
                        "failureReason": "train_nonzero_exit",
                        "completedAt": "2026-03-13T09:00:00Z",
                        "latestMetrics": {"score": 0.20, "step": 90},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            ["rl", "latest-openclaw-metrics", "--index-path", str(runs_index_path), "--json"],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["indexPath"] == str(runs_index_path)
    assert payload["compareField"] == "score"
    assert payload["totalCount"] == 2
    assert payload["successCount"] == 1
    assert payload["successRate"] == 0.5
    assert payload["compareSummary"]["best"]["bundleDir"] == str(tmp_path / "bundle-a")


def test_rl_latest_openclaw_metrics_thresholds_pass(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "reportsDir": str(reports_dir),
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "compareField": "score",
                "groupBy": "outcome",
                "totalCount": 4,
                "filteredCount": 4,
                "summary": {"successCount": 3, "successRate": 0.75},
                "compareSummary": {
                    "field": "score",
                    "count": 4,
                    "avg": 0.81,
                    "min": 0.2,
                    "max": 0.94,
                    "best": {"value": 0.94},
                    "worst": {"value": 0.2},
                },
                "groupedSummary": [{"group": "succeeded", "count": 3, "successRate": 1.0}],
                "generatedAt": "2026-03-13T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "latest-openclaw-metrics",
                "--min-success-rate",
                "0.7",
                "--min-avg",
                "0.8",
                "--min-best",
                "0.9",
                "--max-worst",
                "0.3",
                "--json",
            ],
        )

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["ok"] is True
    assert payload["thresholdChecks"]["minSuccessRate"]["passed"] is True
    assert payload["thresholdChecks"]["minAvg"]["passed"] is True
    assert payload["thresholdChecks"]["minBest"]["passed"] is True
    assert payload["thresholdChecks"]["maxWorst"]["passed"] is True


def test_rl_latest_openclaw_metrics_thresholds_fail_with_exit_1(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "reportsDir": str(reports_dir),
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "compareField": "score",
                "groupBy": "outcome",
                "totalCount": 4,
                "filteredCount": 4,
                "summary": {"successCount": 2, "successRate": 0.5},
                "compareSummary": {
                    "field": "score",
                    "count": 4,
                    "avg": 0.41,
                    "min": 0.1,
                    "max": 0.7,
                    "best": {"value": 0.7},
                    "worst": {"value": 0.55},
                },
                "groupedSummary": [{"group": "succeeded", "count": 2, "successRate": 1.0}],
                "generatedAt": "2026-03-13T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "rl",
                "latest-openclaw-metrics",
                "--min-success-rate",
                "0.7",
                "--min-avg",
                "0.8",
                "--max-worst",
                "0.3",
                "--json",
            ],
        )

    assert result.exit_code == 1
    payload = json.loads(result.stdout)
    assert payload["ok"] is False
    assert payload["thresholdChecks"]["minSuccessRate"]["passed"] is False
    assert payload["thresholdChecks"]["minAvg"]["passed"] is False
    assert payload["thresholdChecks"]["maxWorst"]["passed"] is False


def test_rl_latest_openclaw_metrics_persists_alert_lifecycle_state(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_root = tmp_path / "rl" / "training" / "reports"
    reports_dir = reports_root / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    latest_path = reports_root / "latest.json"

    failing_payload = {
        "date": "20260313",
        "reportsDir": str(reports_dir),
        "summaryMarkdown": str(reports_dir / "summary.md"),
        "summaryCsv": str(reports_dir / "summary.csv"),
        "compareField": "score",
        "groupBy": "outcome",
        "totalCount": 4,
        "filteredCount": 4,
        "summary": {"successCount": 2, "successRate": 0.5},
        "compareSummary": {
            "field": "score",
            "count": 4,
            "avg": 0.41,
            "min": 0.1,
            "max": 0.7,
            "best": {"value": 0.7},
            "worst": {"value": 0.55},
        },
        "generatedAt": "2026-03-13T12:00:00Z",
    }
    latest_path.write_text(json.dumps(failing_payload), encoding="utf-8")

    with patch("marketbot.config.loader.load_config", return_value=config):
        first = runner.invoke(
            app,
            ["rl", "latest-openclaw-metrics", "--min-success-rate", "0.7", "--json"],
        )

    assert first.exit_code == 1
    first_payload = json.loads(first.stdout)
    assert first_payload["alertsState"]["alerts"][0]["alertState"] == "new"
    assert first_payload["alertsState"]["alerts"][0]["occurrenceCount"] == 1
    assert first_payload["alertsState"]["stateCounts"]["new"] == 1
    state_path = reports_root / "alerts_state.json"
    assert first_payload["alertsStatePath"] == str(state_path)
    assert state_path.exists()
    assert first_payload["alertsState"]["recentHistory"][-1]["alertState"] == "new"

    with patch("marketbot.config.loader.load_config", return_value=config):
        second = runner.invoke(
            app,
            ["rl", "latest-openclaw-metrics", "--min-success-rate", "0.7", "--json"],
        )

    assert second.exit_code == 1
    second_payload = json.loads(second.stdout)
    assert second_payload["alertsState"]["alerts"][0]["alertState"] == "ongoing"
    assert second_payload["alertsState"]["alerts"][0]["occurrenceCount"] == 2
    assert second_payload["alertsState"]["stateCounts"]["ongoing"] == 1
    assert second_payload["alertsState"]["recentHistory"][-1]["alertState"] == "ongoing"

    passing_payload = {
        **failing_payload,
        "summary": {"successCount": 3, "successRate": 0.75},
        "compareSummary": {
            "field": "score",
            "count": 4,
            "avg": 0.81,
            "min": 0.2,
            "max": 0.94,
            "best": {"value": 0.94},
            "worst": {"value": 0.2},
        },
        "generatedAt": "2026-03-13T12:05:00Z",
    }
    latest_path.write_text(json.dumps(passing_payload), encoding="utf-8")

    with patch("marketbot.config.loader.load_config", return_value=config):
        third = runner.invoke(
            app,
            ["rl", "latest-openclaw-metrics", "--min-success-rate", "0.7", "--json"],
        )

    assert third.exit_code == 0
    third_payload = json.loads(third.stdout)
    assert third_payload["alertsState"]["resolved"] is True
    assert third_payload["alertsState"]["resolvedAlertCount"] == 1
    assert third_payload["alertsState"]["resolvedAlerts"][0]["alertState"] == "resolved"
    assert third_payload["alertsState"]["resolvedAlerts"][0]["endsAt"] == "2026-03-13T12:05:00Z"
    assert third_payload["alertsState"]["resolvedAlerts"][0]["occurrenceCount"] == 2
    assert third_payload["alertsState"]["historyLimit"] == 20
    assert [item["alertState"] for item in third_payload["alertsState"]["recentHistory"][-3:]] == [
        "new",
        "ongoing",
        "resolved",
    ]


def test_rl_latest_openclaw_metrics_emits_github_output(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "reportsDir": str(reports_dir),
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "compareField": "score",
                "groupBy": "outcome",
                "totalCount": 4,
                "filteredCount": 4,
                "summary": {"successCount": 3, "successRate": 0.75},
                "compareSummary": {
                    "field": "score",
                    "count": 4,
                    "avg": 0.81,
                    "min": 0.2,
                    "max": 0.94,
                    "best": {"value": 0.94},
                    "worst": {"value": 0.2},
                },
                "generatedAt": "2026-03-13T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )
    github_output_path = tmp_path / "github_output.txt"

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch.dict("os.environ", {"GITHUB_OUTPUT": str(github_output_path)}, clear=False):
        result = runner.invoke(app, ["rl", "latest-openclaw-metrics", "--emit-github-output"])

    assert result.exit_code == 0
    output_text = github_output_path.read_text(encoding="utf-8")
    assert "openclaw_ok=true" in output_text
    assert "openclaw_date=20260313" in output_text
    assert "openclaw_success_rate=0.75" in output_text
    assert "openclaw_compare_avg=0.81" in output_text


def test_rl_latest_openclaw_metrics_emits_prometheus_and_fails_threshold(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    reports_dir = tmp_path / "rl" / "training" / "reports" / "20260313"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (tmp_path / "rl" / "training" / "reports" / "latest.json").write_text(
        json.dumps(
            {
                "date": "20260313",
                "reportsDir": str(reports_dir),
                "summaryMarkdown": str(reports_dir / "summary.md"),
                "summaryCsv": str(reports_dir / "summary.csv"),
                "compareField": "score",
                "groupBy": "outcome",
                "totalCount": 4,
                "filteredCount": 4,
                "summary": {"successCount": 2, "successRate": 0.5},
                "compareSummary": {
                    "field": "score",
                    "count": 4,
                    "avg": 0.41,
                    "min": 0.1,
                    "max": 0.7,
                    "best": {"value": 0.7},
                    "worst": {"value": 0.55},
                },
                "generatedAt": "2026-03-13T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            ["rl", "latest-openclaw-metrics", "--emit-prometheus", "--min-success-rate", "0.7"],
        )

    assert result.exit_code == 1
    assert "marketbot_openclaw_success_rate 0.5" in result.stdout
    assert "marketbot_openclaw_threshold_ok 0" in result.stdout


def test_build_openclaw_alerts_payload_collects_failed_checks():
    payload = {
        "ok": False,
        "date": "20260313",
        "generatedAt": "2026-03-13T12:00:00Z",
        "compareField": "score",
        "summaryMarkdown": "/tmp/summary.md",
        "summaryCsv": "/tmp/summary.csv",
        "thresholdChecks": {
            "minSuccessRate": {"enabled": True, "threshold": 0.7, "actual": 0.5, "passed": False},
            "minAvg": {"enabled": True, "threshold": 0.8, "actual": 0.81, "passed": True},
            "maxWorst": {"enabled": True, "threshold": 0.3, "actual": 0.55, "passed": False},
        },
    }

    alerts = _build_openclaw_alerts_payload(payload)

    assert alerts["ok"] is False
    assert alerts["resolved"] is False
    assert alerts["resolvedAt"] is None
    assert alerts["activeAlertCount"] == 2
    assert alerts["failedChecks"][0]["name"] == "minSuccessRate"
    assert alerts["failedChecks"][0]["severity"] == "critical"
    assert len(alerts["failedChecks"][0]["fingerprint"]) == 16
    assert alerts["failedChecks"][1]["name"] == "maxWorst"
    assert alerts["failedChecks"][1]["severity"] == "critical"
    assert alerts["alerts"][0]["labels"]["severity"] == "critical"
    assert alerts["alerts"][0]["labels"]["alertname"] == "MarketBotOpenClawminSuccessRate"
    assert alerts["alerts"][0]["fingerprint"] == alerts["failedChecks"][0]["fingerprint"]
    assert alerts["alerts"][0]["endsAt"] is None


def test_build_openclaw_alerts_payload_uses_stable_fingerprint_across_dates():
    payload_a = {
        "ok": False,
        "date": "20260313",
        "generatedAt": "2026-03-13T12:00:00Z",
        "compareField": "score",
        "summaryMarkdown": "/tmp/summary.md",
        "summaryCsv": "/tmp/summary.csv",
        "thresholdChecks": {
            "minSuccessRate": {"enabled": True, "threshold": 0.7, "actual": 0.5, "passed": False}
        },
    }
    payload_b = {
        **payload_a,
        "date": "20260314",
        "generatedAt": "2026-03-14T12:00:00Z",
    }

    alerts_a = _build_openclaw_alerts_payload(payload_a)
    alerts_b = _build_openclaw_alerts_payload(payload_b)

    assert alerts_a["failedChecks"][0]["fingerprint"] == alerts_b["failedChecks"][0]["fingerprint"]
    assert alerts_a["alerts"][0]["fingerprint"] == alerts_b["alerts"][0]["fingerprint"]


def test_render_openclaw_alertmanager_payload_uses_alerts():
    alerts_payload = {
        "ok": False,
        "date": "20260313",
        "compareField": "score",
        "summaryMarkdown": "/tmp/summary.md",
        "summaryCsv": "/tmp/summary.csv",
        "alerts": [
            {
                "status": "firing",
                "labels": {"alertname": "MarketBotOpenClawminSuccessRate", "severity": "critical"},
                "annotations": {"summary": "minSuccessRate threshold failed"},
                "generatorURL": "/tmp/summary.md",
                "startsAt": "2026-03-13T12:00:00Z",
            }
        ],
    }

    payload = _render_openclaw_alertmanager_payload(alerts_payload)

    assert payload["status"] == "firing"
    assert payload["resolved"] is False
    assert payload["receiver"] == "marketbot-openclaw"
    assert payload["alerts"][0]["labels"]["alertname"] == "MarketBotOpenClawminSuccessRate"
    assert payload["commonLabels"]["compare_field"] == "score"
    assert payload["groupKey"] == "marketbot:openclaw:score"


def test_build_openclaw_alerts_payload_marks_resolved_when_ok():
    payload = {
        "ok": True,
        "date": "20260313",
        "generatedAt": "2026-03-13T12:00:00Z",
        "compareField": "score",
        "summaryMarkdown": "/tmp/summary.md",
        "summaryCsv": "/tmp/summary.csv",
        "thresholdChecks": {
            "minSuccessRate": {"enabled": True, "threshold": 0.7, "actual": 0.8, "passed": True},
        },
    }

    alerts = _build_openclaw_alerts_payload(payload)
    alertmanager = _render_openclaw_alertmanager_payload(alerts)

    assert alerts["ok"] is True
    assert alerts["resolved"] is True
    assert alerts["resolvedAt"] == "2026-03-13T12:00:00Z"
    assert alerts["status"] == "resolved"
    assert alerts["activeAlertCount"] == 0
    assert alerts["alerts"] == []
    assert alertmanager["status"] == "resolved"


def test_render_openclaw_alertmanager_payload_uses_resolved_alerts_when_present():
    alerts_payload = {
        "ok": True,
        "resolved": True,
        "resolvedAt": "2026-03-13T12:05:00Z",
        "date": "20260313",
        "compareField": "score",
        "summaryMarkdown": "/tmp/summary.md",
        "summaryCsv": "/tmp/summary.csv",
        "alerts": [],
        "resolvedAlerts": [
            {
                "status": "resolved",
                "fingerprint": "abc123",
                "labels": {"alertname": "MarketBotOpenClawminSuccessRate", "severity": "critical"},
                "annotations": {"summary": "minSuccessRate threshold failed"},
                "startsAt": "2026-03-13T12:00:00Z",
                "endsAt": "2026-03-13T12:05:00Z",
            }
        ],
    }

    payload = _render_openclaw_alertmanager_payload(alerts_payload)

    assert payload["status"] == "resolved"
    assert payload["alerts"][0]["status"] == "resolved"
    assert payload["alerts"][0]["endsAt"] == "2026-03-13T12:05:00Z"
    assert payload["resolved"] is True
    assert payload["resolvedAt"] == "2026-03-13T12:05:00Z"


def test_rl_serve_metrics_bootstraps_http_server(tmp_path):
    class _DummyServer:
        def __init__(self, host, port, metrics_payload_factory, metrics_renderer, alerts_builder, alertmanager_renderer):
            self.host = host
            self.port = port
            self.metrics_payload_factory = metrics_payload_factory
            self.metrics_renderer = metrics_renderer
            self.alerts_builder = alerts_builder
            self.alertmanager_renderer = alertmanager_renderer
            self.base_url = f"http://{host}:{port}"
            self.started = False
            self.closed = False

        def serve_forever(self):
            self.started = True

        def shutdown(self):
            return None

        def server_close(self):
            self.closed = True

    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    runs_index_path = tmp_path / "custom_runs_index.jsonl"
    runs_index_path.write_text("{}\n", encoding="utf-8")
    dummy_server = _DummyServer("127.0.0.1", 19101, None, None, None, None)

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch("marketbot.rl.metrics_server.MetricsHttpServer", return_value=dummy_server) as server_mock:
        result = runner.invoke(
            app,
            [
                "rl",
                "serve-metrics",
                "--host",
                "127.0.0.1",
                "--port",
                "19101",
                "--index-path",
                str(runs_index_path),
                "--min-success-rate",
                "0.7",
            ],
        )

    assert result.exit_code == 0
    server_mock.assert_called_once()
    assert server_mock.call_args.kwargs["host"] == "127.0.0.1"
    assert server_mock.call_args.kwargs["port"] == 19101
    assert "OpenClaw Metrics Server" in result.stdout
    assert "Listening: http://127.0.0.1:19101" in result.stdout
    assert "Metrics: http://127.0.0.1:19101/metrics" in result.stdout
    assert "Summary: http://127.0.0.1:19101/summary.json" in result.stdout
    assert "Alerts: http://127.0.0.1:19101/alerts" in result.stdout
    assert "Alertmanager: http://127.0.0.1:19101/alerts/prometheus" in result.stdout
    assert dummy_server.started is True
    assert dummy_server.closed is True


def test_skills_search_prefers_local_matches(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch.object(SkillsLoader, "search_local_skills", return_value=[{"name": "market-report", "source": "builtin", "description": "Produce structured single-asset market analysis"}]), \
         patch.object(SkillsLoader, "search_external_skills", return_value=[]):
        result = runner.invoke(app, ["skills", "search", "market analysis"])

    assert result.exit_code == 0
    assert "Local Skills" in result.stdout
    assert "market-report" in result.stdout
    assert "External Skill Suggestions" not in result.stdout


def test_skills_search_falls_back_to_external_catalog(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch.object(SkillsLoader, "search_local_skills", return_value=[]), \
         patch.object(
             SkillsLoader,
             "search_external_skills",
             return_value=[
                 {
                     "name": "k8s-release",
                     "category": "DevOps",
                     "description": "Deploy Kubernetes apps with Helm and ArgoCD.",
                     "url": "https://github.com/openclaw/skills/tree/main/skills/k8s-release",
                 }
             ],
         ):
        result = runner.invoke(app, ["skills", "search", "kubernetes deployment"])

    assert result.exit_code == 0
    assert "External Skill Suggestions" in result.stdout
    assert "k8s-release" in result.stdout
    assert "marketbot skills install k8s-release" in result.stdout


def test_skills_install_installs_to_workspace(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    installed_path = tmp_path / "skills" / "daily-stock-screener"

    with patch("marketbot.config.loader.load_config", return_value=config), \
         patch.object(SkillsLoader, "install_external_skill", return_value=installed_path) as install_mock:
        result = runner.invoke(app, ["skills", "install", "daily-stock-screener"])

    assert result.exit_code == 0
    install_mock.assert_called_once_with("daily-stock-screener", force=False)
    assert "Installed skill to" in result.stdout
    assert "Start a new agent session" in result.stdout


def test_skills_score_show_renders_workspace_buckets(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    score_path = tmp_path / "data" / "skill_scores.json"
    score_path.parent.mkdir(parents=True, exist_ok=True)
    score_path.write_text(
        json.dumps(
            {
                "version": 1,
                "buckets": {
                    "xueqiu-research|us|browser-research|browser_site": {
                        "score": 0.4,
                        "successCount": 3,
                        "failureCount": 1,
                        "lastUsedAt": "2026-03-29T10:00:00Z",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["skills", "score", "show", "--json"])

    assert result.exit_code == 0
    assert '"skill": "xueqiu-research"' in result.stdout
    assert '"task_type": "browser-research"' in result.stdout


def test_skills_score_reset_removes_matching_skill_buckets(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    score_path = tmp_path / "data" / "skill_scores.json"
    score_path.parent.mkdir(parents=True, exist_ok=True)
    score_path.write_text(
        json.dumps(
            {
                "version": 1,
                "buckets": {
                    "xueqiu-research|us|browser-research|browser_site": {"score": 0.4},
                    "market-report|us|analysis|market_brief": {"score": 0.2},
                },
            }
        ),
        encoding="utf-8",
    )

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["skills", "score", "reset", "--skill", "xueqiu-research"])

    assert result.exit_code == 0
    assert "Reset 1 buckets for skill `xueqiu-research`." in result.stdout
    payload = json.loads(score_path.read_text(encoding="utf-8"))
    assert "xueqiu-research|us|browser-research|browser_site" not in payload["buckets"]
    assert "market-report|us|analysis|market_brief" in payload["buckets"]


def test_status_shows_browser_disabled_by_default(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.get_config_path", return_value=tmp_path / "config.json"), patch(
        "marketbot.config.loader.load_config", return_value=config
    ):
        result = runner.invoke(app, ["status"])

    assert result.exit_code == 0
    assert "Browser: disabled" in result.stdout


def test_status_shows_browser_safety_configuration(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.tools.browser.enabled = True
    config.tools.browser.command = "bb-browser"
    config.tools.browser.mode = "sensitive"
    config.tools.browser.allow_eval = True
    config.tools.browser.allow_request_capture = True
    config.tools.browser.allow_request_bodies = False
    config.tools.browser.allow_sites = ["xueqiu", "reddit"]
    config.tools.browser.allow_adapters = ["xueqiu/hot-stock"]
    config.tools.browser.allow_domains = ["xueqiu.com", "reddit.com"]
    config.tools.browser.allow_url_prefixes = ["https://www.youtube.com/watch?v="]

    with patch("marketbot.config.loader.get_config_path", return_value=tmp_path / "config.json"), patch(
        "marketbot.config.loader.load_config", return_value=config
    ), patch("marketbot.cli.commands.shutil.which", return_value="/usr/local/bin/bb-browser"):
        result = runner.invoke(app, ["status"])

    assert result.exit_code == 0
    assert "Browser: ✓" in result.stdout
    assert "Browser mode: sensitive" in result.stdout
    assert "Browser eval: enabled" in result.stdout
    assert "Browser request capture: enabled" in result.stdout
    assert "Browser request bodies: disabled" in result.stdout
    assert "Browser allowSites: xueqiu, reddit" in result.stdout
    assert "Browser allowAdapters: xueqiu/hot-stock" in result.stdout
    assert "Browser allowDomains: xueqiu.com, reddit.com" in result.stdout
    assert "Browser allowUrlPrefixes: https://www.youtube.com/watch?v=" in result.stdout


def test_status_json_includes_browser_defaults(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)

    with patch("marketbot.config.loader.get_config_path", return_value=tmp_path / "config.json"), patch(
        "marketbot.config.loader.load_config", return_value=config
    ):
        result = runner.invoke(app, ["status", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["config"]["path"].endswith("config.json")
    assert payload["workspace"]["path"] == str(tmp_path)
    assert payload["browser"]["enabled"] is False
    assert payload["browser"]["allowEval"] is False
    assert payload["browser"]["allowRequestCapture"] is False
    assert payload["browser"]["allowRequestBodies"] is False


def test_status_json_includes_browser_and_provider_state(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.tools.browser.enabled = True
    config.tools.browser.mode = "sensitive"
    config.tools.browser.command = "bb-browser"
    config.tools.browser.allow_eval = True
    config.tools.browser.allow_request_capture = True
    config.tools.browser.allow_request_bodies = True
    config.tools.browser.allow_sites = ["reddit"]
    config.tools.browser.allow_domains = ["reddit.com"]
    config.providers.openrouter.api_key = "sk-test"

    with patch("marketbot.config.loader.get_config_path", return_value=tmp_path / "config.json"), patch(
        "marketbot.config.loader.load_config", return_value=config
    ), patch("marketbot.cli.commands.shutil.which", return_value="/usr/local/bin/bb-browser"):
        result = runner.invoke(app, ["status", "--json"])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["browser"]["enabled"] is True
    assert payload["browser"]["mode"] == "sensitive"
    assert payload["browser"]["commandFound"] is True
    assert payload["browser"]["allowEval"] is True
    assert payload["browser"]["allowRequestCapture"] is True
    assert payload["browser"]["allowRequestBodies"] is True
    assert payload["browser"]["allowSites"] == ["reddit"]
    assert payload["browser"]["allowDomains"] == ["reddit.com"]
    assert any(item["name"] == "openrouter" and item["configured"] is True for item in payload["providers"])


def test_format_browser_runtime_summary_disabled():
    config = Config()

    summary = _format_browser_runtime_summary(config)

    assert summary == "Browser: disabled"


def test_format_browser_runtime_summary_enabled():
    config = Config()
    config.tools.browser.enabled = True
    config.tools.browser.mode = "sensitive"
    config.tools.browser.command = "bb-browser"
    config.tools.browser.allow_eval = True
    config.tools.browser.allow_request_capture = True
    config.tools.browser.allow_request_bodies = False
    config.tools.browser.allow_sites = ["reddit", "github"]
    config.tools.browser.allow_domains = ["reddit.com"]

    with patch("marketbot.cli.commands.shutil.which", return_value="/usr/local/bin/bb-browser"):
        summary = _format_browser_runtime_summary(config)

    assert "Browser: mode=sensitive" in summary
    assert "command=bb-browser" in summary
    assert "command_found=yes" in summary
    assert "eval=on" in summary
    assert "request_capture=on" in summary
    assert "request_bodies=off" in summary
    assert "sites=2" in summary
    assert "domains=1" in summary

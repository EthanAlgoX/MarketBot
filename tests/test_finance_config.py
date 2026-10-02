import json
import sys
from types import SimpleNamespace

from typer.testing import CliRunner

from marketbot.cli.commands import app
from marketbot.config.finance import (
    ensure_finance_defaults,
    mcp_configuration_status,
    prepare_mcp_servers,
)
from marketbot.config.loader import load_config, save_config
from marketbot.config.schema import Config, MCPServerConfig


def test_default_finance_mcp_uses_installed_interpreter_and_active_market_config(tmp_path):
    config = Config()
    config.agents.defaults.workspace = str(tmp_path)
    config.tools.market.quote_source = "eastmoney"
    config.tools.market.default_symbols = ["600519"]
    config.tools.market.tavily_api_key = "private-test-key"

    servers = prepare_mcp_servers(config)

    assert servers["finance"].enabled is True
    assert servers["finance"].command == sys.executable
    assert servers["finance"].args == ["-m", "marketbot.mcp.finance", "--workspace", str(tmp_path)]
    data = json.loads(servers["finance"].env["MARKETBOT_FINANCE_CONFIG"])
    assert data["quoteSource"] == "eastmoney"
    assert data["defaultSymbols"] == ["600519"]
    assert data["tavilyApiKey"] == "private-test-key"
    assert config.tools.mcp_servers["finance"].command == "python"
    assert config.tools.mcp_servers["finance"].env == {}
    assert servers["alphavantage"].enabled is False


def test_finance_disabled_respects_both_market_and_server_opt_outs():
    config = Config()
    config.tools.market.enabled = False
    assert prepare_mcp_servers(config)["finance"].enabled is False
    config.tools.market.enabled = True
    config.tools.mcp_servers["finance"].enabled = False
    assert prepare_mcp_servers(config)["finance"].enabled is False


def test_explicit_bundled_server_config_remains_authoritative(tmp_path):
    config = Config()
    server = config.tools.mcp_servers["finance"]
    server.args.extend(["--config", str(tmp_path / "other-config.json")])
    prepared = prepare_mcp_servers(config)["finance"]
    assert prepared.args == server.args
    assert "MARKETBOT_FINANCE_CONFIG" not in prepared.env


def test_adding_finance_presets_preserves_existing_server_values():
    config = Config(
        tools={
            "mcpServers": {
                "finance": {"enabled": False, "command": "custom-finance", "toolTimeout": 15}
            }
        }
    )
    added = ensure_finance_defaults(config)
    assert added == ["alphavantage"]
    assert config.tools.mcp_servers["finance"].enabled is False
    assert config.tools.mcp_servers["finance"].command == "custom-finance"
    assert config.tools.mcp_servers["finance"].tool_timeout == 15
    assert ensure_finance_defaults(config) == []


def test_status_shows_missing_env_without_credentials(monkeypatch):
    monkeypatch.delenv("ALPHA_VANTAGE_API_KEY", raising=False)
    config = Config()
    config.tools.market.tavily_api_key = "must-not-be-shown"
    config.tools.mcp_servers["alphavantage"].enabled = True
    rows = mcp_configuration_status(config)
    alpha = next(row for row in rows if row["name"] == "alphavantage")
    assert alpha["state"] == "missing_environment"
    assert alpha["missingEnv"] == ["ALPHA_VANTAGE_API_KEY"]
    assert "must-not-be-shown" not in json.dumps(rows)


def test_status_checks_environment_backed_command_without_exposing_path(monkeypatch):
    monkeypatch.setenv("FINANCE_MCP_PYTHON", sys.executable)
    config = Config(tools={"mcpServers": {"custom": {"command": "${FINANCE_MCP_PYTHON}"}}})
    rows = mcp_configuration_status(config)
    assert rows[0]["state"] == "configured"
    assert rows[0]["commandFound"] is True
    assert sys.executable not in json.dumps(rows)


def test_onboard_relative_workspace_is_resolved_before_persistence(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    path = tmp_path / "config.json"
    result = CliRunner().invoke(app, ["onboard", "--config", str(path), "--workspace", "research"])
    assert result.exit_code == 0, result.output
    assert load_config(path).workspace_path == tmp_path / "research"


def test_onboard_refresh_upgrades_legacy_config_in_its_configured_workspace(tmp_path):
    workspace = tmp_path / "my-workspace"
    workspace.mkdir()
    (workspace / "SOUL.md").write_text("Custom financial assistant", encoding="utf-8")
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "agents": {"defaults": {"workspace": str(workspace), "model": "custom-model"}},
                "providers": {"custom": {"apiKey": "keep-my-key"}},
                "tools": {
                    "market": {"quoteSource": "eastmoney"},
                    "mcpServers": {"custom": {"command": "my-mcp"}},
                },
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(app, ["onboard", "--refresh", "--config", str(config_path)])

    assert result.exit_code == 0, result.output
    config = load_config(config_path)
    assert config.agents.defaults.model == "custom-model"
    assert config.providers.custom.api_key == "keep-my-key"
    assert config.tools.market.quote_source == "eastmoney"
    assert config.tools.mcp_servers["custom"].command == "my-mcp"
    assert set(config.tools.mcp_servers) == {"custom", "finance", "alphavantage"}
    assert (workspace / "SOUL.md").read_text() == "Custom financial assistant"
    assert (workspace / "AGENTS.md").exists()


def test_onboard_custom_workspace_is_saved_and_invalid_refresh_preserves_file(tmp_path):
    config_path = tmp_path / "config.json"
    workspace = tmp_path / "custom-workspace"
    result = CliRunner().invoke(
        app, ["onboard", "--config", str(config_path), "--workspace", str(workspace)]
    )
    assert result.exit_code == 0, result.output
    assert load_config(config_path).workspace_path == workspace
    assert "financial research" in (workspace / "SOUL.md").read_text().lower()

    config_path.write_text("{broken", encoding="utf-8")
    result = CliRunner().invoke(app, ["onboard", "--refresh", "--config", str(config_path)])
    assert result.exit_code == 1
    assert "existing file was preserved" in result.output
    assert config_path.read_text() == "{broken"


def test_mcp_allowlist_and_opt_out_survive_config_roundtrip(tmp_path):
    config = Config()
    config.tools.mcp_servers["finance"] = MCPServerConfig(
        enabled=False, enabled_tools=["market_source_plan"]
    )
    path = tmp_path / "config.json"
    save_config(config, path)
    loaded = load_config(path)
    assert loaded.tools.mcp_servers["finance"].enabled is False
    assert loaded.tools.mcp_servers["finance"].enabled_tools == ["market_source_plan"]


def test_legacy_long_mcp_timeout_keeps_provider_settings(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps(
            {
                "providers": {"custom": {"apiKey": "keep-key"}},
                "tools": {"mcpServers": {"research": {"command": "research", "toolTimeout": 900}}},
            }
        ),
        encoding="utf-8",
    )
    config = load_config(path, strict=True)
    assert config.providers.custom.api_key == "keep-key"
    assert config.tools.mcp_servers["research"].tool_timeout == 900


def test_status_and_agent_consume_the_onboarded_custom_config(tmp_path, monkeypatch):
    from loguru import logger

    import marketbot.cli.commands as commands

    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "research")
    config.agents.defaults.model = "my-finance-model"
    config.tools.market.quote_source = "eastmoney"
    path = tmp_path / "config.json"
    save_config(config, path)

    status = CliRunner().invoke(app, ["status", "--config", str(path), "--json"])
    assert status.exit_code == 0, status.output
    payload = json.loads(status.output)
    assert payload["agent"]["model"] == "my-finance-model"
    assert payload["finance"]["quoteSource"] == "eastmoney"

    captured = {}

    def build_runtime(loaded, **kwargs):
        captured["config"] = loaded
        captured["cron_path"] = kwargs["cron_store_path"]
        return SimpleNamespace(bus=None, agent_loop=object())

    async def once(**kwargs):
        captured["message"] = kwargs["message"]

    monkeypatch.setattr(commands, "build_agent_runtime", build_runtime)
    monkeypatch.setattr(commands, "run_agent_once", once)
    monkeypatch.setattr(logger, "disable", lambda namespace: None)
    result = CliRunner().invoke(app, ["agent", "--config", str(path), "-m", "研究 NVDA"])
    assert result.exit_code == 0, result.output
    assert captured["config"].agents.defaults.model == "my-finance-model"
    assert captured["cron_path"] == config.workspace_path / "cron" / "jobs.json"
    assert captured["message"] == "研究 NVDA"

"""Invocation language, persistence, and stable diagnostic contracts."""

import asyncio
import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from typer.testing import CliRunner

import marketbot.cli.commands as commands
from marketbot.config.loader import configuration_scope, get_language, load_config, save_config
from marketbot.config.schema import Config
from marketbot.i18n import Language, localized, msg


@pytest.fixture
def cli_settings(tmp_path, monkeypatch):
    home = tmp_path / "isolated-home"
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    workspace = tmp_path / "workspace"
    config_path = tmp_path / "config.json"
    config = Config()
    config.agents.defaults.workspace = str(workspace)
    config.agents.defaults.language = "zh"
    config.providers.custom.api_key = "private-provider-key"
    save_config(config, config_path)
    return CliRunner(), config_path, workspace, home


def test_legacy_configuration_and_language_helpers_default_to_english(tmp_path):
    path = tmp_path / "legacy.json"
    path.write_text('{"agents":{"defaults":{"model":"kept-model"}}}')
    assert load_config(path).agents.defaults.language == "en"
    assert get_language() == "en"
    assert msg("English", "中文") == "English"
    assert localized("English", "中文", Language.zh) == "中文"
    with pytest.raises(ValidationError):
        Config.model_validate({"agents": {"defaults": {"language": "fr"}}})


def test_language_flag_overrides_config_without_mutation_or_invocation_leak(cli_settings):
    runner, path, workspace, home = cli_settings
    original = path.read_bytes()
    overridden = runner.invoke(commands.app, ["--config", str(path), "--language", "en", "status", "--json"])
    assert overridden.exit_code == 0, overridden.exception
    assert json.loads(overridden.stdout)["agent"]["language"] == "en"
    configured = runner.invoke(commands.app, ["--config", str(path), "status", "--json"])
    assert configured.exit_code == 0, configured.exception
    assert json.loads(configured.stdout)["agent"]["language"] == "zh"
    assert path.read_bytes() == original
    assert get_language() == "en"
    assert not workspace.exists()
    assert not home.exists()


def test_language_set_only_saves_requested_language_and_preserves_settings(cli_settings, tmp_path):
    runner, path, workspace, home = cli_settings
    temporary_workspace = tmp_path / "temporary-workspace"
    result = runner.invoke(commands.app, ["--config", str(path), "--workspace", str(temporary_workspace), "--language", "zh", "language", "--set", "en", "--json"])
    assert result.exit_code == 0, result.exception
    assert json.loads(result.stdout) == {"language": "zh", "configuredLanguage": "en", "configPath": str(path), "saved": True}
    persisted = load_config(path)
    assert persisted.agents.defaults.language == "en"
    assert persisted.workspace_path == workspace
    assert persisted.providers.custom.api_key == "private-provider-key"
    assert "private-provider-key" not in result.stdout
    query = runner.invoke(commands.app, ["--config", str(path), "language"])
    assert query.exit_code == 0
    assert "Language: English (en)" in query.stdout
    assert not home.exists()
    assert not temporary_workspace.exists()


def test_language_set_can_initialize_explicit_configuration_without_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path / "home"))
    path = tmp_path / "nested" / "new.json"
    result = CliRunner().invoke(commands.app, ["--config", str(path), "language", "--set", "zh"])
    assert result.exit_code == 0, result.exception
    assert "已将语言保存到" in result.stdout
    assert load_config(path).agents.defaults.language == "zh"
    assert not (tmp_path / "home").exists()


@pytest.mark.parametrize("language", ["en", "zh"])
def test_onboard_language_is_saved_and_refresh_preserves_user_templates(tmp_path, monkeypatch, language):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path / "home"))
    path, workspace = tmp_path / "settings.json", tmp_path / "workspace"
    args = ["--config", str(path), "--workspace", str(workspace), "--language", language, "onboard"]
    runner = CliRunner()
    result = runner.invoke(commands.app, args)
    assert result.exit_code == 0, result.exception
    assert load_config(path).agents.defaults.language == language
    assert ("marketbot is ready" if language == "en" else "marketbot 已就绪") in result.stdout
    assert ("Analyze NVDA" if language == "en" else "分析 NVDA") in result.stdout
    template = workspace / "AGENTS.md"
    template.write_text("USER OWNED TEMPLATE")
    refreshed = runner.invoke(commands.app, [*args, "--refresh"])
    assert refreshed.exit_code == 0, refreshed.exception
    assert template.read_text() == "USER OWNED TEMPLATE"


def test_language_query_does_not_create_default_configuration(tmp_path, monkeypatch):
    home = tmp_path / "home"
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    result = CliRunner().invoke(commands.app, ["language", "--json"])
    assert result.exit_code == 0, result.exception
    payload = json.loads(result.stdout)
    assert payload["language"] == payload["configuredLanguage"] == "en"
    assert payload["saved"] is False
    assert not home.exists()


def test_status_and_channels_localize_human_output_and_keep_json_keys(cli_settings):
    runner, path, _workspace, _home = cli_settings
    status = runner.invoke(commands.app, ["--config", str(path), "status"])
    assert status.exit_code == 0, status.exception
    assert "marketbot 状态" in status.stdout
    assert "工作区:" in status.stdout
    assert "金融工具:" in status.stdout
    channels = runner.invoke(commands.app, ["--config", str(path), "channels", "status"])
    assert channels.exit_code == 0
    assert "渠道状态" in channels.stdout
    assert "未配置" in channels.stdout
    english = runner.invoke(commands.app, ["--config", str(path), "--language", "en", "channels", "status"])
    assert english.exit_code == 0
    assert "Channel Status" in english.stdout
    for language in ("en", "zh"):
        result = runner.invoke(commands.app, ["--config", str(path), "--language", language, "channels", "status", "--json"])
        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert payload["language"] == language
        assert set(payload["channels"][0]) == {"name", "enabled", "configuration"}
        assert payload["channels"][0]["name"] == "whatsapp"


def test_language_flags_validate_and_reset_after_failure_without_changing_help(cli_settings):
    runner, path, _workspace, home = cli_settings
    invalid = runner.invoke(commands.app, ["--config", str(path), "--language", "fr", "status"])
    assert invalid.exit_code == 2
    failed = runner.invoke(commands.app, ["--config", str(path.parent / "missing.json"), "--language", "zh", "status"])
    assert failed.exit_code == 2
    assert get_language() == "en"
    help_result = runner.invoke(commands.app, ["--config", str(path), "--language", "zh", "--help"])
    assert help_result.exit_code == 0
    assert "Financial Research Agent" in help_result.stdout
    assert not home.exists()


async def test_language_scopes_are_independent_across_async_tasks_and_nested_scopes(cli_settings):
    _runner, path, _workspace, _home = cli_settings

    async def worker(language):
        with configuration_scope(path, language=language):
            await asyncio.sleep(0)
            assert load_config().agents.defaults.language == language
            assert get_language(load_config(apply_overrides=False)) == language
            with configuration_scope(path, language="zh" if language == "en" else "en"):
                await asyncio.sleep(0)
            assert get_language() == language
            return language

    assert await asyncio.gather(worker("en"), worker("zh")) == ["en", "zh"]
    assert get_language() == "en"

import json
import traceback

import pytest

from marketbot.config.loader import load_config


def test_load_config_migrates_legacy_top_level_market_keys(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "providers": {
                    "custom": {
                        "apiKey": "provider-key",
                    }
                },
                "tavily_api_key": "legacy-tavily",
            }
        ),
        encoding="utf-8",
    )

    config = load_config(config_path)

    assert config.providers.custom.api_key == "provider-key"
    assert config.tools.market.tavily_api_key == "legacy-tavily"


def test_load_config_migrates_legacy_market_key_without_overwriting_nested_value(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "tools": {
                    "market": {
                        "tavilyApiKey": "nested-tavily",
                    }
                },
                "tavily_api_key": "legacy-tavily",
            }
        ),
        encoding="utf-8",
    )

    config = load_config(config_path)

    assert config.tools.market.tavily_api_key == "nested-tavily"


def test_load_config_reads_xiaohongshu_cli_tool_settings(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "tools": {
                    "xiaohongshuCli": {
                        "enabled": True,
                        "command": "/usr/local/bin/xhs",
                        "timeoutS": 90,
                        "cookieSource": "chrome",
                        "homeDir": "/tmp/xhs-home",
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    config = load_config(config_path)

    assert config.tools.xiaohongshu_cli.enabled is True
    assert config.tools.xiaohongshu_cli.command == "/usr/local/bin/xhs"
    assert config.tools.xiaohongshu_cli.timeout_s == 90
    assert config.tools.xiaohongshu_cli.cookie_source == "chrome"
    assert config.tools.xiaohongshu_cli.home_dir == "/tmp/xhs-home"


def test_load_config_reads_lark_cli_tool_settings(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "tools": {
                    "larkCli": {
                        "enabled": True,
                        "command": "/usr/local/bin/lark-cli",
                        "timeoutS": 75,
                        "configDir": "/tmp/lark-cli-home",
                        "allowWrite": True,
                        "allowAuth": False,
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    config = load_config(config_path)

    assert config.tools.lark_cli.enabled is True
    assert config.tools.lark_cli.command == "/usr/local/bin/lark-cli"
    assert config.tools.lark_cli.timeout_s == 75
    assert config.tools.lark_cli.config_dir == "/tmp/lark-cli-home"
    assert config.tools.lark_cli.allow_write is True
    assert config.tools.lark_cli.allow_auth is False


def test_load_config_reads_twitter_cli_tool_settings(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "tools": {
                    "twitterCli": {
                        "enabled": True,
                        "command": "/usr/local/bin/twitter",
                        "timeoutS": 60,
                        "browser": "chrome",
                        "chromeProfile": "Profile 2",
                        "proxy": "socks5://127.0.0.1:1080",
                        "homeDir": "/tmp/twitter-home",
                        "allowWrite": True,
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    config = load_config(config_path)

    assert config.tools.twitter_cli.enabled is True
    assert config.tools.twitter_cli.command == "/usr/local/bin/twitter"
    assert config.tools.twitter_cli.timeout_s == 60
    assert config.tools.twitter_cli.browser == "chrome"
    assert config.tools.twitter_cli.chrome_profile == "Profile 2"
    assert config.tools.twitter_cli.proxy == "socks5://127.0.0.1:1080"
    assert config.tools.twitter_cli.home_dir == "/tmp/twitter-home"
    assert config.tools.twitter_cli.allow_write is True


@pytest.mark.parametrize("strict", [False, True])
def test_invalid_configuration_diagnostics_never_echo_secrets(tmp_path, capsys, strict):
    path = tmp_path / "config.json"
    original = json.dumps({"agents": {"defaults": {"maxTokens": "never-print-this"}}, "providers": {"custom": {"apiKey": {"nested": "private-token"}}}})
    path.write_text(original)
    if strict:
        with pytest.raises(ValueError) as captured:
            load_config(path, strict=True)
        diagnostic = "".join(traceback.format_exception(captured.value))
        assert captured.value.__cause__ is None
        assert captured.value.__suppress_context__
    else:
        load_config(path)
        diagnostic = capsys.readouterr().out
    assert "maxTokens" in diagnostic
    assert "int_parsing" in diagnostic
    assert "never-print-this" not in diagnostic
    assert "private-token" not in diagnostic
    assert "input_value" not in diagnostic
    assert path.read_text() == original


def test_dynamic_config_entry_names_are_anonymized_in_diagnostics(tmp_path, capsys):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"tools": {"mcpServers": {"never-print-this": {"env": {"another-secret": {"bad": "secret-value"}}}}}}))
    load_config(path)
    diagnostic = capsys.readouterr().out
    assert "tools.mcpServers.[entry].env.[entry]" in diagnostic
    assert "never-print-this" not in diagnostic
    assert "another-secret" not in diagnostic
    assert "secret-value" not in diagnostic


@pytest.mark.parametrize("data", [[], {"tools": []}, {"tools": {"market": []}}, {"tools": {"exec": []}}])
def test_wrong_configuration_shapes_produce_safe_validation_error(tmp_path, data):
    path = tmp_path / "config.json"
    original = json.dumps(data)
    path.write_text(original)
    with pytest.raises(ValueError, match="existing file was preserved"):
        load_config(path, strict=True)
    assert path.read_text() == original

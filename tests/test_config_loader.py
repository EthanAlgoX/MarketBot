import json

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

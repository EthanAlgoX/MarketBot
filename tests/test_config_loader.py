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

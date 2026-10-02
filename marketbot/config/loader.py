"""Configuration loading utilities."""

import json
from pathlib import Path

from pydantic import ValidationError

from marketbot.config.schema import Config


def get_config_path() -> Path:
    """Get the default configuration file path."""
    return Path.home() / ".marketbot" / "config.json"


def get_data_dir() -> Path:
    """Get the marketbot data directory."""
    from marketbot.utils.helpers import get_data_path
    return get_data_path()


def load_config(config_path: Path | None = None, *, strict: bool = False) -> Config:
    """
    Load configuration from file or create default.

    Args:
        config_path: Optional path to config file. Uses default if not provided.

    Returns:
        Loaded configuration object.
    """
    path = config_path or get_config_path()

    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("Configuration root must be an object")
            data = _migrate_config(data)
            return Config.model_validate(data)
        except (json.JSONDecodeError, ValueError) as e:
            diagnostic = _safe_diagnostic(e)
            if strict:
                raise ValueError(f"Invalid configuration at {path}; existing file was preserved ({diagnostic})") from None
            print(f"Warning: Invalid configuration at {path}; existing file was preserved ({diagnostic})")
            print("Using default configuration.")

    return Config()


def _safe_diagnostic(error: ValueError) -> str:
    """Report field paths and error types without input values or exception text."""
    if isinstance(error, json.JSONDecodeError):
        return f"json: invalid_json at line {error.lineno}, column {error.colno}"
    if isinstance(error, ValidationError):
        issues = []
        for item in error.errors(include_url=False, include_input=False, include_context=False)[:10]:
            parts = []
            for part in item.get("loc", ()):
                if parts and parts[-1] in {"mcpServers", "mcp_servers", "headers", "env", "extraHeaders", "extra_headers", "modelParams", "model_params"}:
                    parts.append("[entry]")
                elif isinstance(part, int):
                    parts.append(f"[{part}]")
                else:
                    parts.append(str(part))
            issues.append(f"{'.'.join(parts) or 'root'}: {item.get('type', 'invalid_value')}")
        return "; ".join(issues) or "root: invalid_configuration"
    return "root: invalid_configuration"


def save_config(config: Config, config_path: Path | None = None) -> None:
    """
    Save configuration to file.

    Args:
        config: Configuration to save.
        config_path: Optional path to save to. Uses default if not provided.
    """
    path = config_path or get_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    data = config.model_dump(by_alias=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _migrate_config(data: dict) -> dict:
    """Migrate old config formats to current."""
    # Move tools.exec.restrictToWorkspace → tools.restrictToWorkspace
    tools = data.get("tools", {})
    if not isinstance(tools, dict):
        return data
    exec_cfg = tools.get("exec", {})
    if isinstance(exec_cfg, dict) and "restrictToWorkspace" in exec_cfg and "restrictToWorkspace" not in tools:
        tools["restrictToWorkspace"] = exec_cfg.pop("restrictToWorkspace")

    # Move legacy top-level market search keys into tools.market.
    market_cfg = tools.get("market", {})
    if not isinstance(market_cfg, dict):
        return data
    for legacy_key in ("tavily_api_key", "bocha_api_key", "brave_api_key", "serpapi_api_key", "fred_api_key"):
        legacy_value = data.pop(legacy_key, None)
        if legacy_value and legacy_key not in market_cfg:
            market_cfg[legacy_key] = legacy_value
    if market_cfg:
        tools["market"] = market_cfg
    if tools:
        data["tools"] = tools
    return data

import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
import typer

from marketbot.cli.auth_runtime import get_bridge_dir, run_channels_login, run_provider_login


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="") -> None:
        self.lines.append(str(text))


def test_run_provider_login_rejects_unknown_provider() -> None:
    console = _Console()
    providers = [SimpleNamespace(name="openai_codex", label="OpenAI Codex", is_oauth=True)]

    with pytest.raises(typer.Exit):
        run_provider_login(
            provider="missing",
            providers=providers,
            login_handlers={},
            console=console,
            logo="marketbot",
        )

    assert any("Unknown OAuth provider" in line for line in console.lines)


def test_run_channels_login_passes_bridge_token(monkeypatch, tmp_path) -> None:
    console = _Console()
    calls = []
    config = SimpleNamespace(
        channels=SimpleNamespace(
            whatsapp=SimpleNamespace(bridge_token="bridge-secret")
        )
    )

    def _fake_run(cmd, cwd=None, check=None, env=None):
        calls.append((cmd, cwd, check, env))
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr("marketbot.cli.auth_runtime.subprocess.run", _fake_run)

    run_channels_login(
        config=config,
        bridge_dir=tmp_path,
        console=console,
        logo="marketbot",
    )

    assert calls[0][0] == ["npm", "start"]
    assert calls[0][1] == tmp_path
    assert calls[0][2] is True
    assert calls[0][3]["BRIDGE_TOKEN"] == "bridge-secret"
    assert any("Starting bridge" in line for line in console.lines)


@pytest.mark.parametrize("failure", [subprocess.CalledProcessError(2, ["npm", "start"]), FileNotFoundError()])
def test_run_channels_login_reports_failure_with_nonzero_exit(monkeypatch, tmp_path, failure) -> None:
    console = _Console()
    config = SimpleNamespace(channels=SimpleNamespace(whatsapp=SimpleNamespace(bridge_token="")))
    def fail(*args, **kwargs):
        raise failure
    monkeypatch.setattr("marketbot.cli.auth_runtime.subprocess.run", fail)
    with pytest.raises(typer.Exit) as error:
        run_channels_login(config=config, bridge_dir=tmp_path, console=console, logo="marketbot")
    assert error.value.exit_code == 1


def test_bridge_missing_npm_reports_actual_node_requirement(monkeypatch, tmp_path) -> None:
    console = _Console()
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setattr("marketbot.cli.auth_runtime.shutil.which", lambda command: None)
    with pytest.raises(typer.Exit):
        get_bridge_dir(console=console, logo="marketbot", commands_file=tmp_path / "cli" / "commands.py")
    assert any("Node.js >= 20" in line for line in console.lines)


def test_bridge_missing_source_reports_installable_package(monkeypatch, tmp_path) -> None:
    console = _Console()
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setattr("marketbot.cli.auth_runtime.shutil.which", lambda command: "/mock/npm")
    with pytest.raises(typer.Exit):
        get_bridge_dir(console=console, logo="marketbot", commands_file=tmp_path / "cli" / "commands.py")
    assert any("pip install --force-reinstall marketbot-ai" in line for line in console.lines)

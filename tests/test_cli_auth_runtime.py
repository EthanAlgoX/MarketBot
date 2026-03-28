from types import SimpleNamespace

import pytest
import typer

from marketbot.cli.auth_runtime import run_channels_login, run_provider_login


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

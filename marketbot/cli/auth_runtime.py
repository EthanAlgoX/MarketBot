"""Shared CLI authentication and bridge helpers."""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

import typer


def get_bridge_dir(*, console: Any, logo: str, commands_file: Path) -> Path:
    """Get the bridge directory, setting it up if needed."""
    user_bridge = Path.home() / ".marketbot" / "bridge"
    if (user_bridge / "dist" / "index.js").exists():
        return user_bridge

    if not shutil.which("npm"):
        console.print("[red]npm not found. Please install Node.js >= 18.[/red]")
        raise typer.Exit(1)

    pkg_bridge = commands_file.parent.parent / "bridge"
    src_bridge = commands_file.parent.parent.parent / "bridge"

    source = None
    if (pkg_bridge / "package.json").exists():
        source = pkg_bridge
    elif (src_bridge / "package.json").exists():
        source = src_bridge

    if not source:
        console.print("[red]Bridge source not found.[/red]")
        console.print("Try reinstalling: pip install --force-reinstall marketbot")
        raise typer.Exit(1)

    console.print(f"{logo} Setting up bridge...")

    user_bridge.parent.mkdir(parents=True, exist_ok=True)
    if user_bridge.exists():
        shutil.rmtree(user_bridge)
    shutil.copytree(source, user_bridge, ignore=shutil.ignore_patterns("node_modules", "dist"))

    try:
        console.print("  Installing dependencies...")
        subprocess.run(["npm", "install"], cwd=user_bridge, check=True, capture_output=True)

        console.print("  Building...")
        subprocess.run(["npm", "run", "build"], cwd=user_bridge, check=True, capture_output=True)

        console.print("[green]✓[/green] Bridge ready\n")
    except subprocess.CalledProcessError as exc:
        console.print(f"[red]Build failed: {exc}[/red]")
        if exc.stderr:
            console.print(f"[dim]{exc.stderr.decode()[:500]}[/dim]")
        raise typer.Exit(1) from exc

    return user_bridge


def run_channels_login(*, config: Any, bridge_dir: Path, console: Any, logo: str) -> None:
    """Start the local bridge for QR-based channel login."""
    console.print(f"{logo} Starting bridge...")
    console.print("Scan the QR code to connect.\n")

    env = {**os.environ}
    if config.channels.whatsapp.bridge_token:
        env["BRIDGE_TOKEN"] = config.channels.whatsapp.bridge_token

    try:
        subprocess.run(["npm", "start"], cwd=bridge_dir, check=True, env=env)
    except subprocess.CalledProcessError as exc:
        console.print(f"[red]Bridge failed: {exc}[/red]")
    except FileNotFoundError:
        console.print("[red]npm not found. Please install Node.js.[/red]")


def select_oauth_provider(*, provider: str, providers: list[Any]) -> Any:
    """Resolve an OAuth provider spec by user-facing provider name."""
    key = provider.replace("-", "_")
    return next((spec for spec in providers if spec.name == key and spec.is_oauth), None)


def run_provider_login(
    *,
    provider: str,
    providers: list[Any],
    login_handlers: dict[str, Callable[[], None]],
    console: Any,
    logo: str,
) -> None:
    """Authenticate with an OAuth provider."""
    spec = select_oauth_provider(provider=provider, providers=providers)
    if not spec:
        names = ", ".join(spec.name.replace("_", "-") for spec in providers if spec.is_oauth)
        console.print(f"[red]Unknown OAuth provider: {provider}[/red]  Supported: {names}")
        raise typer.Exit(1)

    handler = login_handlers.get(spec.name)
    if not handler:
        console.print(f"[red]Login not implemented for {spec.label}[/red]")
        raise typer.Exit(1)

    console.print(f"{logo} OAuth Login - {spec.label}\n")
    handler()


def login_openai_codex(*, console: Any, prompt_fn: Callable[[str], str]) -> None:
    """Run the OpenAI Codex OAuth flow."""
    try:
        from oauth_cli_kit import get_token, login_oauth_interactive

        token = None
        try:
            token = get_token()
        except Exception:
            pass
        if not (token and token.access):
            console.print("[cyan]Starting interactive OAuth login...[/cyan]\n")
            token = login_oauth_interactive(
                print_fn=lambda s: console.print(s),
                prompt_fn=prompt_fn,
            )
        if not (token and token.access):
            console.print("[red]✗ Authentication failed[/red]")
            raise typer.Exit(1)
        console.print(f"[green]✓ Authenticated with OpenAI Codex[/green]  [dim]{token.account_id}[/dim]")
    except ImportError as exc:
        console.print("[red]oauth_cli_kit not installed. Run: pip install oauth-cli-kit[/red]")
        raise typer.Exit(1) from exc


def login_github_copilot(*, console: Any) -> None:
    """Run the GitHub Copilot device auth flow."""
    console.print("[cyan]Starting GitHub Copilot device flow...[/cyan]\n")

    async def _trigger() -> None:
        from litellm import acompletion

        await acompletion(
            model="github_copilot/gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1,
        )

    try:
        asyncio.run(_trigger())
        console.print("[green]✓ Authenticated with GitHub Copilot[/green]")
    except Exception as exc:
        console.print(f"[red]Authentication error: {exc}[/red]")
        raise typer.Exit(1) from exc

#!/usr/bin/env python3
"""Run a minimal end-to-end smoke test for bb-browser and MarketBot browser tools."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class SmokeResult:
    name: str
    ok: bool
    detail: str


def _run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, check=False)


def _extract_json_blob(output: str) -> dict[str, Any]:
    payload = json.loads(output.strip())
    if not isinstance(payload, dict):
        raise ValueError("expected JSON object output")
    return payload


def _run_bb_site(command: str, adapter: str, *args: str) -> SmokeResult:
    proc = _run_command([command, "site", adapter, *args, "--json"])
    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()
    if proc.returncode != 0:
        detail = stdout or stderr or f"exit={proc.returncode}"
        return SmokeResult(adapter, False, detail)
    try:
        payload = _extract_json_blob(stdout)
    except Exception as exc:  # pragma: no cover - defensive parsing
        return SmokeResult(adapter, False, f"invalid json output: {exc}")
    if payload.get("success") is True:
        data = payload.get("data")
        if isinstance(data, dict):
            keys = ", ".join(sorted(data.keys())[:6])
            return SmokeResult(adapter, True, f"success keys=[{keys}]")
        return SmokeResult(adapter, True, "success")
    return SmokeResult(adapter, False, payload.get("error") or "unknown adapter failure")


def _default_marketbot_python() -> str:
    candidate = REPO_ROOT / ".venv313" / "bin" / "python"
    if candidate.exists():
        return str(candidate)
    return sys.executable


def _run_marketbot_tool(python_cmd: str, command: str, adapter: str, args: list[str]) -> SmokeResult:
    inline = """
import asyncio
import json
import sys
from marketbot.agent.tools.browser import BrowserSiteTool
from marketbot.config.schema import BrowserToolsConfig

command, adapter, args_json = sys.argv[1], sys.argv[2], sys.argv[3]
args = json.loads(args_json)
cfg = BrowserToolsConfig(
    enabled=True,
    command=command,
    mode="safe",
    adapter_catalog=[adapter],
    allow_sites=[adapter.split("/", 1)[0]],
    allow_adapters=[adapter],
)
tool = BrowserSiteTool(browser_config=cfg)
print(asyncio.run(tool.execute(adapter, args=args)))
"""
    proc = _run_command([python_cmd, "-c", inline, command, adapter, json.dumps(args)])
    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or f"exit={proc.returncode}"
        return SmokeResult(f"marketbot:{adapter}", False, detail)
    payload = json.loads(proc.stdout.strip())
    if payload.get("exitCode") != 0:
        detail = payload.get("stderr") or payload.get("stdout") or f"exit={payload.get('exitCode')}"
        return SmokeResult(f"marketbot:{adapter}", False, detail)
    stdout = payload.get("stdout", "")
    try:
        inner = _extract_json_blob(stdout)
    except Exception as exc:  # pragma: no cover - defensive parsing
        return SmokeResult(f"marketbot:{adapter}", False, f"invalid inner json output: {exc}")
    if inner.get("success") is True:
        return SmokeResult(f"marketbot:{adapter}", True, "success")
    return SmokeResult(f"marketbot:{adapter}", False, inner.get("error") or "unknown adapter failure")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--command",
        default=shutil.which("bb-browser") or "",
        help="Path to the bb-browser executable. Defaults to the first bb-browser on PATH.",
    )
    parser.add_argument(
        "--check-login-site",
        action="store_true",
        help="Also probe xueqiu/hot-stock and treat login-required as a soft pass.",
    )
    parser.add_argument(
        "--marketbot-python",
        default=_default_marketbot_python(),
        help="Python executable used to import MarketBot and run BrowserSiteTool.",
    )
    args = parser.parse_args()

    command = args.command.strip()
    if not command:
        print("bb-browser executable not found. Use --command to provide a path.", file=sys.stderr)
        return 2

    adapters = _run_command([command, "site", "list"])
    if adapters.returncode != 0:
        print(adapters.stderr.strip() or adapters.stdout.strip() or "failed to list adapters", file=sys.stderr)
        return 1

    required = {"wikipedia/summary", "reddit/search"}
    available = set()
    current_site = ""
    for line in adapters.stdout.splitlines():
        raw = line.rstrip()
        stripped = raw.strip()
        if not stripped:
            continue
        if not raw.startswith(" "):
            if stripped.endswith("/"):
                current_site = stripped[:-1]
            continue
        if not current_site:
            continue
        command_name = stripped.split()[0]
        available.add(f"{current_site}/{command_name}")

    missing = sorted(required - available)
    if missing:
        print(f"missing required adapters: {', '.join(missing)}", file=sys.stderr)
        return 1

    results = [
        _run_bb_site(command, "wikipedia/summary", "TSMC"),
        _run_bb_site(command, "reddit/search", "NVDA earnings"),
        _run_marketbot_tool(args.marketbot_python, command, "wikipedia/summary", ["TSMC"]),
    ]

    if args.check_login_site:
        login_result = _run_bb_site(command, "xueqiu/hot-stock", "3")
        if not login_result.ok and "Please log in to https://xueqiu.com" in login_result.detail:
            login_result = SmokeResult(login_result.name, True, "login-required hint confirmed")
        results.append(login_result)

    failed = [result for result in results if not result.ok]
    for result in results:
        marker = "PASS" if result.ok else "FAIL"
        print(f"[{marker}] {result.name}: {result.detail}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

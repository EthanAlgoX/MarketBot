#!/usr/bin/env python3
"""Zero-AI ADS-B overhead notifier.

Runs the sbs_overhead_check.py checker, then sends one WhatsApp message per alert
via the Clawdbot CLI (no model invocation).

- Runtime config is loaded from JSON (default: ~/.clawdbot/adsb-overhead/config.json)
- A simple quiet-hours gate can suppress notifications overnight.

Intended to be called by *system cron* or systemd timers.
"""

from __future__ import annotations

import argparse
import os
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from zoneinfo import ZoneInfo


DEFAULT_CONFIG = str(Path.home() / ".clawdbot" / "adsb-overhead" / "config.json")


def acquire_lock(lock_path: str) -> Optional[int]:
    """Return an open fd if lock acquired, else None."""
    try:
        import fcntl

        p = Path(lock_path).expanduser()
        p.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(p), os.O_RDWR | os.O_CREAT, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return fd
    except Exception:
        return None


def _expand(path: str) -> str:
    return str(Path(path).expanduser())


def load_config(path: str) -> dict:
    p = Path(_expand(path))
    return json.loads(p.read_text(encoding="utf-8"))


def in_quiet_hours(cfg: dict, now: Optional[datetime] = None) -> bool:
    q = (cfg.get("quietHours") or {})
    if not q.get("enabled"):
        return False

    tz = cfg.get("tz") or "Europe/London"
    z = ZoneInfo(tz)
    now = now or datetime.now(tz=z)

    def parse_hhmm(s: str) -> tuple[int, int]:
        hh, mm = s.strip().split(":", 1)
        return int(hh), int(mm)

    start_s = q.get("start") or "23:00"
    end_s = q.get("end") or "07:00"
    sh, sm = parse_hhmm(start_s)
    eh, em = parse_hhmm(end_s)

    start = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
    end = now.replace(hour=eh, minute=em, second=0, microsecond=0)

    if start <= end:
        return start <= now < end
    # crosses midnight
    return now >= start or now < end


def quiet_mode(cfg: dict, now: Optional[datetime] = None) -> str:
    """Return 'off' | 'suppress' | 'priority'."""
    q = (cfg.get("quietHours") or {})
    if not q.get("enabled"):
        return 'off'
    if not in_quiet_hours(cfg, now=now):
        return 'off'
    mode = (q.get('mode') or 'suppress').lower()
    if mode in ('priority', 'priority-only', 'military-only'):
        return 'priority'
    return 'suppress'


def run_checker(cfg: dict) -> List[dict]:
    sbs = cfg.get("sbs") or {}
    home = cfg.get("home") or {}
    photo_cfg = cfg.get("photo") or {}

    cmd = [
        sys.executable,
        str(Path(__file__).with_name("sbs_overhead_check.py")),
        "--host",
        str(sbs.get("host")),
        "--port",
        str(int(sbs.get("port", 30003))),
        "--home-lat",
        str(home.get("lat")),
        "--home-lon",
        str(home.get("lon")),
        "--radius-km",
        str(cfg.get("radiusKm", 2)),
        "--listen-seconds",
        str(cfg.get("listenSeconds", 6)),
        "--cooldown-min",
        str(cfg.get("cooldownMin", 15)),
        "--state-file",
        _expand(cfg.get("stateFile") or str(Path.home() / ".clawdbot" / "adsb-overhead" / "state.json")),
        "--aircraft-json-url",
        str(cfg.get("aircraftJsonUrl")),
        "--output",
        "jsonl",
    ]

    if photo_cfg.get("enabled"):
        cmd += [
            "--photo",
            "--photo-mode",
            "download",
            "--photo-size",
            str(photo_cfg.get("size", "large")),
            "--photo-cache-hours",
            str(photo_cfg.get("cacheHours", 24)),
            "--photo-dir",
            _expand(photo_cfg.get("dir") or str(Path.home() / ".clawdbot" / "adsb-overhead" / "photos")),
        ]

    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"checker failed ({p.returncode}): {p.stderr.strip()}")

    out = p.stdout.strip()
    if not out:
        return []

    alerts: List[dict] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        alerts.append(json.loads(line))
    return alerts


def find_clawdbot() -> str:
    """Locate the Clawdbot CLI.

    Cron often runs with a minimal PATH, so we check a few common locations.
    We avoid hard-coding any specific user's home directory.
    """

    candidates = [
        str(Path.home() / ".npm-global" / "bin" / "clawdbot"),
        "/usr/local/bin/clawdbot",
        "/usr/bin/clawdbot",
    ]
    for p in candidates:
        if Path(p).exists():
            return p

    w = shutil.which("clawdbot")
    if w:
        return w

    raise FileNotFoundError("clawdbot executable not found; check PATH for cron")


def send_message(channel: str, target: str, caption: str, media: Optional[str]) -> None:
    claw = find_clawdbot()
    cmd = [claw, "message", "send", "--channel", channel, "--target", target]

    if media:
        cmd += ["--media", media]
        if caption:
            cmd += ["--message", caption]
    else:
        cmd += ["--message", caption]

    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"send failed ({p.returncode}): {p.stderr.strip() or p.stdout.strip()}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Zero-AI overhead notifier (config-driven)")
    ap.add_argument("--config", default=DEFAULT_CONFIG, help=f"Path to config JSON (default: {DEFAULT_CONFIG})")
    args = ap.parse_args()

    cfg = load_config(args.config)

    lock_fd = acquire_lock((cfg.get('lockFile') or str(Path.home()/'.clawdbot'/'adsb-overhead'/'notifier.lock')))
    if lock_fd is None:
        # Another run is in progress; avoid overlap.
        return 0

    if not cfg.get("enabled", True):
        return 0

    qm = quiet_mode(cfg)
    if qm == 'suppress':
        return 0

    notify = cfg.get("notify") or {}
    channel = notify.get("channel") or "whatsapp"
    target = notify.get("target")
    if not target:
        raise RuntimeError("config.notify.target missing")

    alerts = run_checker(cfg)

    # Quiet-hours priority mode: only allow military when operation is known.
    if qm == 'priority':
        filtered = []
        for a in alerts:
            cap = (a.get('caption') or '')
            # crude: look for "Op: military" line
            if 'Op: military' in cap:
                filtered.append(a)
        alerts = filtered

    for a in alerts:
        caption = a.get("caption") or ""
        media = a.get("photoFile") or None
        if media:
            p = Path(str(media))
            if not p.exists():
                media = None

        try:
            send_message(channel=channel, target=target, caption=caption, media=media)
        except Exception as e:
            # Don't crash the whole run; just log to stderr so cron captures it.
            print(f"[adsb-overhead] send failed: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

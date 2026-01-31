#!/usr/bin/env python3
"""Manage adsb-overhead config.json (safe edits).

This exists so the assistant can update settings without hand-editing JSON.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

DEFAULT_CONFIG = str(Path.home() / ".clawdbot" / "adsb-overhead" / "config.json")


def load(path: str) -> Dict[str, Any]:
    p = Path(path).expanduser()
    return json.loads(p.read_text(encoding="utf-8"))


def save(path: str, cfg: Dict[str, Any]) -> None:
    p = Path(path).expanduser()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(cfg, indent=2, sort_keys=True), encoding="utf-8")


def set_path(cfg: Dict[str, Any], dotted: str, value: Any) -> None:
    parts = dotted.split(".")
    cur: Dict[str, Any] = cfg
    for k in parts[:-1]:
        nxt = cur.get(k)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[k] = nxt
        cur = nxt
    cur[parts[-1]] = value


def main() -> int:
    ap = argparse.ArgumentParser(description="Update adsb-overhead config")
    ap.add_argument("--config", default=DEFAULT_CONFIG)

    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status")

    p = sub.add_parser("enable")
    p.add_argument("--on", action="store_true")
    p.add_argument("--off", action="store_true")

    p = sub.add_parser("set-radius")
    p.add_argument("km", type=float)

    p = sub.add_parser("set-home")
    p.add_argument("lat", type=float)
    p.add_argument("lon", type=float)

    p = sub.add_parser("set-quiet")
    p.add_argument("--off", action="store_true", help="Disable quiet hours")
    p.add_argument("start", nargs="?", help="HH:MM")
    p.add_argument("end", nargs="?", help="HH:MM")

    args = ap.parse_args()
    cfg = load(args.config)

    if args.cmd == "status":
        out = {
            "enabled": cfg.get("enabled", True),
            "tz": cfg.get("tz"),
            "quietHours": cfg.get("quietHours"),
            "home": cfg.get("home"),
            "radiusKm": cfg.get("radiusKm"),
            "notify": cfg.get("notify"),
        }
        print(json.dumps(out, indent=2, sort_keys=True))
        return 0

    if args.cmd == "enable":
        if args.on == args.off:
            raise SystemExit("Specify exactly one of --on or --off")
        set_path(cfg, "enabled", bool(args.on))

    if args.cmd == "set-radius":
        if args.km <= 0:
            raise SystemExit("radius must be > 0")
        set_path(cfg, "radiusKm", float(args.km))

    if args.cmd == "set-home":
        set_path(cfg, "home.lat", float(args.lat))
        set_path(cfg, "home.lon", float(args.lon))

    if args.cmd == "set-quiet":
        if args.off:
            set_path(cfg, "quietHours.enabled", False)
        else:
            if not args.start or not args.end:
                raise SystemExit("Provide start and end (HH:MM HH:MM) or use --off")
            set_path(cfg, "quietHours.enabled", True)
            set_path(cfg, "quietHours.start", args.start)
            set_path(cfg, "quietHours.end", args.end)

    save(args.config, cfg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

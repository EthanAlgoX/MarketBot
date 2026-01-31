#!/usr/bin/env python3
"""Radio/Satellite Copilot Orchestrator (skeleton).

Purpose:
- Plan satellite pass jobs (NOAA / METEOR / ISS) based on pass predictions.
- Create per-pass run folders with metadata.
- Trigger remote capture on a Raspberry Pi (RTL-SDR USB) via SSH.
- Trigger remote decode on a Jetson (SatDump) via SSH.
- Send WhatsApp alerts (start/end/summary) via Clawdbot CLI.

This is a *skeleton*: it supports the job lifecycle and state/dedupe now.
TODO: Once we have Pi/Jetson details + exact commands, we plug in capture/decode.

Safety:
- Does nothing unless config.enabled=true
- Capture/decode commands are opt-in per satellite
- One job per pass (dedupe by passStart)
- Timeouts for remote commands
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


CONFIG = Path.home() / ".clawdbot" / "radio-copilot" / "config.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def find_clawdbot() -> str:
    # Avoid hard-coding any specific user's home directory.
    candidates = [
        str(Path.home() / ".npm-global" / "bin" / "clawdbot"),
        "/usr/local/bin/clawdbot",
        "/usr/bin/clawdbot",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return "clawdbot"


def send_whatsapp(channel: str, target: str, message: str) -> None:
    claw = find_clawdbot()
    subprocess.run([claw, "message", "send", "--channel", channel, "--target", target, "--message", message], capture_output=True)


def run(cmd: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def ssh(host: str, remote_cmd: str, timeout: int = 60, user: Optional[str] = None) -> subprocess.CompletedProcess:
    target = f"{user}@{host}" if user else host
    return run(["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", target, remote_cmd], timeout=timeout)


def predict_passes(norad: int, lat: float, lon: float, height_m: float, min_el: float, lookahead_min: float) -> List[dict]:
    # Avoid shell wrappers (this host prints a banner on login shells).
    # We can safely assume node is on PATH for this box, so just call "node".
    node = "node"
    script = Path(__file__).with_name("pass_predictor.mjs")
    p = run(
        [
            node,
            str(script),
            "--norad",
            str(norad),
            "--lat",
            str(lat),
            "--lon",
            str(lon),
            "--height-m",
            str(height_m),
            "--min-el",
            str(min_el),
            "--look-ahead-min",
            str(lookahead_min),
        ],
        timeout=120,
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or "pass predictor failed")
    out = []
    for line in (p.stdout or "").splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def main() -> int:
    cfg = load_json(CONFIG, {})
    if not cfg.get("enabled"):
        return 0

    obs = cfg.get("observer") or {}
    lat = float(obs.get("lat"))
    lon = float(obs.get("lon"))
    height_m = float(obs.get("heightM", 0))

    schedule = cfg.get("schedule") or {}
    lookahead = float(schedule.get("lookAheadMinutes", 180))
    lead_min = float(schedule.get("alertLeadMinutes", 10))
    min_repeat_min = float(schedule.get("minRepeatMinutes", 30))

    storage = cfg.get("storage") or {}
    root = Path(str(storage.get("root") or (Path.home() / ".clawdbot" / "radio-copilot"))).expanduser()
    runs_dir = root / str(storage.get("runsDir") or "runs")
    state_file = root / str(storage.get("stateFile") or "state.json")

    state = load_json(state_file, {"lastAlert": {}, "lastAlertEpoch": {}, "lastCapture": {}, "lastDecode": {}})

    notify = cfg.get("notify") or {}
    channel = notify.get("channel", "whatsapp")
    target = notify.get("target")

    now = time.time()

    for sat_cfg in cfg.get("satellites") or []:
        norad = int(sat_cfg.get("norad"))
        name = sat_cfg.get("name") or str(norad)
        min_el = float(sat_cfg.get("minElevationDeg", 20))

        passes = predict_passes(norad, lat, lon, height_m, min_el, lookahead)
        for p in passes:
            start_ts = datetime.fromisoformat(p["passStart"].replace("Z", "+00:00")).timestamp()
            end_ts = datetime.fromisoformat(p["passEnd"].replace("Z", "+00:00")).timestamp()
            # Dedup key: passStart can drift by a few seconds between runs depending on
            # TLE freshness + step size. Normalise to the nearest minute bucket.
            pass_bucket = int(start_ts // 60) * 60
            pass_id = f"{norad}:{pass_bucket}"

            # Only notify before the pass starts (within lead window).
            # Avoid repeated notifications while the pass is already ongoing.
            if now < start_ts - lead_min * 60 or now >= start_ts:
                continue

            run_dir = runs_dir / f"{norad}" / p["passStart"].replace(":", "_")
            run_dir.mkdir(parents=True, exist_ok=True)
            (run_dir / "pass.json").write_text(json.dumps(p, indent=2), encoding="utf-8")

            # Notify once per pass, with a safety minimum interval per satellite.
            last_epoch = float(state.get("lastAlertEpoch", {}).get(str(norad), 0) or 0)
            if (now - last_epoch) < min_repeat_min * 60:
                continue

            if target and state.get("lastAlert", {}).get(str(norad)) != pass_id:
                def dir8(az: float) -> str:
                    dirs = ["N","NE","E","SE","S","SW","W","NW"]
                    return dirs[int(((az % 360) / 45) + 0.5) % 8]

                aosAz = p.get('aosAzDeg')
                aosEl = p.get('aosElDeg')
                losAz = p.get('losAzDeg')
                losEl = p.get('losElDeg')

                aos = f"AOS Az/El: {aosAz}°/{aosEl}°" if aosAz is not None else "AOS Az/El: ?/?"
                los = f"LOS Az/El: {losAz}°/{losEl}°" if losAz is not None else "LOS Az/El: ?/?"
                inc = f"Inclination: {p.get('inclinationDeg','?')}°" if p.get('inclinationDeg') is not None else "Inclination: ?"

                track = "Track: ?"
                if aosAz is not None and losAz is not None:
                    track = f"Track: {dir8(float(aosAz))}→{dir8(float(losAz))}"

                send_whatsapp(
                    channel,
                    target,
                    f"SAT PASS SOON: {name} ({norad})\n"
                    f"Start: {p['passStart']} ({aos})\n"
                    f"Max: {p['passMax']} ({p['maxElevationDeg']}°)\n"
                    f"End: {p['passEnd']} ({los})\n"
                    f"{track}\n"
                    f"{inc}",
                )
                state.setdefault("lastAlert", {})[str(norad)] = pass_id
                state.setdefault("lastAlertEpoch", {})[str(norad)] = now

            # CAPTURE (placeholder)
            cap = sat_cfg.get("capture") or {}
            if cap.get("enabled") and state.get("lastCapture", {}).get(str(norad)) != pass_id:
                # Tomorrow: fill in host/user and actual capture command.
                (run_dir / "capture.todo").write_text("TODO: configure Pi host + capture command\n")
                state.setdefault("lastCapture", {})[str(norad)] = pass_id

            # DECODE (placeholder)
            dec = sat_cfg.get("decode") or {}
            if dec.get("enabled") and state.get("lastDecode", {}).get(str(norad)) != pass_id:
                (run_dir / "decode.todo").write_text("TODO: configure Jetson host + SatDump decode command\n")
                state.setdefault("lastDecode", {})[str(norad)] = pass_id

            # Save state and stop after first actionable pass per run
            save_json(state_file, state)
            return 0

    save_json(state_file, state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

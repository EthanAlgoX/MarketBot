#!/usr/bin/env python3
"""Radio/Satellite Copilot scheduler (zero-AI core).

- Reads ~/.clawdbot/radio-copilot/config.json
- Predicts upcoming passes for configured satellites
- Dedupes per pass (by passStart)
- Optionally:
  - emits alerts (via clawdbot message send)
  - runs a capture command during a pass window (guarded by timeout)

This is intentionally conservative and safe:
- Does nothing unless config.enabled=true
- Capture commands are opt-in per satellite
- Logs to stderr for cron

AI layer will come later (classify capture outputs, summarise daily results).
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

CONFIG = Path.home() / ".clawdbot" / "radio-copilot" / "config.json"


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


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run_pass_predictor(norad: int, lat: float, lon: float, height_m: float, min_el: float, lookahead_min: float) -> List[dict]:
    node = subprocess.check_output(["command", "-v", "node"], text=True).strip() or "node"
    script = Path(__file__).with_name("pass_predictor.mjs")
    cmd = [
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
    ]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or "pass predictor failed")
    out = []
    for line in (p.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        out.append(json.loads(line))
    return out


def send_notify(channel: str, target: str, message: str) -> None:
    claw = find_clawdbot()
    subprocess.run([claw, "message", "send", "--channel", channel, "--target", target, "--message", message], capture_output=True)


def main() -> int:
    cfg = load_json(CONFIG, {})
    if not cfg.get("enabled"):
        return 0

    storage = cfg.get("storage") or {}
    root = Path(str(storage.get("root") or (Path.home() / ".clawdbot" / "radio-copilot"))).expanduser()
    runs_dir = root / str(storage.get("runsDir") or "runs")
    state_file = root / str(storage.get("stateFile") or "state.json")

    state = load_json(state_file, {"lastAlert": {}, "lastCapture": {}})

    obs = cfg.get("observer") or {}
    lat = float(obs.get("lat"))
    lon = float(obs.get("lon"))
    height_m = float(obs.get("heightM", 0))

    schedule = cfg.get("schedule") or {}
    lookahead = float(schedule.get("lookAheadMinutes", 180))
    lead = float(schedule.get("alertLeadMinutes", 10))

    notify = cfg.get("notify") or {}
    channel = notify.get("channel", "whatsapp")
    target = notify.get("target")

    now = time.time()

    for sat_cfg in cfg.get("satellites") or []:
        norad = int(sat_cfg.get("norad"))
        name = sat_cfg.get("name") or str(norad)
        min_el = float(sat_cfg.get("minElevationDeg", 20))

        passes = run_pass_predictor(norad, lat, lon, height_m, min_el, lookahead)
        for p in passes:
            # Alert when within lead window
            start_ts = datetime.fromisoformat(p["passStart"].replace("Z", "+00:00")).timestamp()
            end_ts = datetime.fromisoformat(p["passEnd"].replace("Z", "+00:00")).timestamp()
            pass_id = p["passStart"]

            if now < start_ts - lead * 60 or now > end_ts:
                continue

            # Dedup alert per pass
            if state.get("lastAlert", {}).get(str(norad)) == pass_id:
                continue

            msg = (
                f"SAT PASS: {name} ({norad})\n"
                f"Start: {p['passStart']}\n"
                f"Max: {p['passMax']} ({p['maxElevationDeg']}°)\n"
                f"End: {p['passEnd']}\n"
            )
            if target:
                send_notify(channel, target, msg)

            state.setdefault("lastAlert", {})[str(norad)] = pass_id

            # Optional capture
            cap = sat_cfg.get("capture") or {}
            if cap.get("enabled"):
                # one capture per pass
                if state.get("lastCapture", {}).get(str(norad)) == pass_id:
                    continue

                cmd = cap.get("command")
                timeout = int(cap.get("timeoutSeconds", 900))
                if cmd:
                    run_dir = runs_dir / f"{norad}" / pass_id.replace(":", "_")
                    run_dir.mkdir(parents=True, exist_ok=True)
                    # store pass metadata
                    (run_dir / "pass.json").write_text(json.dumps(p, indent=2), encoding="utf-8")

                    # Run capture command in shell, with timeout
                    env = os.environ.copy()
                    env["RADIO_RUN_DIR"] = str(run_dir)
                    env["SAT_NORAD"] = str(norad)
                    env["SAT_NAME"] = name
                    env["PASS_START"] = p["passStart"]
                    env["PASS_END"] = p["passEnd"]
                    env["PASS_MAX"] = p["passMax"]
                    try:
                        subprocess.run(cmd, shell=True, cwd=str(run_dir), env=env, timeout=timeout)
                    except Exception:
                        pass

                    state.setdefault("lastCapture", {})[str(norad)] = pass_id

            break

    save_json(state_file, state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

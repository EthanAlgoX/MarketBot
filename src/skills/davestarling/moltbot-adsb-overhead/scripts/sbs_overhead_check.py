#!/usr/bin/env python3
"""Connect to an SBS/BaseStation TCP feed (port 30003) for a short window,
collect latest positions, and print *new* "overhead" aircraft within a radius.

Designed to be run periodically (cron) rather than as a long-lived daemon.

Output:
  - text (default): human readable alerts (optionally includes photo link)
  - jsonl: one JSON object per alert (optionally includes photoUrl / photoFile)

State:
  A small JSON file tracks last-alert timestamps per ICAO hex to avoid spam.
  Photo lookups are cached (by ICAO hex) when enabled.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import socket
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple
from urllib.request import Request, urlopen


@dataclass
class Aircraft:
    hex: str
    callsign: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    alt_ft: Optional[int] = None
    gs_kt: Optional[float] = None
    track_deg: Optional[float] = None
    last_seen_ts: float = 0.0

    # Optional enrichment (e.g., from readsb HTTP JSON or external DB)
    reg: Optional[str] = None
    ac_type: Optional[str] = None  # e.g., A320, B738
    operation: Optional[str] = None  # military|commercial|private|unknown
    emitter_category: Optional[str] = None  # ADS-B emitter category code e.g. A3
    photo_url: Optional[str] = None
    photo_file: Optional[str] = None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"lastAlert": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"lastAlert": {}}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def parse_sbs_line(line: str) -> Optional[Tuple[str, Dict[str, str]]]:
    parts = [p.strip() for p in line.split(",")]
    if not parts or parts[0] != "MSG":
        return None
    if len(parts) < 16:
        return None

    hex_ = parts[4].upper() if parts[4] else ""
    if not hex_:
        return None

    d: Dict[str, str] = {
        "tx_type": parts[1],
        "callsign": parts[10],
        "altitude": parts[11],
        "gs": parts[12],
        "track": parts[13],
        "lat": parts[14],
        "lon": parts[15],
    }
    return hex_, d


def coerce_float(s: str) -> Optional[float]:
    try:
        return float(s) if s != "" else None
    except Exception:
        return None


def coerce_int(s: str) -> Optional[int]:
    try:
        return int(float(s)) if s != "" else None
    except Exception:
        return None


def fetch_json(url: str, timeout_s: float = 2.5) -> dict:
    req = Request(url, headers={"User-Agent": "clawdbot-adsb-overhead/1.0"})
    with urlopen(req, timeout=timeout_s) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))


def fetch_readsb_aircraft_index(url: str, timeout_s: float = 2.5) -> Dict[str, dict]:
    """Fetch readsb/tar1090 aircraft.json and index by hex."""
    try:
        data = fetch_json(url, timeout_s=timeout_s)
        ac = data.get("aircraft") or []
        out: Dict[str, dict] = {}
        for item in ac:
            h = (item.get("hex") or item.get("icao") or "").upper()
            if h:
                out[h] = item
        return out
    except Exception:
        return {}


def _planespotters_pick_photo_url_sized(data: dict, size: str) -> Optional[str]:
    photos = data.get("photos") or []
    if not photos:
        return None
    p0 = photos[0]
    if size == "small":
        return (p0.get("thumbnail") or {}).get("src") or (p0.get("thumbnail_large") or {}).get("src")
    return (p0.get("thumbnail_large") or {}).get("src") or (p0.get("thumbnail") or {}).get("src")


def fetch_planespotters_photo_by_hex(hex_: str, size: str = "large", timeout_s: float = 3.5) -> Optional[str]:
    h = hex_.strip().upper()
    if not h:
        return None
    url = f"https://api.planespotters.net/pub/photos/hex/{h}"
    try:
        data = fetch_json(url, timeout_s=timeout_s)
        return _planespotters_pick_photo_url_sized(data, size=size)
    except Exception:
        return None


def download_image(url: str, dest: Path, timeout_s: float = 5.0, max_bytes: int = 3_000_000) -> Optional[Path]:
    try:
        # Basic allowlist: only fetch HTTPS thumbnails from Planespotters CDN.
        if not url.startswith("https://"):
            return None
        if "plnspttrs.net" not in url:
            return None

        req = Request(url, headers={"User-Agent": "clawdbot-adsb-overhead/1.0"})
        with urlopen(req, timeout=timeout_s) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "image" not in ctype:
                return None

            # Respect Content-Length if present.
            clen = resp.headers.get("Content-Length")
            if clen:
                try:
                    if int(clen) > max_bytes:
                        return None
                except Exception:
                    pass

            data = resp.read(max_bytes + 1)
            if len(data) > max_bytes:
                return None

        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return dest
    except Exception:
        return None


def guess_operation(enriched: dict, callsign: Optional[str], reg: Optional[str]) -> str:
    # Some forks include boolean-ish flags.
    for k in ("mil", "military"):
        v = enriched.get(k)
        if isinstance(v, bool) and v:
            return "military"
        if isinstance(v, str) and v.lower() in ("1", "true", "yes"):
            return "military"

    cs = (callsign or "").strip().upper()

    if cs:
        military_prefixes = ("RFR", "RRR", "RAF", "NAVY", "EAGLE", "TYPHO", "ASCOT")
        if cs.startswith(military_prefixes):
            return "military"

    import re

    if cs and re.match(r"^[A-Z]{3}\d", cs):
        return "commercial"

    r = (reg or "").strip().upper()
    if r and r != "?":
        return "private"

    return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser(description="Detect overhead aircraft from an SBS/BaseStation feed")
    ap.add_argument("--host", required=True, help="SBS host (e.g. 192.168.1.10)")
    ap.add_argument("--port", type=int, default=30003, help="SBS port (default: 30003)")
    ap.add_argument("--home-lat", type=float, required=True)
    ap.add_argument("--home-lon", type=float, required=True)
    ap.add_argument("--radius-km", type=float, default=2.0)
    ap.add_argument("--listen-seconds", type=float, default=5.0, help="How long to listen for SBS messages")
    ap.add_argument("--cooldown-min", type=float, default=15.0, help="Per-aircraft alert cooldown")
    ap.add_argument("--state-file", default=str(Path.home() / ".clawdbot" / "adsb-overhead" / "state.json"))
    ap.add_argument("--max-aircraft", type=int, default=5000)

    ap.add_argument(
        "--aircraft-json-url",
        default="",
        help="Optional URL to readsb/tar1090 aircraft.json (e.g. http://192.168.1.10/tar1090/data/aircraft.json)",
    )

    ap.add_argument("--photo", action="store_true", help="Enable Planespotters photo lookup")
    ap.add_argument(
        "--photo-mode",
        choices=["link", "download"],
        default="link",
        help="If --photo: include link (text/jsonl) or download (jsonl emits photoFile)",
    )
    ap.add_argument(
        "--photo-size",
        choices=["large", "small"],
        default="large",
        help="Planespotters photo size to use (default: large thumbnail)",
    )
    ap.add_argument(
        "--photo-cache-hours",
        type=float,
        default=24.0,
        help="Cache Planespotters photo lookups per ICAO hex for N hours (default: 24)",
    )
    ap.add_argument(
        "--photo-dir",
        default=str(Path.home() / ".clawdbot" / "adsb-overhead" / "photos"),
        help="Directory for downloaded photos when --photo-mode=download",
    )

    ap.add_argument(
        "--output",
        choices=["text", "jsonl"],
        default="text",
        help="Output format: text (default) or jsonl (one JSON object per alert)",
    )

    args = ap.parse_args()

    state_path = Path(args.state_file).expanduser()
    state = load_state(state_path)
    last_alert: dict = state.setdefault("lastAlert", {})
    photo_cache: dict = state.setdefault("photoCache", {})  # key: hex -> {url, ts}

    enrich_index: Dict[str, dict] = {}
    if args.aircraft_json_url:
        enrich_index = fetch_readsb_aircraft_index(args.aircraft_json_url)

    aircraft: Dict[str, Aircraft] = {}
    end = time.time() + args.listen_seconds

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    try:
        s.connect((args.host, args.port))
        s.settimeout(1.0)
        buf = b""
        while time.time() < end:
            try:
                chunk = s.recv(4096)
            except socket.timeout:
                continue
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                line = raw.decode("utf-8", errors="ignore").strip()
                parsed = parse_sbs_line(line)
                if not parsed:
                    continue
                hex_, d = parsed

                a = aircraft.get(hex_)
                if not a:
                    a = Aircraft(hex=hex_)
                    aircraft[hex_] = a

                if d.get("callsign"):
                    cs = d["callsign"].strip()
                    if cs:
                        a.callsign = cs

                alt = coerce_int(d.get("altitude", ""))
                if alt is not None:
                    a.alt_ft = alt

                gs = coerce_float(d.get("gs", ""))
                if gs is not None:
                    a.gs_kt = gs

                trk = coerce_float(d.get("track", ""))
                if trk is not None:
                    a.track_deg = trk

                lat = coerce_float(d.get("lat", ""))
                lon = coerce_float(d.get("lon", ""))
                if lat is not None and lon is not None:
                    a.lat = lat
                    a.lon = lon

                a.last_seen_ts = time.time()

                if len(aircraft) > args.max_aircraft:
                    oldest = sorted(aircraft.values(), key=lambda x: x.last_seen_ts)[: len(aircraft) // 10]
                    for o in oldest:
                        aircraft.pop(o.hex, None)

    finally:
        try:
            s.close()
        except Exception:
            pass

    now = time.time()
    cooldown_s = args.cooldown_min * 60.0

    alerts_text = []
    alerts_jsonl = []

    for a in aircraft.values():
        if a.lat is None or a.lon is None:
            continue

        dist_km = haversine_km(args.home_lat, args.home_lon, a.lat, a.lon)
        if dist_km > args.radius_km:
            continue

        last = float(last_alert.get(a.hex, 0) or 0)
        if now - last < cooldown_s:
            continue

        last_alert[a.hex] = now

        enriched = enrich_index.get(a.hex, {})
        if enriched:
            if not a.callsign:
                f = (enriched.get("flight") or enriched.get("callsign") or "").strip()
                if f:
                    a.callsign = f

            a.reg = (enriched.get("r") or enriched.get("reg") or a.reg)
            a.ac_type = (enriched.get("t") or enriched.get("ac_type") or a.ac_type)

            ec = enriched.get("category") or enriched.get("cat")
            if isinstance(ec, str) and ec.strip():
                a.emitter_category = ec.strip()

            a.operation = guess_operation(enriched, a.callsign, a.reg)

        cs = a.callsign or "(no callsign)"
        alt = f"{a.alt_ft}ft" if a.alt_ft is not None else "?ft"
        gs = f"{a.gs_kt:.0f}kt" if a.gs_kt is not None else "?kt"
        typ = a.ac_type or "?"
        reg = a.reg or "?"
        op = a.operation or "unknown"
        ec = a.emitter_category or "?"
        # Prefer per-aircraft tracking links over generic map coordinates.
        # Flightradar24 supports lookup by callsign in the URL in many cases.
        cs_for_url = (cs or "").strip().replace(" ", "")
        fr24 = f"https://www.flightradar24.com/{cs_for_url}" if cs_for_url and cs_for_url != "(nocallsign)" else ""
        # Reliable fallback: ADSBexchange by ICAO hex.
        adsbx = f"https://globe.adsbexchange.com/?icao={a.hex}"

        photo_url = None
        if args.photo:
            entry = photo_cache.get(a.hex)
            cached_url = None
            cached_ts = None
            if isinstance(entry, dict):
                cached_url = entry.get("url")
                cached_ts = entry.get("ts")

            if cached_url and isinstance(cached_ts, (int, float)) and (now - float(cached_ts) < args.photo_cache_hours * 3600):
                photo_url = cached_url
            else:
                photo_url = fetch_planespotters_photo_by_hex(a.hex, size=args.photo_size)
                if photo_url:
                    photo_cache[a.hex] = {"url": photo_url, "ts": now}

        photo_file = None
        if args.photo and args.photo_mode == "download" and photo_url:
            # store as <photo-dir>/<hex>.jpg (overwrite OK)
            photo_dir = Path(args.photo_dir).expanduser()
            dest = photo_dir / f"{a.hex}.jpg"
            got = download_image(photo_url, dest)
            if got:
                photo_file = str(got)

        track_link = fr24 or adsbx

        caption = (
            f"✈️ Overhead ({dist_km:.2f}km ≤ {args.radius_km:g}km)\n"
            f"Callsign: {cs}\n"
            f"Type: {typ} · Reg: {reg} · Op: {op} · EmitterCat: {ec}\n"
            f"Alt/Speed: {alt} · {gs}\n"
            f"Hex: {a.hex}\n"
            f"Track: {track_link}"
        )

        if args.output == "text":
            if photo_url and args.photo_mode == "link":
                alerts_text.append(caption + f"\nPhoto: {photo_url}")
            else:
                alerts_text.append(caption)
        else:
            alerts_jsonl.append(
                {
                    "hex": a.hex,
                    "callsign": cs,
                    "lat": a.lat,
                    "lon": a.lon,
                    "distanceKm": round(dist_km, 3),
                    "caption": caption,
                    "photoUrl": photo_url,
                    "photoFile": photo_file,
                }
            )

    save_state(state_path, state)

    if args.output == "text":
        if alerts_text:
            print("\n\n".join(alerts_text))
    else:
        for obj in alerts_jsonl:
            print(json.dumps(obj, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# adsb-overhead (Moltbot/Clawdbot skill)

Get WhatsApp alerts when aircraft are within a configurable radius of your home using a **local ADS-B SBS/BaseStation feed** (e.g. `readsb` on port **30003**) and optional enrichment from **tar1090**.

This project is designed to be **production-friendly**:
- **Zero-AI runtime** (no model calls for the watcher)
- Rate-limited per aircraft (cooldowns) with persistent state
- Optional photo attachment via Planespotters (public API)

## What you need

- An ADS-B receiver feeding **SBS/BaseStation** on TCP (commonly `:30003`)
- (Optional) `tar1090`/`readsb` HTTP endpoint for enrichment, e.g.:
  - `http://<host>/tar1090/data/aircraft.json`
- Clawdbot (aka Moltbot) running with WhatsApp configured

## Data flow (how it works)

1) **SBS/BaseStation feed (TCP 30003)**
- Source of truth for live aircraft positions.
- `sbs_overhead_check.py` connects for a short window, tracks latest position per ICAO hex, computes distance to your home coordinates, and applies per-aircraft cooldowns.

2) **tar1090 aircraft.json (optional enrichment)**
- Used only to enrich aircraft metadata by ICAO hex (e.g. callsign/flight, emitter category, sometimes registration/type depending on your tar1090/readsb DB).
- Does *not* drive the distance check.

3) **Planespotters photo API (optional)**
- If enabled, looks up a thumbnail by ICAO hex and can download it locally for attaching to WhatsApp.

4) **Zero-AI notifier**
- `adsb_overhead_notify.py` runs the checker in JSONL mode and sends one WhatsApp message per aircraft using `clawdbot message send`.

## Files

- `scripts/sbs_overhead_check.py`
  - Connects to the SBS feed for a short window and detects aircraft within radius.
  - Can output `text` or `jsonl`.
  - Can look up aircraft photos from Planespotters (hex endpoint) and optionally download thumbnails.

- `scripts/adsb_overhead_notify.py`
  - **Zero-AI notifier**.
  - Reads a config file, runs the checker, and sends **one WhatsApp per aircraft** using `clawdbot message send`.

- `scripts/adsb_config.py`
  - Helper for safely editing the config file.

## Quick start (manual test)

Run the checker directly:

```bash
python3 skills/public/adsb-overhead/scripts/sbs_overhead_check.py \
  --host <SBS_HOST> --port 30003 \
  --home-lat <LAT> --home-lon <LON> \
  --radius-km 2 \
  --listen-seconds 6 \
  --cooldown-min 15 \
  --aircraft-json-url http://<TAR1090_HOST>/tar1090/data/aircraft.json \
  --photo --photo-mode download --photo-size large \
  --output jsonl
```

## WhatsApp controls (how configuration changes work)

This repo **does not** include a dedicated “WhatsApp command parser” by itself.

In the original Moltbot/Clawdbot setup, configuration changes were made by:
- editing `~/.clawdbot/adsb-overhead/config.json`, or
- running the helper script `scripts/adsb_config.py`, and
- letting the watcher pick up the new settings on its next cron run.

If you want to control it via WhatsApp (e.g. “radius 5km”, “adsb off”), implement that in **your bot’s chat handler** and have it call `adsb_config.py`.

### Supported config operations via `adsb_config.py`

Examples:

```bash
# Show current settings
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json status

# Enable/disable
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json enable --on
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json enable --off

# Change radius (km)
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json set-radius 5

# Change home coordinates
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json set-home 51.5007 -0.1246

# Quiet hours
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json set-quiet 23:00 07:00
python3 scripts/adsb_config.py --config ~/.clawdbot/adsb-overhead/config.json set-quiet --off
```

## Install & run as a watcher (system cron)

1) Copy the example config and edit it:

```bash
mkdir -p ~/.clawdbot/adsb-overhead
cp skills/public/adsb-overhead/config.example.json ~/.clawdbot/adsb-overhead/config.json
nano ~/.clawdbot/adsb-overhead/config.json
chmod 600 ~/.clawdbot/adsb-overhead/config.json
```

2) Add a user crontab entry (runs every minute):

```bash
* * * * * /usr/bin/python3 /path/to/adsb_overhead_notify.py \
  --config ~/.clawdbot/adsb-overhead/config.json \
  >> ~/.clawdbot/adsb-overhead/notifier.log 2>&1
```

## Notes on Flightradar24 links

The alert text can include a Flightradar24 link using callsign (`https://www.flightradar24.com/<CALLSIGN>`). This is best-effort. A reliable fallback tracking link is ADSBexchange by hex.

## License

MIT

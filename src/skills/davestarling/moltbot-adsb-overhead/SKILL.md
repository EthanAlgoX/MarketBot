---
name: adsb-overhead
description: Notify when aircraft are overhead within a configurable radius using a local ADS-B SBS/BaseStation feed (readsb port 30003). Use when setting up or troubleshooting plane-overhead alerts, configuring radius/home coordinates/cooldowns, or creating a Clawdbot cron watcher that sends WhatsApp notifications for nearby aircraft.
---

# adsb-overhead

Detect aircraft overhead (within a radius) from a **local readsb SBS/BaseStation TCP feed** and notify via Clawdbot messaging.

This skill is designed for a periodic checker (cron) rather than a long-running daemon.

## Quick start (manual test)

1) Run the checker for a few seconds to see if it detects aircraft near you:

```bash
python3 skills/public/adsb-overhead/scripts/sbs_overhead_check.py \
  --host <SBS_HOST> --port 30003 \
  --home-lat <LAT> --home-lon <LON> \
  --radius-km 2 \
  --listen-seconds 5 \
  --cooldown-min 15
```

- If it prints lines, those are *new* alerts (not in cooldown).
- If it prints nothing, there were no new overhead aircraft during the sample window.

## How it works

- Connect to the SBS feed (TCP) for `--listen-seconds`.
- Track latest lat/lon per ICAO hex.
- Compute distance to `--home-lat/--home-lon` (Haversine).
- Emit alerts for aircraft within `--radius-km` **only if** not alerted within `--cooldown-min`.
- Persist state to a JSON file (default: `~/.clawdbot/adsb-overhead/state.json`).

SBS parsing assumptions are documented in: `references/sbs-fields.md`.

## Create a Clawdbot watcher (cron)

Use a Clawdbot cron job to run periodically. The cron job should:
1) `exec` the script
2) If stdout is non-empty, `message.send` it via WhatsApp

Pseudocode for the agent:

- Run:
  - `python3 .../sbs_overhead_check.py ...`
- If stdout trimmed is not empty:
  - send a WhatsApp message with that text

Suggested polling intervals:
- 30–60 seconds is usually enough (given cooldowns)
- Use `--listen-seconds 3..8` so each run can gather a few position frames

## Tuning knobs

- Increase `--radius-km` if you want fewer misses.
- Increase `--listen-seconds` if your feed is busy but you’re missing position updates.
- Use `--cooldown-min` to prevent spam (15–60 minutes recommended).

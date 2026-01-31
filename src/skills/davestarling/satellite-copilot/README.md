# radio-copilot (Moltbot/Clawdbot add-on)

A *zero-AI* satellite pass planner + orchestrator that can:
- predict upcoming satellite passes over a given lat/lon (NORAD + TLE)
- notify you on WhatsApp with **manual dish alignment** info (AOS/LOS az+el, track direction, inclination)
- (optional) trigger remote capture on a Raspberry Pi and remote decode on a Jetson (disabled by default)

This repo is the **skeleton/orchestration layer**. It’s designed to be safe and production-friendly: nothing transmits or captures unless you enable it.

## Example alert

![Example WhatsApp pass alert](assets/example-pass-alert.jpg)

## What you need

- Node.js (for pass prediction)
- Python 3 (for the orchestrator)
- A Moltbot/Clawdbot instance configured for WhatsApp notifications

Optional (when you’re ready to automate captures):
- Raspberry Pi with RTL-SDR dongle (USB)
- Jetson (or any Linux host) to run SatDump decode jobs

## Data flow

1) **Pass prediction**
- `scripts/pass_predictor.mjs` fetches a TLE for a satellite by NORAD ID and predicts passes above a minimum elevation.
- Output includes:
  - start/max/end times
  - AOS/LOS azimuth/elevation (for manual pointing)
  - a simple compass track direction (AOS→LOS)

2) **Orchestrator**
- `scripts/orchestrator.py` reads config, calls the predictor, dedupes alerts, and sends a WhatsApp message before the pass.
- It can also (optionally) run capture and decode hooks (disabled by default).

3) **State + run folders**
- State is persisted so you don’t get spammy repeats.
- Run folders are created per pass under `~/.clawdbot/radio-copilot/runs/…` (for future capture/decode artifacts).

## Configuration

Copy the example config:

```bash
mkdir -p ~/.clawdbot/radio-copilot
cp config.example.json ~/.clawdbot/radio-copilot/config.json
chmod 600 ~/.clawdbot/radio-copilot/config.json
```

Edit `~/.clawdbot/radio-copilot/config.json`:
- `observer.lat` / `observer.lon`
- `satellites[]` NORAD IDs (e.g. NOAA 19 = 33591)
- schedule:
  - `alertLeadMinutes`
  - `minRepeatMinutes` (anti-spam backstop)

## Install & run (system cron)

Run every 5 minutes:

```bash
*/5 * * * * /usr/bin/python3 /path/to/radio-copilot/scripts/orchestrator.py \
  >> ~/.clawdbot/radio-copilot/orchestrator.log 2>&1
```

## License

MIT

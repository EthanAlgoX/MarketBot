---
name: radio-copilot
description: Predict satellite passes (NOAA APT, METEOR LRPT, ISS) for a configured latitude/longitude and send WhatsApp alerts with manual dish alignment info (AOS/LOS azimuth+elevation, track direction, inclination). Use when setting up or operating a zero-AI pass scheduler/orchestrator for SDR satellite reception, including configuring NORAD IDs, minimum elevation, alert lead time, and optional remote capture/decode hooks (Pi RTL-SDR capture + Jetson SatDump decode).
---

# radio-copilot

Plan and alert on satellite passes for SDR reception.

## Quick start

1) Copy the example config:

```bash
mkdir -p ~/.clawdbot/radio-copilot
cp config.example.json ~/.clawdbot/radio-copilot/config.json
chmod 600 ~/.clawdbot/radio-copilot/config.json
```

2) Run the orchestrator once:

```bash
python3 scripts/orchestrator.py
```

3) Run periodically (system cron):

```bash
*/5 * * * * /usr/bin/python3 /path/to/radio-copilot/scripts/orchestrator.py >> ~/.clawdbot/radio-copilot/orchestrator.log 2>&1
```

## What it sends

Alerts include:
- pass start/max/end timestamps
- **AOS** (start) azimuth/elevation
- **LOS** (end) azimuth/elevation
- track direction (AOS→LOS compass)
- orbit inclination

## Notes

- Runtime is **zero-AI** by default.
- Capture/decode hooks are included but disabled until you configure your Pi/Jetson commands.

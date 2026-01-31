---
name: host-ping
description: Detect if a host (IP: 39.106.7.8) is online by sending ping requests. Returns status like reachable, latency, or error if offline.
metadata:
  openclaw:
    requires:
      bins: ["ping"]  # Requires the 'ping' command-line tool
    emoji: "🔔"  # Optional: UI icon for the skill
    homepage: "https://example.com/host-ping"  # Optional: Link to more info
    os: ["darwin", "linux", "win32"]  # Supported OS (macOS, Linux, Windows)
    install: []  # No additional installation needed if ping is available
---

## Usage Instructions for the Agent

To use this skill, execute a ping command on the host IP 39.106.7.8. Use shell execution to run:

```bash
ping -c 4 39.106.7.8  # Send 4 ping packets (cross-platform compatible)
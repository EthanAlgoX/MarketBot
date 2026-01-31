---
name: usage-export
version: 1.0.0
description: Export OpenClaw usage data to CSV for analytics tools like Power BI. Hourly aggregates by activity type, model, and channel.
homepage: https://clawdhub.com/skills/usage-export
metadata: {"openclaw":{"emoji":"📊","category":"analytics","requires":{"bins":["python3"]}}}
---

# Usage Export

Export your OpenClaw usage data to CSV files for analytics in Power BI, Excel, or any BI tool.

## What It Does

- Scans session JSONL files for usage data
- Aggregates by **hour** and **activity type**
- Outputs one CSV per day
- Tracks tokens, costs, and tool usage
- Includes main session + subagent sessions

## Output Format

CSV files are written to `~/.clawdbot/exports/usage/YYYY-MM-DD.csv`:

```csv
timestamp_hour,date,hour,session_key,channel,model,provider,activity_type,request_count,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,total_tokens,cost_usd
2026-01-30T05:00:00Z,2026-01-30,5,agent:main:main,signal,claude-opus-4-5,anthropic,chat,3,24,892,14209,500,15625,0.12
2026-01-30T05:00:00Z,2026-01-30,5,agent:main:main,signal,claude-opus-4-5,anthropic,tool:exec,8,80,450,0,0,530,0.02
```

**For detailed column definitions, see [SCHEMA.md](SCHEMA.md).**

## Installation

```bash
# Via ClawdHub
clawdhub install usage-export

# Or manually
mkdir -p ~/.openclaw/skills/usage-export
# Copy SKILL.md, SCHEMA.md, and scripts/ folder
```

## Usage

### Manual Export

```bash
# Export today's data
python3 {baseDir}/scripts/export.py --today

# Export specific date
python3 {baseDir}/scripts/export.py --date 2026-01-29

# Export date range
python3 {baseDir}/scripts/export.py --from 2026-01-01 --to 2026-01-31
```

### Cron Setup (recommended)

Run hourly to keep exports fresh:

```bash
# System crontab
0 * * * * python3 ~/.openclaw/skills/usage-export/scripts/export.py --today
```

Or via OpenClaw config:

```json
{
  "cron": {
    "jobs": [{
      "name": "usage-export",
      "schedule": { "kind": "cron", "expr": "0 * * * *" },
      "payload": { 
        "kind": "systemEvent", 
        "text": "Run usage export: python3 ~/.openclaw/skills/usage-export/scripts/export.py --today --quiet" 
      },
      "sessionTarget": "main"
    }]
  }
}
```

## Power BI Integration

1. **Get Data** → Text/CSV
2. Point to `~/.clawdbot/exports/usage/` folder
3. Combine files using Folder source
4. Build your dashboard!

### Suggested Visualizations

- **Daily cost trend** — Line chart by date
- **Model breakdown** — Pie chart by model
- **Activity heatmap** — Matrix of hour × activity_type
- **Channel comparison** — Bar chart by channel
- **Tool usage ranking** — Top 10 tools by request count

## Configuration

Environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `USAGE_EXPORT_DIR` | `~/.clawdbot/exports/usage` | Output directory |
| `USAGE_EXPORT_SESSIONS` | `~/.clawdbot/agents` | Sessions directory |

## Notes

- All timestamps are UTC
- Cost column is an **estimate** based on configured pricing (see SCHEMA.md for details)
- Cache tokens are Anthropic-specific; other providers show 0
- New sessions are picked up automatically on next export run

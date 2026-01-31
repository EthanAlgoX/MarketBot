---
name: set-reminder
description: Use when user wants to be reminded about something at a specific time or recurring schedule. Creates cron-based reminders delivered via iMessage, Discord, or other configured channels.
---

# Set Reminder

Creates validated reminders using the OpenClaw cron system. Handles time parsing, channel validation, and delivers via configured channels.

## Usage

From any workspace:
```bash
python3 skills/set-reminder/scripts/set_reminder.py --at <when> --message "<text>" [--channel <name>]
python3 skills/set-reminder/scripts/set_reminder.py --every <duration> --message "<text>" [--channel <name>]
python3 skills/set-reminder/scripts/set_reminder.py --cron "<expr>" --message "<text>" [--channel <name>]
```

Or using `{baseDir}` (skill directory):
```bash
python3 {baseDir}/scripts/set_reminder.py --at <when> --message "<text>" [--channel <name>]
python3 {baseDir}/scripts/set_reminder.py --every <duration> --message "<text>" [--channel <name>]
python3 {baseDir}/scripts/set_reminder.py --cron "<expr>" --message "<text>" [--channel <name>]
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--at` | One-shot: ISO datetime (`2025-02-01T14:00:00`) or relative (`+20m`, `+1h`, `+2d`) |
| `--every` | Recurring interval: `30m`, `2h`, `1d` |
| `--cron` | 5-field cron: `"0 9 * * *"` |
| `--message` | Reminder text (required) |
| `--channel` | Channel name from config (optional, uses default) |

## Examples

```bash
# Remind in 20 minutes
python3 skills/set-reminder/scripts/set_reminder.py --at "+20m" --message "Take medicine"

# Daily at 9 AM via discord
python3 skills/set-reminder/scripts/set_reminder.py --cron "0 9 * * *" --message "Standup" --channel discord

# Every 2 hours
python3 skills/set-reminder/scripts/set_reminder.py --every "2h" --message "Drink water"
```

## Config

**Workspace/local skill (recommended):**
Create `config.json` in the skill directory:

```json
{
  "default": "imessage",
  "timezone": "America/Edmonton",
  "channels": {
    "imessage": "user@example.com",
    "discord": "1234567890123456789"
  }
}
```

**Managed skill (legacy):**
Config in `~/.openclaw/openclaw.json` at `skills.entries.set-reminder.config.<agentId>`:

```json
"set-reminder": {
  "enabled": true,
  "config": {
    "main": {
      "default": "imessage",
      "timezone": "America/Edmonton",
      "channels": { "imessage": "user@example.com" }
    }
  }
}
```

**Required fields:** `default`, `timezone`, `channels`

## How It Works

1. Loads config from skill directory (workspace/local) or managed skill location
2. Validates input (time format, channel exists)
3. Creates cron job via `openclaw cron add`
4. Reminder fires and delivers via configured channel

**Config Priority:**
1. `<skill_dir>/config.json` (workspace/local skill - highest priority)
2. `~/.openclaw/skills/set-reminder/config.json` (managed skill)
3. `~/.openclaw/openclaw.json` at `skills.entries.set-reminder.config` (legacy fallback)

#!/usr/bin/env python3
"""
Set Reminder - Backend script for creating cron-based reminders

Validates inputs, executes openclaw cron add, and returns structured output.

Usage:
    set_reminder.py --at <when> --message "<text>" [--channel <name>]
    set_reminder.py --every <duration> --message "<text>" [--channel <name>]
    set_reminder.py --cron "<expr>" --message "<text>" [--channel <name>]

Examples:
    set_reminder.py --at "+20m" --message "Take medicine"
    set_reminder.py --at "2025-02-01T14:00:00" --message "Meeting time"
    set_reminder.py --every "2h" --message "Drink water"
    set_reminder.py --cron "0 9 * * *" --message "Daily standup"
    set_reminder.py --at "+1h" --message "Call mom" --channel discord
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

SKILL_NAME = "set-reminder"
OPENCLAW_CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"


def find_skill_dir():
    """
    Find the skill directory by checking common locations.
    
    Returns: Path to skill directory, or None if not found
    """
    # Script location
    script_path = Path(__file__).resolve()
    
    # Skill directory is the parent of the scripts directory
    skill_dir = script_path.parent.parent
    
    # Verify it's a valid skill directory (has SKILL.md)
    if (skill_dir / "SKILL.md").exists():
        return skill_dir
    
    # Fallback: check managed skills location
    managed_skill_dir = Path.home() / ".openclaw" / "skills" / SKILL_NAME
    if (managed_skill_dir / "SKILL.md").exists():
        return managed_skill_dir
    
    return None


def load_config():
    """
    Load skill config from local skill directory or managed skill directory.
    
    Priority:
    1. <skill_dir>/config.json (workspace/local skill)
    2. ~/.openclaw/skills/set-reminder/config.json (managed skill)
    3. ~/.openclaw/openclaw.json at skills.entries.set-reminder.config (legacy)
    
    Returns: (config_dict, None) on success, (None, error_message) on failure
    """
    skill_dir = find_skill_dir()
    
    if not skill_dir:
        return None, (
            f"Could not find skill directory for '{SKILL_NAME}'.\n"
            f"Expected to find SKILL.md in skill directory."
        )
    
    # Try local config first
    local_config = skill_dir / "config.json"
    if local_config.exists():
        try:
            with open(local_config) as f:
                config = json.load(f)
        except json.JSONDecodeError as e:
            return None, f"Invalid {local_config}: {e}"
        
        # Validate required fields
        if "default" not in config:
            return None, f"No 'default' channel in {local_config}"
        
        if "channels" not in config or not config["channels"]:
            return None, f"No 'channels' in {local_config}"
        
        if config["default"] not in config["channels"]:
            return None, (
                f"Default channel '{config['default']}' not found in channels.\n"
                f"Available: {', '.join(config['channels'].keys())}"
            )
        
        if "timezone" not in config:
            return None, f"No 'timezone' in {local_config}"
        
        return config, None
    
    # Fallback: try legacy openclaw.json
    if not OPENCLAW_CONFIG_PATH.exists():
        return None, (
            f"No config found.\n"
            f"Expected {local_config} (workspace skill config) or {OPENCLAW_CONFIG_PATH} (legacy)."
        )
    
    try:
        with open(OPENCLAW_CONFIG_PATH) as f:
            openclaw_config = json.load(f)
    except json.JSONDecodeError as e:
        return None, f"Invalid {OPENCLAW_CONFIG_PATH}: {e}"
    
    # Navigate to skills.entries.set-reminder.config
    skill_entry = (
        openclaw_config
        .get("skills", {})
        .get("entries", {})
        .get(SKILL_NAME, {})
    )
    
    if not skill_entry:
        return None, (
            f"Skill '{SKILL_NAME}' not configured in {OPENCLAW_CONFIG_PATH}.\n"
            f"Create {local_config} instead for workspace-local configuration."
        )
    
    skill_config = skill_entry.get("config")
    if not skill_config:
        return None, (
            f"No config for skill '{SKILL_NAME}' in {OPENCLAW_CONFIG_PATH}.\n"
            f"Create {local_config} instead for workspace-local configuration."
        )
    
    # Get first available config (any agent, since each workspace is isolated)
    available_configs = [v for k, v in skill_config.items() if not k.startswith("_")]
    
    if not available_configs:
        return None, f"No agent configs found for skill '{SKILL_NAME}'"
    
    config = available_configs[0]
    
    # Validate required fields
    if "default" not in config:
        return None, f"No 'default' channel in config for skill '{SKILL_NAME}'"
    
    if "channels" not in config or not config["channels"]:
        return None, f"No 'channels' in config for skill '{SKILL_NAME}'"
    
    if config["default"] not in config["channels"]:
        return None, (
            f"Default channel '{config['default']}' not found in channels.\n"
            f"Available: {', '.join(config['channels'].keys())}"
        )
    
    if "timezone" not in config:
        return None, f"No 'timezone' in config for skill '{SKILL_NAME}'"
    
    return config, None


def get_channel_info(config, channel_name=None):
    """Get channel and destination from config."""
    if channel_name is None:
        channel_name = config["default"]
    
    if channel_name not in config["channels"]:
        available = ", ".join(config["channels"].keys())
        return None, None, f"Channel '{channel_name}' not found. Available: {available}"
    
    return channel_name, config["channels"][channel_name], None


def sanitize_name(message):
    """Convert message to a valid job name."""
    name = message.lower()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    name = name.strip("-")
    name = re.sub(r"-{2,}", "-", name)
    if len(name) > 50:
        name = name[:50].rstrip("-")
    return f"reminder-{name}" if name else "reminder"


def validate_at_time(at_value, config_tz):
    """
    Validate --at time format and check if it's in the past.
    
    Args:
        at_value: The time value to validate
        config_tz: IANA timezone string from config (e.g., "America/Edmonton")
    
    Returns: (None, None) on success, (None, error_message) on failure
    """
    try:
        user_tz = ZoneInfo(config_tz)
    except Exception as e:
        return None, f"Invalid timezone '{config_tz}': {str(e)}. Use IANA format (e.g., America/Edmonton, UTC)"
    
    relative_pattern = r"^\+(\d+)(m|h|d|s)$"
    if re.match(relative_pattern, at_value):
        return None, None
    
    iso_patterns = [
        r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$",
        r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$",
        r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$",
    ]
    
    is_iso = any(re.match(p, at_value) for p in iso_patterns)
    if not is_iso:
        return None, f"Invalid time format: '{at_value}'. Use ISO format (2025-02-01T14:00:00) or relative (+20m, +1h, +2d)"
    
    try:
        if at_value.endswith("Z"):
            dt = datetime.fromisoformat(at_value.replace("Z", "+00:00"))
        else:
            try:
                dt = datetime.fromisoformat(at_value)
            except ValueError:
                return None, f"Could not parse datetime: '{at_value}'"
        
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=user_tz)
        
        now = datetime.now(timezone.utc)
        
        if dt < now:
            hours_ago = (now - dt.astimezone(timezone.utc)).total_seconds() / 3600
            return None, f"Time '{at_value}' is in the past ({abs(hours_ago):.1f} hours ago). Please use a future time."
    
    except Exception as e:
        return None, f"Error parsing datetime: {e}"
    
    return None, None


def validate_every_duration(every_value):
    """
    Validate --every duration format.
    
    Returns: (True, None) on success, (None, error_message) on failure
    """
    pattern = r"^(\d+)(s|m|h|d)$"
    if not re.match(pattern, every_value):
        return None, f"Invalid duration format: '{every_value}'. Use format like: 30m, 2h, 1d"
    return True, None


def validate_cron_expression(cron_value):
    """
    Validate 5-field cron expression.
    
    Returns: (True, None) on success, (None, error_message) on failure
    """
    parts = cron_value.split()
    if len(parts) != 5:
        return None, f"Cron expression must have 5 fields, got {len(parts)}: '{cron_value}'"
    
    field_names = ["minute", "hour", "day of month", "month", "day of week"]
    field_ranges = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)]
    
    for i, (part, name, (min_val, max_val)) in enumerate(zip(parts, field_names, field_ranges)):
        if part == "*":
            continue
        if re.match(r"^\*/\d+$", part):
            continue
        if re.match(r"^\d+(-\d+)?(,\d+(-\d+)?)*$", part):
            numbers = re.findall(r"\d+", part)
            for num in numbers:
                n = int(num)
                if n < min_val or n > max_val:
                    return None, f"Invalid {name} value '{num}' in cron expression. Must be {min_val}-{max_val}."
            continue
        return None, f"Invalid {name} field '{part}' in cron expression"
    
    return True, None


def calculate_next_fire(schedule_type, schedule_value):
    """
    Calculate next fire time and return countdown.
    
    Returns: (countdown_str, human_readable_str) or (None, None) on error
    """
    now = datetime.now(timezone.utc)
    next_fire = None
    
    if schedule_type == "at":
        if schedule_value.startswith("+"):
            match = re.match(r"^\+(\d+)(s|m|h|d)$", schedule_value)
            if match:
                amount = int(match.group(1))
                unit = match.group(2)
                if unit == "s":
                    next_fire = now + timedelta(seconds=amount)
                elif unit == "m":
                    next_fire = now + timedelta(minutes=amount)
                elif unit == "h":
                    next_fire = now + timedelta(hours=amount)
                elif unit == "d":
                    next_fire = now + timedelta(days=amount)
        else:
            try:
                if schedule_value.endswith("Z"):
                    next_fire = datetime.fromisoformat(schedule_value.replace("Z", "+00:00"))
                else:
                    next_fire = datetime.fromisoformat(schedule_value)
                    if next_fire.tzinfo is None:
                        next_fire = next_fire.replace(tzinfo=timezone.utc)
            except:
                pass
    
    elif schedule_type == "every":
        match = re.match(r"^(\d+)(s|m|h|d)$", schedule_value)
        if match:
            amount = int(match.group(1))
            unit = match.group(2)
            if unit == "s":
                next_fire = now + timedelta(seconds=amount)
            elif unit == "m":
                next_fire = now + timedelta(minutes=amount)
            elif unit == "h":
                next_fire = now + timedelta(hours=amount)
            elif unit == "d":
                next_fire = now + timedelta(days=amount)
    
    elif schedule_type == "cron":
        return "(see cron schedule)", f"Recurring: {schedule_value}"
    
    if next_fire is None:
        return None, None
    
    delta = next_fire - now
    total_seconds = int(delta.total_seconds())
    
    if total_seconds < 0:
        return "00:00:00", "Already passed"
    
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    
    countdown = f"{days:02d}:{hours:02d}:{minutes:02d}"
    
    if days == 0 and hours == 0:
        human = f"In {minutes} minute{'s' if minutes != 1 else ''}"
    elif days == 0:
        human = f"In {hours}h {minutes}m"
    elif days == 1:
        human = f"Tomorrow at {next_fire.astimezone(tz=None).strftime('%H:%M')}"
    else:
        human = f"In {days} days at {next_fire.astimezone(tz=None).strftime('%H:%M')}"
    
    return countdown, human


def find_openclaw():
    """Find openclaw binary using shutil.which and common locations."""
    found = shutil.which("openclaw")
    if found:
        return found
    
    common_paths = [
        Path.home() / ".npm-global/bin/openclaw",
        Path("/usr/local/bin/openclaw"),
        Path("/usr/bin/openclaw"),
    ]
    for path in common_paths:
        if path.exists():
            return str(path)
    
    return "openclaw"


def run_cron_command(args_list):
    """Execute openclaw cron add and return result."""
    openclaw_bin = find_openclaw()
    cmd = [openclaw_bin, "cron", "add"] + args_list
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out after 30 seconds"
    except Exception as e:
        return -1, "", f"Failed to execute command: {e}"


def parse_job_id(stdout, stderr):
    """Extract job ID from cron add output."""
    combined = stdout + stderr
    
    patterns = [
        r"job[_\s]?id[:\s]+([a-zA-Z0-9_-]+)",
        r"created[:\s]+([a-zA-Z0-9_-]+)",
        r"id[:\s]+([a-zA-Z0-9_-]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            return match.group(1)
    
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Set a reminder using openclaw cron"
    )
    
    time_group = parser.add_mutually_exclusive_group(required=True)
    time_group.add_argument(
        "--at",
        help="One-shot: ISO datetime (2025-02-01T14:00:00) or relative (+20m, +1h)"
    )
    time_group.add_argument(
        "--every",
        help="Recurring interval: 30m, 2h, 1d"
    )
    time_group.add_argument(
        "--cron",
        help="Cron expression (5-field): '0 9 * * *'"
    )
    
    parser.add_argument(
        "--message",
        required=True,
        help="Reminder message text"
    )
    parser.add_argument(
        "--channel",
        help="Delivery channel (uses default if not specified)"
    )
    
    args = parser.parse_args()
    
    # Load config (local or managed)
    config, error = load_config()
    if error:
        print(f"ERROR: {error}")
        sys.exit(1)
    
    # Get channel info
    channel, to_dest, error = get_channel_info(config, args.channel)
    if error:
        print(f"ERROR: {error}")
        sys.exit(1)
    
    # Determine schedule type and validate
    if args.at:
        schedule_type = "at"
        schedule_value = args.at
        _, error = validate_at_time(args.at, config["timezone"])
        if error:
            print(f"ERROR: {error}")
            sys.exit(1)
    elif args.every:
        schedule_type = "every"
        schedule_value = args.every
        _, error = validate_every_duration(args.every)
        if error:
            print(f"ERROR: {error}")
            sys.exit(1)
    elif args.cron:
        schedule_type = "cron"
        schedule_value = args.cron
        _, error = validate_cron_expression(args.cron)
        if error:
            print(f"ERROR: {error}")
            sys.exit(1)
    
    # Build cron command
    job_name = sanitize_name(args.message)
    reminder_message = f"[DELIVER THIS REMINDER] The user asked you to remind them to: {args.message}. Send this reminder now - respond with a brief, friendly reminder message."
    
    cron_schedule_value = schedule_value
    if schedule_type == "at" and schedule_value.startswith("+"):
        cron_schedule_value = schedule_value[1:]
    
    cron_args = [
        "--name", job_name,
        "--session", "isolated",
        f"--{schedule_type}", cron_schedule_value,
        "--tz", config["timezone"],
        "--message", reminder_message,
        "--deliver",
        "--channel", channel,
        "--to", to_dest,
        "--post-mode", "full",
    ]
    
    if schedule_type == "at":
        cron_args.append("--delete-after-run")
    
    returncode, stdout, stderr = run_cron_command(cron_args)
    
    if returncode != 0:
        print(f"ERROR: Failed to create reminder")
        if stderr:
            print(f"Details: {stderr}")
        if stdout:
            print(f"Output: {stdout}")
        sys.exit(1)
    
    job_id = parse_job_id(stdout, stderr)
    countdown, human_time = calculate_next_fire(schedule_type, schedule_value)
    
    print("SUCCESS: Reminder created")
    if job_id:
        print(f"Job ID: {job_id}")
    print(f"Channel: {channel}")
    print(f"Message: {reminder_message}")
    if countdown:
        print(f"Next fire: {countdown} ({human_time})")
    if stdout.strip():
        print(f"\nCron output:\n{stdout}")


if __name__ == "__main__":
    main()

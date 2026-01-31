#!/usr/bin/env python3
"""
usage-export: Export OpenClaw usage data to CSV for analytics.
Aggregates by hour and activity type.
"""

import json
import csv
import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Optional

# Default paths
DEFAULT_SESSIONS_DIR = Path.home() / ".clawdbot" / "agents"
DEFAULT_EXPORT_DIR = Path.home() / ".clawdbot" / "exports" / "usage"

# CSV columns
CSV_COLUMNS = [
    "timestamp_hour",
    "date", 
    "hour",
    "session_key",
    "channel",
    "model",
    "provider",
    "activity_type",
    "request_count",
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "total_tokens",
    "cost_usd"
]


def get_activity_type(message: Dict[str, Any]) -> List[str]:
    """
    Determine activity type(s) from a message.
    Returns list of activity types (a message can have both chat and tool calls).
    """
    activities = []
    content = message.get("content", [])
    
    if not isinstance(content, list):
        return ["chat"]
    
    has_text = False
    tool_calls = []
    
    for item in content:
        item_type = item.get("type", "")
        
        if item_type == "text":
            has_text = True
        elif item_type == "toolCall":
            tool_name = item.get("name", "unknown")
            tool_calls.append(f"tool:{tool_name}")
        elif item_type == "thinking":
            # Count extended thinking separately if significant
            pass
    
    # If there are tool calls, that's the primary activity
    if tool_calls:
        activities.extend(tool_calls)
    elif has_text:
        activities.append("chat")
    else:
        activities.append("other")
    
    return activities if activities else ["other"]


def parse_session_file(filepath: Path, target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Parse a session JSONL file and extract usage records.
    Returns list of usage records with activity types.
    """
    records = []
    current_model = "unknown"
    current_provider = "unknown"
    session_key = "unknown"
    channel = "unknown"
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                
                entry_type = entry.get("type", "")
                
                # Track session metadata
                if entry_type == "session":
                    # Try to get session key from filename or metadata
                    pass
                
                # Track model changes
                if entry_type == "model_change":
                    current_model = entry.get("modelId", "unknown")
                    current_provider = entry.get("provider", "unknown")
                
                # Process messages with usage data
                if entry_type == "message":
                    message = entry.get("message", {})
                    usage = message.get("usage", {})
                    
                    # Skip if no usage data
                    if not usage:
                        continue
                    
                    # Skip user messages (they don't have usage)
                    if message.get("role") != "assistant":
                        continue
                    
                    # Get timestamp
                    timestamp_str = entry.get("timestamp", "")
                    if not timestamp_str:
                        continue
                    
                    try:
                        timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                    except ValueError:
                        continue
                    
                    # Filter by date if specified
                    record_date = timestamp.strftime("%Y-%m-%d")
                    if target_date and record_date != target_date:
                        continue
                    
                    # Get model info from message or fallback to tracked
                    model = entry.get("model", current_model)
                    provider = entry.get("provider", current_provider)
                    
                    # Get activity types
                    activities = get_activity_type(message)
                    
                    # Get usage metrics
                    cost_data = usage.get("cost", {})
                    
                    # Create a record for each activity type
                    # (distribute usage evenly if multiple activities)
                    num_activities = len(activities)
                    
                    for activity in activities:
                        records.append({
                            "timestamp": timestamp,
                            "model": model,
                            "provider": provider,
                            "activity_type": activity,
                            "input_tokens": usage.get("input", 0) // num_activities,
                            "output_tokens": usage.get("output", 0) // num_activities,
                            "cache_read_tokens": usage.get("cacheRead", 0) // num_activities,
                            "cache_write_tokens": usage.get("cacheWrite", 0) // num_activities,
                            "total_tokens": usage.get("totalTokens", 0) // num_activities,
                            "cost_usd": cost_data.get("total", 0) / num_activities,
                        })
    
    except Exception as e:
        print(f"Error parsing {filepath}: {e}", file=sys.stderr)
    
    return records


def find_session_files(sessions_dir: Path) -> List[tuple]:
    """
    Find all session JSONL files and their session keys.
    Returns list of (session_key, filepath) tuples.
    """
    session_files = []
    
    # Walk through agents directory structure
    # Structure: agents/<agent_id>/sessions/<session_id>.jsonl
    for agent_dir in sessions_dir.iterdir():
        if not agent_dir.is_dir():
            continue
        
        sessions_path = agent_dir / "sessions"
        if not sessions_path.exists():
            continue
        
        # Try to load sessions.json for key mapping
        sessions_index = sessions_path / "sessions.json"
        key_to_file = {}
        
        if sessions_index.exists():
            try:
                with open(sessions_index) as f:
                    index_data = json.load(f)
                for key, data in index_data.items():
                    if isinstance(data, dict):
                        session_id = data.get("sessionId", "")
                        session_file = data.get("sessionFile", "")
                        channel = data.get("lastChannel", "unknown")
                        if session_file:
                            key_to_file[Path(session_file).name] = (key, channel)
                        elif session_id:
                            key_to_file[f"{session_id}.jsonl"] = (key, channel)
            except Exception:
                pass
        
        # Find all JSONL files
        for jsonl_file in sessions_path.glob("*.jsonl"):
            if ".deleted." in jsonl_file.name:
                continue
            
            filename = jsonl_file.name
            if filename in key_to_file:
                session_key, channel = key_to_file[filename]
            else:
                session_key = f"agent:{agent_dir.name}:{filename.replace('.jsonl', '')}"
                channel = "unknown"
            
            session_files.append((session_key, channel, jsonl_file))
    
    return session_files


def aggregate_by_hour(records: List[Dict[str, Any]], session_key: str, channel: str) -> Dict[str, Dict[str, Any]]:
    """
    Aggregate records by hour and activity type.
    Returns dict keyed by (hour, activity_type).
    """
    aggregates = defaultdict(lambda: {
        "request_count": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
    })
    
    for record in records:
        # Create hour bucket
        ts = record["timestamp"]
        hour_bucket = ts.replace(minute=0, second=0, microsecond=0)
        hour_key = (
            hour_bucket.isoformat(),
            session_key,
            channel,
            record["model"],
            record["provider"],
            record["activity_type"]
        )
        
        agg = aggregates[hour_key]
        agg["request_count"] += 1
        agg["input_tokens"] += record["input_tokens"]
        agg["output_tokens"] += record["output_tokens"]
        agg["cache_read_tokens"] += record["cache_read_tokens"]
        agg["cache_write_tokens"] += record["cache_write_tokens"]
        agg["total_tokens"] += record["total_tokens"]
        agg["cost_usd"] += record["cost_usd"]
    
    return aggregates


def export_to_csv(all_aggregates: Dict[str, Dict[str, Any]], export_dir: Path, date_str: str):
    """
    Write aggregated data to CSV file.
    """
    export_dir.mkdir(parents=True, exist_ok=True)
    output_file = export_dir / f"{date_str}.csv"
    
    rows = []
    for key, agg in all_aggregates.items():
        timestamp_hour, session_key, channel, model, provider, activity_type = key
        
        # Parse hour for convenience columns
        try:
            ts = datetime.fromisoformat(timestamp_hour.replace("Z", "+00:00"))
            date = ts.strftime("%Y-%m-%d")
            hour = ts.hour
        except ValueError:
            date = date_str
            hour = 0
        
        rows.append({
            "timestamp_hour": timestamp_hour,
            "date": date,
            "hour": hour,
            "session_key": session_key,
            "channel": channel,
            "model": model,
            "provider": provider,
            "activity_type": activity_type,
            "request_count": agg["request_count"],
            "input_tokens": agg["input_tokens"],
            "output_tokens": agg["output_tokens"],
            "cache_read_tokens": agg["cache_read_tokens"],
            "cache_write_tokens": agg["cache_write_tokens"],
            "total_tokens": agg["total_tokens"],
            "cost_usd": round(agg["cost_usd"], 6),
        })
    
    # Sort by timestamp, then session, then activity
    rows.sort(key=lambda r: (r["timestamp_hour"], r["session_key"], r["activity_type"]))
    
    # Write CSV
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"Exported {len(rows)} rows to {output_file}")
    return output_file


def main():
    parser = argparse.ArgumentParser(description="Export OpenClaw usage data to CSV")
    parser.add_argument("--date", help="Export specific date (YYYY-MM-DD)")
    parser.add_argument("--today", action="store_true", help="Export today's data")
    parser.add_argument("--from", dest="from_date", help="Start date for range export")
    parser.add_argument("--to", dest="to_date", help="End date for range export")
    parser.add_argument("--sessions-dir", help="Sessions directory path")
    parser.add_argument("--export-dir", help="Export output directory")
    parser.add_argument("--quiet", "-q", action="store_true", help="Suppress output")
    
    args = parser.parse_args()
    
    # Determine paths
    sessions_dir = Path(args.sessions_dir) if args.sessions_dir else Path(
        os.environ.get("USAGE_EXPORT_SESSIONS", DEFAULT_SESSIONS_DIR)
    )
    export_dir = Path(args.export_dir) if args.export_dir else Path(
        os.environ.get("USAGE_EXPORT_DIR", DEFAULT_EXPORT_DIR)
    )
    
    # Determine date(s) to export
    if args.today:
        dates = [datetime.now(timezone.utc).strftime("%Y-%m-%d")]
    elif args.date:
        dates = [args.date]
    elif args.from_date and args.to_date:
        start = datetime.strptime(args.from_date, "%Y-%m-%d")
        end = datetime.strptime(args.to_date, "%Y-%m-%d")
        dates = []
        current = start
        while current <= end:
            dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    else:
        # Default to today
        dates = [datetime.now(timezone.utc).strftime("%Y-%m-%d")]
    
    if not args.quiet:
        print(f"Sessions directory: {sessions_dir}")
        print(f"Export directory: {export_dir}")
        print(f"Dates to export: {', '.join(dates)}")
    
    # Find session files
    session_files = find_session_files(sessions_dir)
    if not args.quiet:
        print(f"Found {len(session_files)} session files")
    
    # Process each date
    for date_str in dates:
        if not args.quiet:
            print(f"\nProcessing {date_str}...")
        
        all_aggregates = {}
        
        for session_key, channel, filepath in session_files:
            records = parse_session_file(filepath, target_date=date_str)
            if records:
                aggregates = aggregate_by_hour(records, session_key, channel)
                all_aggregates.update(aggregates)
        
        if all_aggregates:
            export_to_csv(all_aggregates, export_dir, date_str)
        elif not args.quiet:
            print(f"No data found for {date_str}")


if __name__ == "__main__":
    main()

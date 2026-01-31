#!/usr/bin/env python3
"""
Granola CSV Export Parser

Parse and search Granola meeting notes exported as CSV.
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from datetime import datetime


def parse_granola_csv(file_path: str) -> list[dict]:
    """Parse a Granola CSV export file."""
    notes = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            note = {
                'title': row.get('title', row.get('Title', '')),
                'summary': row.get('summary', row.get('Summary', row.get('note_summary', ''))),
                'date': row.get('date', row.get('Date', row.get('meeting_date', ''))),
                'attendees': row.get('attendees', row.get('Attendees', '')),
                'duration': row.get('duration', row.get('Duration', '')),
                'tags': row.get('tags', row.get('Tags', '')),
            }
            # Clean up empty fields
            note = {k: v for k, v in note.items() if v}
            if note.get('title') or note.get('summary'):
                notes.append(note)
    
    return notes


def search_notes(notes: list[dict], query: str) -> list[dict]:
    """Search notes by query string."""
    query_lower = query.lower()
    results = []
    
    for note in notes:
        searchable = ' '.join(str(v) for v in note.values()).lower()
        if query_lower in searchable:
            results.append(note)
    
    return results


def format_note(note: dict) -> str:
    """Format a note for display."""
    lines = []
    if note.get('title'):
        lines.append(f"## {note['title']}")
    if note.get('date'):
        lines.append(f"**Date:** {note['date']}")
    if note.get('attendees'):
        lines.append(f"**Attendees:** {note['attendees']}")
    if note.get('duration'):
        lines.append(f"**Duration:** {note['duration']}")
    if note.get('summary'):
        lines.append(f"\n{note['summary']}")
    if note.get('tags'):
        lines.append(f"\n*Tags: {note['tags']}*")
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Parse Granola CSV exports')
    parser.add_argument('--file', '-f', required=True, help='Path to Granola CSV export')
    parser.add_argument('--search', '-s', help='Search query')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    parser.add_argument('--limit', '-l', type=int, default=10, help='Max results to show')
    
    args = parser.parse_args()
    
    if not Path(args.file).exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)
    
    notes = parse_granola_csv(args.file)
    print(f"Parsed {len(notes)} notes from Granola export", file=sys.stderr)
    
    if args.search:
        notes = search_notes(notes, args.search)
        print(f"Found {len(notes)} notes matching '{args.search}'", file=sys.stderr)
    
    # Limit results
    notes = notes[:args.limit]
    
    if args.json:
        print(json.dumps(notes, indent=2))
    else:
        for i, note in enumerate(notes):
            if i > 0:
                print("\n---\n")
            print(format_note(note))


if __name__ == '__main__':
    main()

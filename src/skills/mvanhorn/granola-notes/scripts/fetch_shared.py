#!/usr/bin/env python3
"""
Granola Shared Note Fetcher

Fetch and parse publicly shared Granola notes.
"""

import argparse
import json
import re
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError


def fetch_shared_note(url: str) -> dict:
    """Fetch a shared Granola note from its public URL."""
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except HTTPError as e:
        raise Exception(f"HTTP Error {e.code}: {e.reason}")
    except URLError as e:
        raise Exception(f"URL Error: {e.reason}")
    
    # Try to extract note data from the page
    note = {
        'url': url,
        'title': None,
        'content': None,
        'date': None,
    }
    
    # Extract title from <title> tag or og:title
    title_match = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)
    if title_match:
        note['title'] = title_match.group(1).strip()
        # Clean up " | Granola" suffix
        if ' | Granola' in note['title']:
            note['title'] = note['title'].split(' | Granola')[0]
    
    # Try og:title as fallback
    og_title = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    if og_title and not note['title']:
        note['title'] = og_title.group(1)
    
    # Extract description/summary
    og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', html)
    if og_desc:
        note['content'] = og_desc.group(1)
    
    # Try to find main content (this is approximate - depends on Granola's HTML structure)
    # Look for common content containers
    content_patterns = [
        r'<article[^>]*>(.*?)</article>',
        r'<main[^>]*>(.*?)</main>',
        r'<div class="[^"]*content[^"]*"[^>]*>(.*?)</div>',
        r'<div class="[^"]*note[^"]*"[^>]*>(.*?)</div>',
    ]
    
    for pattern in content_patterns:
        match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
        if match:
            # Strip HTML tags for plain text
            content = re.sub(r'<[^>]+>', ' ', match.group(1))
            content = re.sub(r'\s+', ' ', content).strip()
            if len(content) > 100:  # Only use if substantial
                note['content'] = content[:5000]  # Limit length
                break
    
    return note


def format_note(note: dict) -> str:
    """Format a note for display."""
    lines = []
    
    if note.get('title'):
        lines.append(f"# {note['title']}")
    
    if note.get('date'):
        lines.append(f"**Date:** {note['date']}")
    
    lines.append(f"**URL:** {note.get('url', 'N/A')}")
    
    if note.get('content'):
        lines.append(f"\n{note['content']}")
    
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Fetch shared Granola notes')
    parser.add_argument('--url', '-u', required=True, help='Shared note URL')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    
    # Validate URL
    if not ('granola' in args.url or 'share' in args.url):
        print("Warning: URL doesn't look like a Granola share link", file=sys.stderr)
    
    try:
        note = fetch_shared_note(args.url)
        
        if args.json:
            print(json.dumps(note, indent=2))
        else:
            print(format_note(note))
            
    except Exception as e:
        print(f"Error fetching note: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

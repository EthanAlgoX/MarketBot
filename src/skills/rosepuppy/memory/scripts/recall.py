#!/usr/bin/env python3
"""
Memory Recall - Search memory files for relevant context.

Usage:
    recall.py "what did we decide about X"
    recall.py --recent 7  # only search last 7 days
    recall.py --topic preferences  # search specific topic file
"""

import argparse
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

# Find workspace root
def find_workspace():
    current = Path.cwd()
    for parent in [current] + list(current.parents):
        if (parent / "MEMORY.md").exists() or (parent / "memory").is_dir():
            return parent
    return Path.home() / "clawd"

WORKSPACE = find_workspace()
MEMORY_DIR = WORKSPACE / "memory"
TOPICS_DIR = MEMORY_DIR / "topics"
MEMORY_MD = WORKSPACE / "MEMORY.md"

def tokenize(text):
    """Simple tokenization - lowercase words."""
    return set(re.findall(r'\b[a-z]+\b', text.lower()))

def score_match(query_tokens, text, age_days=0):
    """
    Score how well text matches query.
    Higher = better match.
    Includes time decay (recent = higher score).
    """
    text_tokens = tokenize(text)
    
    # Count matching tokens
    matches = len(query_tokens & text_tokens)
    if matches == 0:
        return 0
    
    # Ratio of query tokens found
    coverage = matches / len(query_tokens) if query_tokens else 0
    
    # Time decay: halve score every 30 days
    time_factor = 1.0 / (1.0 + (age_days / 30))
    
    return coverage * time_factor

def parse_daily_log(filepath):
    """Parse a daily log file into timestamped entries."""
    entries = []
    try:
        content = filepath.read_text()
    except:
        return entries
    
    # Extract date from filename
    date_match = re.match(r'(\d{4}-\d{2}-\d{2})', filepath.name)
    if not date_match:
        return entries
    
    file_date = date_match.group(1)
    
    # Parse entries by ## timestamp headers
    current_time = None
    current_facts = []
    
    for line in content.split('\n'):
        if line.startswith('## '):
            # Save previous entry
            if current_time and current_facts:
                entries.append({
                    'date': file_date,
                    'time': current_time,
                    'facts': current_facts,
                    'source': str(filepath)
                })
            current_time = line[3:].strip()
            current_facts = []
        elif line.startswith('- '):
            current_facts.append(line[2:])
    
    # Don't forget last entry
    if current_time and current_facts:
        entries.append({
            'date': file_date,
            'time': current_time,
            'facts': current_facts,
            'source': str(filepath)
        })
    
    return entries

def search_daily_logs(query_tokens, days_back=None):
    """Search daily log files."""
    results = []
    today = datetime.now(timezone.utc).date()
    
    if not MEMORY_DIR.exists():
        return results
    
    for log_file in sorted(MEMORY_DIR.glob("*.md"), reverse=True):
        # Skip non-date files
        date_match = re.match(r'(\d{4}-\d{2}-\d{2})', log_file.name)
        if not date_match:
            continue
        
        file_date = datetime.strptime(date_match.group(1), "%Y-%m-%d").date()
        age_days = (today - file_date).days
        
        # Skip if too old
        if days_back and age_days > days_back:
            continue
        
        entries = parse_daily_log(log_file)
        
        for entry in entries:
            # Score each fact
            for fact in entry['facts']:
                score = score_match(query_tokens, fact, age_days)
                if score > 0.2:  # Minimum threshold
                    results.append({
                        'text': fact,
                        'date': entry['date'],
                        'time': entry['time'],
                        'score': score,
                        'source': entry['source']
                    })
    
    return results

def search_memory_md(query_tokens):
    """Search MEMORY.md."""
    results = []
    
    if not MEMORY_MD.exists():
        return results
    
    content = MEMORY_MD.read_text()
    
    # Split into sections
    sections = re.split(r'\n##\s+', content)
    
    for section in sections:
        lines = section.strip().split('\n')
        if not lines:
            continue
        
        section_title = lines[0].strip('#').strip()
        section_text = '\n'.join(lines[1:])
        
        # Score section
        score = score_match(query_tokens, section_text, age_days=0)
        if score > 0.15:
            results.append({
                'text': section_text[:500] + ('...' if len(section_text) > 500 else ''),
                'section': section_title,
                'score': score,
                'source': str(MEMORY_MD)
            })
    
    return results

def search_topics(query_tokens, topic=None):
    """Search topic files."""
    results = []
    
    if not TOPICS_DIR.exists():
        return results
    
    files = [TOPICS_DIR / f"{topic}.md"] if topic else TOPICS_DIR.glob("*.md")
    
    for topic_file in files:
        if not topic_file.exists():
            continue
        
        content = topic_file.read_text()
        topic_name = topic_file.stem
        
        score = score_match(query_tokens, content, age_days=0)
        if score > 0.2:
            results.append({
                'text': content[:500] + ('...' if len(content) > 500 else ''),
                'topic': topic_name,
                'score': score,
                'source': str(topic_file)
            })
    
    return results

def format_results(results, max_results=10):
    """Format search results for display."""
    if not results:
        return "No matching memories found."
    
    # Sort by score descending
    results = sorted(results, key=lambda x: x['score'], reverse=True)[:max_results]
    
    output = []
    for r in results:
        header = []
        if 'date' in r:
            header.append(f"{r['date']} {r.get('time', '')}")
        if 'section' in r:
            header.append(f"[MEMORY.md: {r['section']}]")
        if 'topic' in r:
            header.append(f"[topic: {r['topic']}]")
        
        header_str = ' '.join(header) if header else r.get('source', 'unknown')
        
        output.append(f"**{header_str}** (score: {r['score']:.2f})")
        output.append(f"  {r['text']}")
        output.append("")
    
    return '\n'.join(output)

def main():
    parser = argparse.ArgumentParser(description="Search memories")
    parser.add_argument("query", nargs="?", help="Search query")
    parser.add_argument("--recent", "-r", type=int, help="Only search last N days")
    parser.add_argument("--topic", "-t", help="Search specific topic file")
    parser.add_argument("--max", "-m", type=int, default=10, help="Max results")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    if not args.query:
        print("Usage: recall.py 'search query'")
        return
    
    query_tokens = tokenize(args.query)
    
    if not query_tokens:
        print("No searchable terms in query")
        return
    
    # Search all sources
    results = []
    
    if args.topic:
        results.extend(search_topics(query_tokens, args.topic))
    else:
        results.extend(search_daily_logs(query_tokens, args.recent))
        results.extend(search_memory_md(query_tokens))
        results.extend(search_topics(query_tokens))
    
    if args.json:
        import json
        print(json.dumps(results, indent=2))
    else:
        print(format_results(results, args.max))

if __name__ == "__main__":
    main()

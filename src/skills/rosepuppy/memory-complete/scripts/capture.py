#!/usr/bin/env python3
"""
Memory Capture - Extract and store facts from conversations.

Usage:
    capture.py "text to remember"
    capture.py --file /path/to/file.txt
    capture.py --facts "fact1" "fact2" "fact3"
"""

import argparse
import os
import re
from datetime import datetime, timezone
from pathlib import Path

# Find workspace root (look for MEMORY.md or memory/ directory)
def find_workspace():
    current = Path.cwd()
    for parent in [current] + list(current.parents):
        if (parent / "MEMORY.md").exists() or (parent / "memory").is_dir():
            return parent
    # Default to home clawd directory
    return Path.home() / "clawd"

WORKSPACE = find_workspace()
MEMORY_DIR = WORKSPACE / "memory"
TOPICS_DIR = MEMORY_DIR / "topics"

def ensure_dirs():
    """Create memory directories if they don't exist."""
    MEMORY_DIR.mkdir(exist_ok=True)
    TOPICS_DIR.mkdir(exist_ok=True)

def get_daily_log_path():
    """Get path to today's daily log."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return MEMORY_DIR / f"{today}.md"

def extract_facts_simple(text):
    """
    Simple fact extraction without LLM.
    Looks for patterns like:
    - Decisions: "decided", "agreed", "chose"
    - Preferences: "prefer", "like", "want"
    - Facts: "is", "are", "has"
    - Todos: "todo", "need to", "should"
    """
    facts = []
    
    # Split into sentences
    sentences = re.split(r'[.!?]\s+', text)
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or len(sentence) < 10:
            continue
            
        # Categorize by keywords
        lower = sentence.lower()
        
        if any(kw in lower for kw in ['decided', 'agreed', 'decision', 'chose', 'choice']):
            facts.append(f"[decision] {sentence}")
        elif any(kw in lower for kw in ['todo', 'need to', 'should', 'must', 'will']):
            facts.append(f"[todo] {sentence}")
        elif any(kw in lower for kw in ['prefer', 'like', 'want', 'love', 'hate']):
            facts.append(f"[preference] {sentence}")
        elif any(kw in lower for kw in ['learned', 'realized', 'discovered', 'found out']):
            facts.append(f"[insight] {sentence}")
        elif any(kw in lower for kw in ['important', 'critical', 'key', 'remember']):
            facts.append(f"[important] {sentence}")
    
    return facts

def append_to_daily_log(facts, raw_text=None):
    """Append facts to today's daily log."""
    log_path = get_daily_log_path()
    timestamp = datetime.now(timezone.utc).strftime("%H:%M UTC")
    
    # Create or append to log
    if not log_path.exists():
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        content = f"# {date_str}\n\n"
    else:
        content = log_path.read_text()
        if not content.endswith("\n\n"):
            content = content.rstrip() + "\n\n"
    
    # Add new entry
    content += f"## {timestamp}\n"
    
    if facts:
        for fact in facts:
            content += f"- {fact}\n"
    elif raw_text:
        # If no facts extracted, store as raw note
        content += f"- [note] {raw_text[:500]}{'...' if len(raw_text) > 500 else ''}\n"
    
    content += "\n"
    log_path.write_text(content)
    
    return log_path, len(facts)

def main():
    parser = argparse.ArgumentParser(description="Capture memories from text")
    parser.add_argument("text", nargs="?", help="Text to extract memories from")
    parser.add_argument("--file", "-f", help="Read text from file")
    parser.add_argument("--facts", nargs="+", help="Store specific facts directly")
    parser.add_argument("--raw", action="store_true", help="Store raw text without extraction")
    
    args = parser.parse_args()
    
    ensure_dirs()
    
    # Get input text
    if args.facts:
        # Direct facts provided
        facts = args.facts
        log_path, count = append_to_daily_log(facts)
        print(f"✓ Stored {count} facts in {log_path}")
        return
    
    if args.file:
        text = Path(args.file).read_text()
    elif args.text:
        text = args.text
    else:
        # Read from stdin
        import sys
        text = sys.stdin.read()
    
    if not text.strip():
        print("No text provided")
        return
    
    if args.raw:
        log_path, _ = append_to_daily_log([], raw_text=text)
        print(f"✓ Stored raw note in {log_path}")
        return
    
    # Extract facts
    facts = extract_facts_simple(text)
    
    if facts:
        log_path, count = append_to_daily_log(facts)
        print(f"✓ Extracted {count} facts → {log_path}")
        for fact in facts:
            print(f"  {fact}")
    else:
        # Store as raw if no facts extracted
        log_path, _ = append_to_daily_log([], raw_text=text)
        print(f"✓ No structured facts found, stored as note in {log_path}")

if __name__ == "__main__":
    main()

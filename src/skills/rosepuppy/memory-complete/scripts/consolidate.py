#!/usr/bin/env python3
"""
Memory Consolidation - Periodic maintenance of memory files.

Usage:
    consolidate.py              # Full consolidation
    consolidate.py --dry-run    # Show what would be done
    consolidate.py --stats      # Show memory statistics
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

def get_all_facts():
    """Extract all facts from daily logs."""
    facts = []
    
    if not MEMORY_DIR.exists():
        return facts
    
    for log_file in sorted(MEMORY_DIR.glob("*.md")):
        date_match = re.match(r'(\d{4}-\d{2}-\d{2})', log_file.name)
        if not date_match:
            continue
        
        file_date = date_match.group(1)
        content = log_file.read_text()
        
        for line in content.split('\n'):
            if line.startswith('- '):
                fact = line[2:].strip()
                # Extract category if present
                cat_match = re.match(r'\[(\w+)\]\s*(.+)', fact)
                if cat_match:
                    category = cat_match.group(1)
                    text = cat_match.group(2)
                else:
                    category = 'note'
                    text = fact
                
                facts.append({
                    'date': file_date,
                    'category': category,
                    'text': text,
                    'source': str(log_file)
                })
    
    return facts

def find_duplicates(facts, threshold=0.8):
    """Find near-duplicate facts using simple similarity."""
    from difflib import SequenceMatcher
    
    duplicates = []
    seen = []
    
    for i, fact in enumerate(facts):
        for j, other in enumerate(seen):
            ratio = SequenceMatcher(None, 
                fact['text'].lower(), 
                other['text'].lower()
            ).ratio()
            
            if ratio > threshold:
                duplicates.append((fact, other, ratio))
                break
        else:
            seen.append(fact)
    
    return duplicates

def get_stats():
    """Get memory statistics."""
    facts = get_all_facts()
    
    # Count by category
    by_category = defaultdict(int)
    for f in facts:
        by_category[f['category']] += 1
    
    # Count by date
    by_date = defaultdict(int)
    for f in facts:
        by_date[f['date']] += 1
    
    # Find date range
    dates = sorted(by_date.keys())
    
    # Count files
    daily_logs = list(MEMORY_DIR.glob("*.md")) if MEMORY_DIR.exists() else []
    topic_files = list(TOPICS_DIR.glob("*.md")) if TOPICS_DIR.exists() else []
    
    # MEMORY.md size
    memory_md_size = MEMORY_MD.stat().st_size if MEMORY_MD.exists() else 0
    
    return {
        'total_facts': len(facts),
        'by_category': dict(by_category),
        'daily_logs': len([f for f in daily_logs if re.match(r'\d{4}-\d{2}-\d{2}', f.name)]),
        'topic_files': len(topic_files),
        'date_range': (dates[0], dates[-1]) if dates else (None, None),
        'memory_md_bytes': memory_md_size
    }

def identify_stale(facts, days=90):
    """Find facts older than N days."""
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=days)
    
    stale = []
    for f in facts:
        fact_date = datetime.strptime(f['date'], "%Y-%m-%d").date()
        if fact_date < cutoff:
            stale.append(f)
    
    return stale

def generate_summary_updates(facts):
    """
    Analyze recent facts and suggest updates to MEMORY.md.
    Returns suggestions as text.
    """
    # Get facts from last 7 days
    today = datetime.now(timezone.utc).date()
    week_ago = today - timedelta(days=7)
    
    recent = [f for f in facts 
              if datetime.strptime(f['date'], "%Y-%m-%d").date() >= week_ago]
    
    if not recent:
        return None
    
    # Group by category
    by_cat = defaultdict(list)
    for f in recent:
        by_cat[f['category']].append(f)
    
    suggestions = []
    
    # Highlight decisions
    if by_cat['decision']:
        suggestions.append("**Recent Decisions:**")
        for f in by_cat['decision'][-5:]:  # Last 5
            suggestions.append(f"- {f['text']} ({f['date']})")
    
    # Highlight insights
    if by_cat['insight']:
        suggestions.append("\n**Recent Insights:**")
        for f in by_cat['insight'][-5:]:
            suggestions.append(f"- {f['text']} ({f['date']})")
    
    # Highlight important items
    if by_cat['important']:
        suggestions.append("\n**Marked Important:**")
        for f in by_cat['important']:
            suggestions.append(f"- {f['text']} ({f['date']})")
    
    return '\n'.join(suggestions) if suggestions else None

def run_consolidation(dry_run=False):
    """Run full consolidation."""
    print("🧠 Memory Consolidation")
    print("=" * 40)
    
    facts = get_all_facts()
    print(f"Total facts: {len(facts)}")
    
    # Find duplicates
    print("\n📋 Checking for duplicates...")
    duplicates = find_duplicates(facts)
    if duplicates:
        print(f"Found {len(duplicates)} potential duplicates:")
        for f1, f2, ratio in duplicates[:5]:  # Show first 5
            print(f"  ~{ratio:.0%} similar:")
            print(f"    - {f1['text'][:60]}... ({f1['date']})")
            print(f"    - {f2['text'][:60]}... ({f2['date']})")
    else:
        print("  No duplicates found")
    
    # Find stale facts
    print("\n📅 Checking for stale facts (>90 days)...")
    stale = identify_stale(facts)
    if stale:
        print(f"Found {len(stale)} stale facts")
        if not dry_run:
            print("  (Consider archiving old daily logs)")
    else:
        print("  No stale facts")
    
    # Generate summary suggestions
    print("\n📝 Analyzing recent activity...")
    suggestions = generate_summary_updates(facts)
    if suggestions:
        print("Suggested MEMORY.md updates:")
        print("-" * 30)
        print(suggestions)
        print("-" * 30)
    else:
        print("  No recent activity to summarize")
    
    # Stats
    stats = get_stats()
    print(f"\n📊 Stats:")
    print(f"  Daily logs: {stats['daily_logs']}")
    print(f"  Topic files: {stats['topic_files']}")
    print(f"  MEMORY.md: {stats['memory_md_bytes']} bytes")
    print(f"  Categories: {stats['by_category']}")
    
    if dry_run:
        print("\n[DRY RUN - no changes made]")
    
    return {
        'facts': len(facts),
        'duplicates': len(duplicates),
        'stale': len(stale),
        'has_suggestions': suggestions is not None
    }

def main():
    parser = argparse.ArgumentParser(description="Consolidate memories")
    parser.add_argument("--dry-run", "-n", action="store_true", 
                        help="Show what would be done without making changes")
    parser.add_argument("--stats", "-s", action="store_true",
                        help="Show statistics only")
    
    args = parser.parse_args()
    
    MEMORY_DIR.mkdir(exist_ok=True)
    TOPICS_DIR.mkdir(exist_ok=True)
    
    if args.stats:
        stats = get_stats()
        print("📊 Memory Statistics")
        print("=" * 40)
        print(f"Total facts: {stats['total_facts']}")
        print(f"Daily logs: {stats['daily_logs']}")
        print(f"Topic files: {stats['topic_files']}")
        print(f"MEMORY.md: {stats['memory_md_bytes']} bytes")
        if stats['date_range'][0]:
            print(f"Date range: {stats['date_range'][0]} → {stats['date_range'][1]}")
        print(f"\nBy category:")
        for cat, count in sorted(stats['by_category'].items(), key=lambda x: -x[1]):
            print(f"  [{cat}]: {count}")
        return
    
    run_consolidation(dry_run=args.dry_run)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fetch a Bhagavad Gita slok from the vedicscriptures API.
Returns slok of the day (deterministic by date) or a specific/random slok.
"""

import argparse
import hashlib
import json
import sys
from datetime import date
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

API_BASE = "https://vedicscriptures.github.io"

# Bhagavad Gita: 18 chapters with verse counts
CHAPTERS = {
    1: 47,
    2: 72,
    3: 43,
    4: 42,
    5: 29,
    6: 47,
    7: 30,
    8: 28,
    9: 34,
    10: 42,
    11: 55,
    12: 20,
    13: 35,
    14: 27,
    15: 20,
    16: 24,
    17: 28,
    18: 78,
}
TOTAL_VERSES = sum(CHAPTERS.values())  # 700 verses


def get_verse_by_index(index: int) -> tuple[int, int]:
    """Convert a 0-based index (0-699) to (chapter, verse)."""
    index = index % TOTAL_VERSES
    cumulative = 0
    for ch, count in CHAPTERS.items():
        if index < cumulative + count:
            return ch, index - cumulative + 1
        cumulative += count
    return 18, 78  # fallback


def get_daily_verse() -> tuple[int, int]:
    """Get deterministic verse for today based on date hash."""
    today = date.today().isoformat()
    hash_int = int(hashlib.md5(today.encode()).hexdigest(), 16)
    return get_verse_by_index(hash_int % TOTAL_VERSES)


def fetch_slok(chapter: int, verse: int) -> dict:
    """Fetch slok data from the API."""
    url = f"{API_BASE}/slok/{chapter}/{verse}"
    try:
        with urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (URLError, HTTPError) as e:
        print(f"Error fetching slok: {e}", file=sys.stderr)
        sys.exit(1)


def format_slok(
    data: dict, translator: str = "prabhu", include_sanskrit: bool = True
) -> str:
    """Format slok for display."""
    lines = []

    ch = data.get("chapter", "?")
    vs = data.get("verse", "?")
    lines.append(f"📖 **Bhagavad Gita {ch}.{vs}**\n")

    if include_sanskrit and data.get("slok"):
        lines.append(f"*{data['slok']}*\n")

    if data.get("transliteration"):
        lines.append(f"🔤 {data['transliteration']}\n")

    # Get translation
    trans_data = data.get(translator) or data.get("prabhu") or data.get("siva")
    if trans_data:
        author = trans_data.get("author", "Unknown")
        translation = trans_data.get("et") or trans_data.get("ht", "")
        if translation:
            lines.append(f"🪷 **Translation** ({author}):\n{translation}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Fetch Bhagavad Gita slok")
    parser.add_argument("--chapter", "-c", type=int, help="Chapter number (1-18)")
    parser.add_argument("--verse", "-v", type=int, help="Verse number")
    parser.add_argument(
        "--daily", "-d", action="store_true", help="Get slok of the day"
    )
    parser.add_argument("--random", "-r", action="store_true", help="Get random slok")
    parser.add_argument(
        "--translator",
        "-t",
        default="prabhu",
        help="Translator key (prabhu, siva, purohit, gambir, etc.)",
    )
    parser.add_argument("--no-sanskrit", action="store_true", help="Omit Sanskrit text")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")

    args = parser.parse_args()

    # Determine which verse to fetch
    if args.chapter and args.verse:
        ch, vs = args.chapter, args.verse
    elif args.random:
        import random

        ch = random.randint(1, 18)
        vs = random.randint(1, CHAPTERS[ch])
    else:
        # Default: daily slok
        ch, vs = get_daily_verse()

    # Validate
    if ch < 1 or ch > 18:
        print("Error: Chapter must be 1-18", file=sys.stderr)
        sys.exit(1)
    if vs < 1 or vs > CHAPTERS.get(ch, 0):
        print(f"Error: Chapter {ch} has verses 1-{CHAPTERS[ch]}", file=sys.stderr)
        sys.exit(1)

    data = fetch_slok(ch, vs)

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(format_slok(data, args.translator, not args.no_sanskrit))


if __name__ == "__main__":
    main()

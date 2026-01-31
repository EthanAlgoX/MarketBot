#!/usr/bin/env python3
"""Local, low-risk summary of memory files.

This is *not* semantic search and does not call any LLM.
It just prints:
- recent daily entries (last N days)
- top headings from MEMORY.md
- last bullet points from MEMORY.md
"""

import argparse
from datetime import datetime, timedelta
from pathlib import Path
import re


def read_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def pick_headings(lines: list[str], limit: int = 20) -> list[str]:
    out = []
    for ln in lines:
        if ln.startswith("#"):
            out.append(ln)
        if len(out) >= limit:
            break
    return out


def pick_recent_bullets(lines: list[str], limit: int = 30) -> list[str]:
    bullets = []
    for ln in reversed(lines):
        if re.match(r"^\s*[-*]\s+", ln):
            bullets.append(ln)
        if len(bullets) >= limit:
            break
    return list(reversed(bullets))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", default=str(Path.cwd()))
    ap.add_argument("--days", type=int, default=2, help="How many days of daily logs")
    ap.add_argument("--max-lines", type=int, default=200, help="Max lines per daily file")
    args = ap.parse_args()

    ws = Path(args.workspace).expanduser().resolve()
    memdir = ws / "memory"
    longp = ws / "MEMORY.md"

    print("== MEMORY-LITE SUMMARY ==")
    print(f"Workspace: {ws}")

    # Long-term
    long_lines = read_lines(longp)
    if long_lines:
        print("\n-- MEMORY.md headings --")
        for h in pick_headings(long_lines, limit=25):
            print(h)

        recent = pick_recent_bullets(long_lines, limit=25)
        if recent:
            print("\n-- MEMORY.md recent bullets --")
            for b in recent:
                print(b)
    else:
        print("\n-- MEMORY.md --\n(missing or empty)")

    # Daily logs
    print("\n-- Daily logs --")
    today = datetime.now().date()
    for i in range(args.days):
        d = today - timedelta(days=i)
        p = memdir / f"{d:%Y-%m-%d}.md"
        lines = read_lines(p)
        if not lines:
            continue
        print(f"\n### {p.relative_to(ws)} ({len(lines)} lines)")
        for ln in lines[-args.max_lines :]:
            print(ln)


if __name__ == "__main__":
    main()

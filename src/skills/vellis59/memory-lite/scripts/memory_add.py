#!/usr/bin/env python3
import argparse
from datetime import datetime
from pathlib import Path


def ensure_memory_dir(workspace: Path) -> Path:
    d = workspace / "memory"
    d.mkdir(parents=True, exist_ok=True)
    return d


def append_line(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(text)
        if not text.endswith("\n"):
            f.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", default=str(Path.cwd()), help="Workspace root (default: cwd)")
    ap.add_argument("--kind", choices=["daily", "long"], required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--ts", action="store_true", help="Prefix with timestamp")
    args = ap.parse_args()

    workspace = Path(args.workspace).expanduser().resolve()
    now = datetime.now()

    if args.kind == "daily":
        memdir = ensure_memory_dir(workspace)
        target = memdir / f"{now:%Y-%m-%d}.md"
    else:
        target = workspace / "MEMORY.md"
        if not target.exists():
            append_line(target, "# MEMORY.md\n")

    prefix = f"[{now:%Y-%m-%d %H:%M}] " if args.ts else "- "
    # Keep daily logs append-only and easy to scan.
    line = prefix + args.text.strip()
    append_line(target, line)

    print(str(target))


if __name__ == "__main__":
    main()

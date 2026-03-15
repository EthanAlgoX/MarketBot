#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


POSITIVE = ("beat", "raised", "strong", "accelerat", "improv", "better than expected")
NEGATIVE = ("miss", "cut", "weaker", "soft", "declin", "below expectations")


def classify_text(text: str) -> dict[str, object]:
    lower = text.lower()
    positive_hits = [token for token in POSITIVE if token in lower]
    negative_hits = [token for token in NEGATIVE if token in lower]
    verdict = "mixed"
    if positive_hits and not negative_hits:
        verdict = "positive"
    elif negative_hits and not positive_hits:
        verdict = "negative"
    elif not positive_hits and not negative_hits:
        verdict = "neutral"

    guidance = "not provided"
    if "raised guidance" in lower or "guidance raised" in lower:
        guidance = "raised"
    elif "maintained guidance" in lower or "guidance maintained" in lower:
        guidance = "maintained"
    elif "cut guidance" in lower or "lowered guidance" in lower:
        guidance = "cut"

    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]
    return {
        "verdict": verdict,
        "guidance": guidance,
        "positive_hits": positive_hits,
        "negative_hits": negative_hits,
        "highlights": sentences[:5],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Lightweight earnings text readout")
    parser.add_argument("input", help="Path to a text or markdown file")
    args = parser.parse_args()

    path = Path(args.input)
    text = path.read_text(encoding="utf-8")
    print(json.dumps(classify_text(text), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

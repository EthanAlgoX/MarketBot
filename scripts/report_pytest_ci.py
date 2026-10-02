"""Expose pytest failures in GitHub checks without requiring log access."""

from __future__ import annotations

import html
import os
import sys
from pathlib import Path
from xml.etree import ElementTree


def escape_command(value: str, *, property_value: bool = False) -> str:
    value = value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    if property_value:
        value = value.replace(":", "%3A").replace(",", "%2C")
    return value


def report(path: Path) -> None:
    if not path.is_file():
        print("No pytest result file: the test step did not finish producing results.")
        return
    root = ElementTree.parse(path).getroot()
    cases = list(root.iter("testcase"))
    failures = []
    skipped = 0
    for case in cases:
        skipped += case.find("skipped") is not None
        for tag in ("failure", "error"):
            failure = case.find(tag)
            if failure is None:
                continue
            name = f"{case.get('classname', '')}::{case.get('name', '')}"
            detail = (failure.text or failure.get("message", "No failure details"))[:12000]
            failures.append((name, detail))
            print(
                f"::error title={escape_command(name, property_value=True)}::"
                f"{escape_command(detail)}"
            )
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        summary = f"### pytest\n\n{len(cases)} tests, {len(failures)} failures/errors, {skipped} skipped.\n"
        for name, detail in failures:
            summary += (
                f"\n<details><summary>{html.escape(name)}</summary>\n\n"
                f"<pre>{html.escape(detail)}</pre>\n\n</details>\n"
            )
        with Path(summary_path).open("a", encoding="utf-8") as stream:
            stream.write(summary)


if __name__ == "__main__":
    report(Path(sys.argv[1]))

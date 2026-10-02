"""Normalize source timestamps without inventing observation/publication times."""

from __future__ import annotations

import math
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any
from zoneinfo import ZoneInfo


def source_timestamp(value: Any, *, zone: str | None = None) -> str | None:
    """Accept Unix seconds or explicit source dates; naive dates need a known zone."""
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        if isinstance(value, (int, float)):
            if not math.isfinite(value) or value <= 0:
                return None
            stamp = datetime.fromtimestamp(value, UTC)
        else:
            raw = str(value).strip()
            if len(raw) == 14 and raw.isdigit():
                stamp = datetime.strptime(raw, "%Y%m%d%H%M%S")
            else:
                try:
                    stamp = datetime.fromisoformat(raw.replace("Z", "+00:00").replace("/", "-"))
                except ValueError:
                    stamp = parsedate_to_datetime(raw)
            if stamp.tzinfo is None:
                # A date alone does not establish a publication or quote instant.
                if not zone or len(raw) <= 10:
                    return None
                stamp = stamp.replace(tzinfo=ZoneInfo(zone))
        return stamp.astimezone(UTC).isoformat().replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError, OSError):
        return None

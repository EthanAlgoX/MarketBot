"""Dynamic scoring helpers for skill routing."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from marketbot.agent.skill_score_store import SkillScoreStore

_KEY_TOOLS = {
    "browser_site",
    "market_brief",
    "market_news",
    "market_snapshot",
    "market_macro",
    "market_social_sentiment",
    "thesis_tracker",
    "intel_search",
}
_DELTA_BY_OUTCOME = {
    "success": 0.20,
    "partial": 0.05,
    "failure": -0.30,
    "misroute": -0.40,
}


def utc_now_iso() -> str:
    """Current UTC timestamp in ISO-8601 format."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def parse_iso(text: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp into a datetime."""
    if not text:
        return None
    try:
        return datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None


def clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value into the given range."""
    return max(lower, min(upper, value))


def toolset_signature(available_tools: set[str] | None) -> str:
    """Build a stable, coarse tool signature for score bucketing."""
    if not available_tools:
        return "default"
    selected = sorted(name for name in available_tools if name in _KEY_TOOLS)
    return "+".join(selected) if selected else "default"


def primary_market(request_profile: dict[str, Any] | None) -> str:
    """Resolve the main market for score bucketing."""
    markets = [str(item).strip().lower() for item in (request_profile or {}).get("markets", []) if str(item).strip()]
    for candidate in ("a-share", "hong-kong", "us", "global", "mixed"):
        if candidate in markets:
            return candidate
    return "general"


def make_bucket_key(
    *,
    skill_name: str,
    task_type: str,
    request_profile: dict[str, Any] | None,
    available_tools: set[str] | None,
) -> str:
    """Create a stable score bucket key."""
    return "|".join(
        [
            str(skill_name or "").strip(),
            primary_market(request_profile),
            str(task_type or "").strip() or "general",
            toolset_signature(available_tools),
        ]
    )


def decay_score(record: dict[str, Any], *, now: datetime | None = None) -> float:
    """Apply lightweight time decay without mutating the underlying record."""
    score = float(record.get("score", 0.0) or 0.0)
    now_dt = now or datetime.now(UTC)
    last_used = parse_iso(record.get("lastUsedAt"))
    if last_used is None:
        return score
    age_days = max(0.0, (now_dt - last_used).total_seconds() / 86400.0)
    if age_days > 30:
        score *= 0.7
    elif age_days > 14:
        score *= 0.9
    return score


def effective_dynamic_score(record: dict[str, Any]) -> float:
    """Return the decayed score scaled by sample confidence."""
    total_events = sum(
        int(record.get(key, 0) or 0)
        for key in ("successCount", "partialCount", "failureCount", "misrouteCount")
    )
    confidence_factor = min(1.0, total_events / 10.0)
    return decay_score(record) * confidence_factor


def update_record(record: dict[str, Any], outcome: str) -> dict[str, Any]:
    """Apply one routing outcome to a score record."""
    normalized = str(outcome or "failure").strip().lower()
    delta = _DELTA_BY_OUTCOME.get(normalized, -0.30)
    now = utc_now_iso()
    score = clamp(float(record.get("score", 0.0) or 0.0) + delta, -3.0, 3.0)
    record["score"] = round(score, 4)
    record["lastUsedAt"] = now
    if normalized == "success":
        record["successCount"] = int(record.get("successCount", 0) or 0) + 1
        record["lastSuccessAt"] = now
    elif normalized == "partial":
        record["partialCount"] = int(record.get("partialCount", 0) or 0) + 1
    elif normalized == "misroute":
        record["misrouteCount"] = int(record.get("misrouteCount", 0) or 0) + 1
        record["lastFailureAt"] = now
    else:
        record["failureCount"] = int(record.get("failureCount", 0) or 0) + 1
        record["lastFailureAt"] = now
    return record


class SkillScorer:
    """High-level score reader/writer for skill routing."""

    def __init__(self, store: SkillScoreStore):
        self.store = store

    def get_record(self, bucket_key: str) -> dict[str, Any]:
        """Load one score record by key."""
        payload = self.store.load()
        buckets = payload.get("buckets", {})
        record = buckets.get(bucket_key, {})
        return dict(record) if isinstance(record, dict) else {}

    def get_effective_score(self, bucket_key: str) -> float:
        """Return the effective routing score for a bucket."""
        return effective_dynamic_score(self.get_record(bucket_key))

    def apply_outcome(self, bucket_key: str, outcome: str) -> dict[str, Any]:
        """Persist one score outcome to the target bucket."""
        payload = self.store.load()
        buckets = payload.setdefault("buckets", {})
        record = dict(buckets.get(bucket_key, {})) if isinstance(buckets.get(bucket_key, {}), dict) else {}
        buckets[bucket_key] = update_record(record, outcome)
        self.store.save(payload)
        return dict(buckets[bucket_key])

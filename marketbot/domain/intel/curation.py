"""Deterministic filtering and ranking for intel raw items."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from marketbot.domain.intel.models import IntelRawItem


def normalize_title(text: str) -> str:
    """Normalize a title for near-duplicate detection."""
    value = (text or "").strip().lower()
    value = re.sub(r"\s+", " ", value)
    return re.sub(r"[^a-z0-9\u4e00-\u9fff ]+", "", value)


def dedupe_by_url(items: list[IntelRawItem]) -> list[IntelRawItem]:
    """Keep only the first item for each URL."""
    seen: set[str] = set()
    result: list[IntelRawItem] = []
    for item in items:
        key = (item.url or "").strip()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        result.append(item)
    return _dedupe_by_title(result)


def _dedupe_by_title(items: list[IntelRawItem]) -> list[IntelRawItem]:
    seen: set[str] = set()
    result: list[IntelRawItem] = []
    for item in items:
        key = normalize_title(item.title)
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        result.append(item)
    return result


def score_item(item: IntelRawItem, *, preferred_keywords: list[str] | None = None) -> float:
    """Assign a simple deterministic quality score."""
    score = 0.0
    title = (item.title or "").strip()
    summary = (item.summary_text or item.content_text or "").strip()
    text = f"{title} {summary}".lower()

    if 20 <= len(title) <= 120:
        score += 2.0
    if summary:
        score += 1.0
    if item.published_at:
        score += 2.0
    if item.url:
        score += 1.0

    keywords = preferred_keywords or [
        "ai",
        "agent",
        "model",
        "chip",
        "gpu",
        "openai",
        "anthropic",
        "semiconductor",
    ]
    hits = sum(1 for keyword in keywords if keyword.lower() in text)
    score += min(3.0, float(hits))

    domain = urlparse(item.url or "").netloc.lower()
    if any(name in domain for name in ["openai", "anthropic", "github", "semianalysis", "stratechery"]):
        score += 1.5

    return round(score, 2)


def select_top_items(items: list[IntelRawItem], *, limit: int = 12) -> list[IntelRawItem]:
    """Sort items by score and recency and keep the top slice."""
    return sorted(
        items,
        key=lambda item: (item.quality_score, item.published_at or "", item.collected_at or ""),
        reverse=True,
    )[:limit]

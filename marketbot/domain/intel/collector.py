"""Source collectors for the intel domain."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import feedparser
import httpx

from marketbot.domain.intel.models import IntelRawItem, IntelSource


def utc_now_iso() -> str:
    """Return the current UTC timestamp."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def make_dedup_key(url: str, title: str, published_at: str | None) -> str:
    """Build a stable dedup key from item identity fields."""
    base = url.strip() or f"{title.strip()}|{published_at or ''}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _coerce_published(value: str) -> str | None:
    """Convert RFC-style published timestamps to ISO when possible."""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        dt = parsedate_to_datetime(text)
        return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
    except Exception:
        return text


class BaseIntelCollector:
    """Base class for source-specific collectors."""

    source_type: str

    async def collect(self, source: IntelSource) -> list[IntelRawItem]:
        raise NotImplementedError


class RssCollector(BaseIntelCollector):
    """Collect items from an RSS or Atom feed."""

    source_type = "rss"

    async def collect(self, source: IntelSource) -> list[IntelRawItem]:
        config = json.loads(source.config_json or "{}")
        url = str(config.get("url", "")).strip()
        if not url:
            raise ValueError("rss source missing url")
        parsed = feedparser.parse(url)
        if getattr(parsed, "bozo", 0) and not getattr(parsed, "entries", []):
            raise ValueError(f"feed parse failed: {parsed.bozo_exception}")

        now_iso = utc_now_iso()
        items: list[IntelRawItem] = []
        for entry in parsed.entries[:50]:
            title = str(getattr(entry, "title", "") or "").strip()
            link = str(getattr(entry, "link", "") or "").strip()
            author = str(getattr(entry, "author", "") or "").strip()
            summary = str(getattr(entry, "summary", "") or "").strip()
            published_at = _coerce_published(
                str(getattr(entry, "published", "") or getattr(entry, "updated", "") or "")
            )
            items.append(
                IntelRawItem(
                    source_id=int(source.id or 0),
                    title=title,
                    url=link,
                    author=author,
                    published_at=published_at,
                    collected_at=now_iso,
                    content_text=summary,
                    summary_text=summary[:500],
                    dedup_key=make_dedup_key(link, title, published_at),
                    metadata_json=json.dumps({"sourceType": self.source_type}, ensure_ascii=False),
                )
            )
        return items


class WebsiteCollector(BaseIntelCollector):
    """Collect content from a single webpage URL."""

    source_type = "website"

    async def collect(self, source: IntelSource) -> list[IntelRawItem]:
        config = json.loads(source.config_json or "{}")
        url = str(config.get("url", "")).strip()
        if not url:
            raise ValueError("website source missing url")
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "MarketBot/1.0"})
            response.raise_for_status()

        body = response.text[:20000]
        final_url = str(response.url)
        now_iso = utc_now_iso()
        return [
            IntelRawItem(
                source_id=int(source.id or 0),
                title=config.get("title") or final_url,
                url=final_url,
                collected_at=now_iso,
                content_text=body,
                summary_text=body[:500],
                dedup_key=make_dedup_key(final_url, final_url, None),
                metadata_json=json.dumps(
                    {"sourceType": self.source_type, "statusCode": response.status_code},
                    ensure_ascii=False,
                ),
            )
        ]


class IntelCollectorService:
    """Dispatch collection requests to the appropriate source adapter."""

    def __init__(self, adapters: list[BaseIntelCollector] | None = None):
        default_adapters = adapters or [RssCollector(), WebsiteCollector()]
        self._adapters = {adapter.source_type: adapter for adapter in default_adapters}

    async def collect_source(self, source: IntelSource) -> list[IntelRawItem]:
        """Collect items for a single source."""
        adapter = self._adapters.get(source.source_type)
        if not adapter:
            raise ValueError(f"unsupported source type: {source.source_type}")
        return await adapter.collect(source)

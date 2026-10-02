"""Daily digest generation for collected intel items."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from marketbot.domain.intel.curation import dedupe_by_url, score_item, select_top_items
from marketbot.domain.intel.models import IntelDigest, IntelRawItem
from marketbot.domain.intel.storage import create_digest, list_recent_raw_items
from marketbot.i18n import msg


def render_digest_markdown(
    *,
    title: str,
    items: list[IntelRawItem],
    window_start: str,
    window_end: str,
    language: str = "en",
) -> str:
    """Render a concise markdown digest document."""
    lines = [
        f"# {title}",
        "",
        msg("## Summary", "## 摘要", language),
        f"- {msg('Window', '时间范围', language)}: {window_start} -> {window_end}",
        f"- {msg('Items', '条目数', language)}: {len(items)}",
        "",
        msg("## Top Items", "## 主要条目", language),
        "",
    ]
    if not items:
        lines.append(
            msg(
                "- No qualifying items were collected in this window.",
                "- 当前时间范围内没有符合条件的条目。",
                language,
            )
        )
        lines.append("")
        return "\n".join(lines).rstrip() + "\n"

    for idx, item in enumerate(items, 1):
        summary = (item.summary_text or item.content_text or "").strip().replace("\n", " ")
        lines.extend(
            [
                f"### {idx}. {item.title or msg('(untitled)', '（无标题）', language)}",
                f"- {msg('Score', '评分', language)}: {item.quality_score:.1f}",
                f"- {msg('Link', '链接', language)}: {item.url or 'N/A'}",
                f"- {msg('Summary', '摘要', language)}: {summary[:240]}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def build_daily_digest(
    conn,
    *,
    scope: str = "workspace",
    scope_key: str = "",
    now: datetime | None = None,
    hours: int = 24,
    limit: int = 12,
    language: str = "en",
) -> int:
    """Build and persist a daily digest for recent items in a scope."""
    now = now or datetime.now(UTC)
    since = now - timedelta(hours=hours)
    now_iso = now.isoformat().replace("+00:00", "Z")
    since_iso = since.isoformat().replace("+00:00", "Z")

    items = list_recent_raw_items(
        conn,
        scope=scope,
        scope_key=scope_key,
        since_iso=since_iso,
        limit=500,
    )
    items = dedupe_by_url(items)
    for item in items:
        item.quality_score = score_item(item)
    selected = select_top_items(items, limit=limit)

    title = f"{msg('Intel Daily Digest', '情报日报', language)} ({scope})"
    digest = IntelDigest(
        digest_type="daily",
        scope=scope,
        scope_key=scope_key,
        title=title,
        body_markdown=render_digest_markdown(
            title=title,
            items=selected,
            window_start=since_iso,
            window_end=now_iso,
            language=language,
        ),
        summary_json=json.dumps(
            {
                "items": len(selected),
                "windowStart": since_iso,
                "windowEnd": now_iso,
            },
            ensure_ascii=False,
        ),
        source_ids_json=json.dumps(sorted({item.source_id for item in selected})),
        item_ids_json=json.dumps([item.id for item in selected if item.id is not None]),
        window_start=since_iso,
        window_end=now_iso,
    )
    return create_digest(conn, digest)

"""Dataclasses for the intel domain."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class IntelSource:
    id: int | None = None
    name: str = ""
    source_type: str = ""
    config_json: str = "{}"
    scope: str = "workspace"
    scope_key: str = ""
    is_public: bool = False
    is_active: bool = True
    is_deleted: bool = False
    created_by: str = ""
    created_at: str | None = None
    updated_at: str | None = None
    last_collected_at: str | None = None
    last_error: str | None = None


@dataclass(slots=True)
class IntelRawItem:
    id: int | None = None
    source_id: int = 0
    title: str = ""
    url: str = ""
    author: str = ""
    published_at: str | None = None
    collected_at: str | None = None
    content_text: str = ""
    summary_text: str = ""
    lang: str = ""
    topic_tags_json: str = "[]"
    symbols_json: str = "[]"
    dedup_key: str = ""
    quality_score: float = 0.0
    metadata_json: str = "{}"


@dataclass(slots=True)
class IntelDigest:
    id: int | None = None
    digest_type: str = ""
    scope: str = "workspace"
    scope_key: str = ""
    title: str = ""
    body_markdown: str = ""
    summary_json: str = "{}"
    source_ids_json: str = "[]"
    item_ids_json: str = "[]"
    window_start: str | None = None
    window_end: str | None = None
    created_at: str | None = None
    delivery_status_json: str = "{}"


@dataclass(slots=True)
class CollectResult:
    source_id: int
    ok: bool
    items_collected: int = 0
    items_inserted: int = 0
    warnings: list[str] = field(default_factory=list)
    error: str | None = None

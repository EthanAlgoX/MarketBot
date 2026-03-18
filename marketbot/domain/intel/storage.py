"""SQLite storage helpers for the intel domain."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from marketbot.domain.intel.models import IntelDigest, IntelRawItem, IntelSource


def connect_intel_db(workspace: Path) -> sqlite3.Connection:
    """Open the per-workspace intel SQLite database."""
    db_dir = Path(workspace) / "data"
    db_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_dir / "intel.db")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_intel_schema(conn: sqlite3.Connection) -> None:
    """Initialize intel tables if they do not yet exist."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS intel_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          config_json TEXT NOT NULL DEFAULT '{}',
          scope TEXT NOT NULL DEFAULT 'workspace',
          scope_key TEXT DEFAULT '',
          is_public INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          created_by TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_collected_at TEXT,
          last_error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_intel_sources_scope
          ON intel_sources(scope, scope_key);
        CREATE INDEX IF NOT EXISTS idx_intel_sources_active
          ON intel_sources(is_active, is_deleted);

        CREATE TABLE IF NOT EXISTS intel_raw_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER NOT NULL REFERENCES intel_sources(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL DEFAULT '',
          author TEXT DEFAULT '',
          published_at TEXT,
          collected_at TEXT NOT NULL DEFAULT (datetime('now')),
          content_text TEXT NOT NULL DEFAULT '',
          summary_text TEXT DEFAULT '',
          lang TEXT DEFAULT '',
          topic_tags_json TEXT NOT NULL DEFAULT '[]',
          symbols_json TEXT NOT NULL DEFAULT '[]',
          dedup_key TEXT NOT NULL,
          quality_score REAL NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          UNIQUE(source_id, dedup_key)
        );

        CREATE INDEX IF NOT EXISTS idx_intel_raw_items_source_collected
          ON intel_raw_items(source_id, collected_at DESC);
        CREATE INDEX IF NOT EXISTS idx_intel_raw_items_published
          ON intel_raw_items(published_at DESC);

        CREATE TABLE IF NOT EXISTS intel_digests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          digest_type TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'workspace',
          scope_key TEXT DEFAULT '',
          title TEXT NOT NULL,
          body_markdown TEXT NOT NULL,
          summary_json TEXT NOT NULL DEFAULT '{}',
          source_ids_json TEXT NOT NULL DEFAULT '[]',
          item_ids_json TEXT NOT NULL DEFAULT '[]',
          window_start TEXT,
          window_end TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          delivery_status_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_intel_digests_scope_type
          ON intel_digests(scope, scope_key, digest_type, created_at DESC);
        """
    )
    conn.commit()


def add_source(conn: sqlite3.Connection, source: IntelSource) -> int:
    """Insert a new intel source."""
    cur = conn.execute(
        """
        INSERT INTO intel_sources (
          name, source_type, config_json, scope, scope_key,
          is_public, is_active, is_deleted, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source.name,
            source.source_type,
            source.config_json,
            source.scope,
            source.scope_key,
            int(source.is_public),
            int(source.is_active),
            int(source.is_deleted),
            source.created_by,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def list_sources(
    conn: sqlite3.Connection,
    *,
    scope: str | None = None,
    scope_key: str | None = None,
    active_only: bool = True,
) -> list[IntelSource]:
    """List known sources for a scope."""
    sql = "SELECT * FROM intel_sources WHERE is_deleted = 0"
    params: list[object] = []
    if active_only:
        sql += " AND is_active = 1"
    if scope is not None:
        sql += " AND scope = ?"
        params.append(scope)
    if scope_key is not None:
        sql += " AND scope_key = ?"
        params.append(scope_key)
    sql += " ORDER BY created_at DESC"
    rows = conn.execute(sql, params).fetchall()
    return [_row_to_source(row) for row in rows]


def get_source(conn: sqlite3.Connection, source_id: int) -> IntelSource | None:
    """Get a source by id."""
    row = conn.execute("SELECT * FROM intel_sources WHERE id = ?", (source_id,)).fetchone()
    return _row_to_source(row) if row else None


def mark_source_collected(
    conn: sqlite3.Connection,
    source_id: int,
    *,
    collected_at: str,
    error: str | None = None,
) -> None:
    """Persist source collection status."""
    conn.execute(
        """
        UPDATE intel_sources
        SET last_collected_at = ?, last_error = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (collected_at, error, source_id),
    )
    conn.commit()


def insert_raw_items(conn: sqlite3.Connection, items: list[IntelRawItem]) -> int:
    """Insert raw items, skipping duplicates for the same source."""
    if not items:
        return 0
    before = conn.total_changes
    conn.executemany(
        """
        INSERT OR IGNORE INTO intel_raw_items (
          source_id, title, url, author, published_at, collected_at,
          content_text, summary_text, lang, topic_tags_json, symbols_json,
          dedup_key, quality_score, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item.source_id,
                item.title,
                item.url,
                item.author,
                item.published_at,
                item.collected_at,
                item.content_text,
                item.summary_text,
                item.lang,
                item.topic_tags_json,
                item.symbols_json,
                item.dedup_key,
                item.quality_score,
                item.metadata_json,
            )
            for item in items
        ],
    )
    conn.commit()
    return int(conn.total_changes - before)


def list_recent_raw_items(
    conn: sqlite3.Connection,
    *,
    scope: str,
    scope_key: str,
    since_iso: str,
    limit: int = 500,
) -> list[IntelRawItem]:
    """List recent items for active sources in a scope."""
    rows = conn.execute(
        """
        SELECT ri.*
        FROM intel_raw_items ri
        JOIN intel_sources s ON s.id = ri.source_id
        WHERE s.scope = ?
          AND s.scope_key = ?
          AND s.is_deleted = 0
          AND s.is_active = 1
          AND ri.collected_at >= ?
        ORDER BY COALESCE(ri.published_at, ri.collected_at) DESC
        LIMIT ?
        """,
        (scope, scope_key, since_iso, limit),
    ).fetchall()
    return [_row_to_raw_item(row) for row in rows]


def create_digest(conn: sqlite3.Connection, digest: IntelDigest) -> int:
    """Persist a rendered digest."""
    cur = conn.execute(
        """
        INSERT INTO intel_digests (
          digest_type, scope, scope_key, title, body_markdown,
          summary_json, source_ids_json, item_ids_json,
          window_start, window_end, delivery_status_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            digest.digest_type,
            digest.scope,
            digest.scope_key,
            digest.title,
            digest.body_markdown,
            digest.summary_json,
            digest.source_ids_json,
            digest.item_ids_json,
            digest.window_start,
            digest.window_end,
            digest.delivery_status_json,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def list_digests(
    conn: sqlite3.Connection,
    *,
    digest_type: str | None = None,
    scope: str | None = None,
    scope_key: str | None = None,
    limit: int = 20,
) -> list[IntelDigest]:
    """List recent digests."""
    sql = "SELECT * FROM intel_digests WHERE 1=1"
    params: list[object] = []
    if digest_type is not None:
        sql += " AND digest_type = ?"
        params.append(digest_type)
    if scope is not None:
        sql += " AND scope = ?"
        params.append(scope)
    if scope_key is not None:
        sql += " AND scope_key = ?"
        params.append(scope_key)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [_row_to_digest(row) for row in rows]


def get_digest(conn: sqlite3.Connection, digest_id: int) -> IntelDigest | None:
    """Fetch a single digest by id."""
    row = conn.execute("SELECT * FROM intel_digests WHERE id = ?", (digest_id,)).fetchone()
    return _row_to_digest(row) if row else None


def _row_to_source(row: sqlite3.Row) -> IntelSource:
    return IntelSource(
        id=row["id"],
        name=row["name"],
        source_type=row["source_type"],
        config_json=row["config_json"],
        scope=row["scope"],
        scope_key=row["scope_key"],
        is_public=bool(row["is_public"]),
        is_active=bool(row["is_active"]),
        is_deleted=bool(row["is_deleted"]),
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        last_collected_at=row["last_collected_at"],
        last_error=row["last_error"],
    )


def _row_to_raw_item(row: sqlite3.Row) -> IntelRawItem:
    return IntelRawItem(
        id=row["id"],
        source_id=row["source_id"],
        title=row["title"],
        url=row["url"],
        author=row["author"],
        published_at=row["published_at"],
        collected_at=row["collected_at"],
        content_text=row["content_text"],
        summary_text=row["summary_text"],
        lang=row["lang"],
        topic_tags_json=row["topic_tags_json"],
        symbols_json=row["symbols_json"],
        dedup_key=row["dedup_key"],
        quality_score=row["quality_score"],
        metadata_json=row["metadata_json"],
    )


def _row_to_digest(row: sqlite3.Row) -> IntelDigest:
    return IntelDigest(
        id=row["id"],
        digest_type=row["digest_type"],
        scope=row["scope"],
        scope_key=row["scope_key"],
        title=row["title"],
        body_markdown=row["body_markdown"],
        summary_json=row["summary_json"],
        source_ids_json=row["source_ids_json"],
        item_ids_json=row["item_ids_json"],
        window_start=row["window_start"],
        window_end=row["window_end"],
        created_at=row["created_at"],
        delivery_status_json=row["delivery_status_json"],
    )

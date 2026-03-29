"""Search helpers for collected intel items."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from marketbot.domain.intel.storage import connect_intel_db, init_intel_schema

_TOKEN_RE = re.compile(r"[A-Za-z0-9\u4e00-\u9fff]{2,}")


def _tokenize(text: str) -> list[str]:
    """Tokenize plain text for lightweight BM25 scoring."""
    return [token.lower() for token in _TOKEN_RE.findall(text or "")]


@dataclass(slots=True)
class IntelSearchHit:
    """Search result item for collected intel."""

    item_id: int
    source_id: int
    source_name: str
    title: str
    url: str
    published_at: str | None
    collected_at: str | None
    summary_text: str
    content_preview: str
    score: float

    def to_dict(self) -> dict[str, Any]:
        """Return a stable JSON payload."""
        return {
            "itemId": self.item_id,
            "sourceId": self.source_id,
            "sourceName": self.source_name,
            "title": self.title,
            "url": self.url,
            "publishedAt": self.published_at,
            "collectedAt": self.collected_at,
            "summaryText": self.summary_text,
            "contentPreview": self.content_preview,
            "score": round(self.score, 6),
        }


class IntelSearchService:
    """Search collected intel from the workspace SQLite store."""

    def __init__(self, workspace: Path):
        self._workspace = Path(workspace)

    def search(
        self,
        query: str,
        *,
        limit: int = 5,
        days: int = 30,
        scope: str = "workspace",
        scope_key: str = "",
    ) -> list[IntelSearchHit]:
        """Search recent collected intel with lightweight BM25 ranking."""
        clean_query = str(query or "").strip()
        if not clean_query:
            return []

        conn = connect_intel_db(self._workspace)
        try:
            init_intel_schema(conn)
            rows = self._fetch_rows(conn, days=days, scope=scope, scope_key=scope_key)
        finally:
            conn.close()

        if not rows:
            return []
        return self._rank_rows(clean_query, rows, limit=max(1, limit))

    def _fetch_rows(
        self,
        conn,
        *,
        days: int,
        scope: str,
        scope_key: str,
    ) -> list[dict[str, Any]]:
        since_iso = (datetime.now(UTC) - timedelta(days=max(1, days))).isoformat().replace("+00:00", "Z")
        rows = conn.execute(
            """
            SELECT
              ri.id,
              ri.source_id,
              ri.title,
              ri.url,
              ri.published_at,
              ri.collected_at,
              ri.summary_text,
              ri.content_text,
              s.name AS source_name
            FROM intel_raw_items ri
            JOIN intel_sources s ON s.id = ri.source_id
            WHERE s.scope = ?
              AND s.scope_key = ?
              AND s.is_deleted = 0
              AND s.is_active = 1
              AND COALESCE(ri.published_at, ri.collected_at) >= ?
            ORDER BY COALESCE(ri.published_at, ri.collected_at) DESC
            LIMIT 2000
            """,
            (scope, scope_key, since_iso),
        ).fetchall()
        return [dict(row) for row in rows]

    def _rank_rows(self, query: str, rows: list[dict[str, Any]], limit: int) -> list[IntelSearchHit]:
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        corpus: list[list[str]] = []
        term_doc_freq: Counter[str] = Counter()
        documents: list[Counter[str]] = []

        for row in rows:
            text = " ".join(
                [
                    str(row.get("title") or ""),
                    str(row.get("summary_text") or ""),
                    str(row.get("content_text") or ""),
                ]
            )
            tokens = _tokenize(text)
            corpus.append(tokens)
            counts = Counter(tokens)
            documents.append(counts)
            for term in counts:
                term_doc_freq[term] += 1

        total_docs = len(corpus)
        avg_doc_len = (sum(len(tokens) for tokens in corpus) / total_docs) if total_docs else 1.0
        k1 = 1.5
        b = 0.75

        scored: list[tuple[float, dict[str, Any]]] = []
        for row, tokens, counts in zip(rows, corpus, documents, strict=False):
            doc_len = max(1, len(tokens))
            score = 0.0
            for term in query_tokens:
                tf = counts.get(term, 0)
                if tf <= 0:
                    continue
                df = term_doc_freq.get(term, 0)
                idf = math.log(1.0 + ((total_docs - df + 0.5) / (df + 0.5)))
                denom = tf + k1 * (1.0 - b + b * (doc_len / avg_doc_len))
                score += idf * ((tf * (k1 + 1.0)) / denom)
            if score > 0:
                scored.append((score, row))

        scored.sort(key=lambda item: item[0], reverse=True)
        hits: list[IntelSearchHit] = []
        for score, row in scored[:limit]:
            content_text = str(row.get("content_text") or "")
            hits.append(
                IntelSearchHit(
                    item_id=int(row["id"]),
                    source_id=int(row["source_id"]),
                    source_name=str(row.get("source_name") or ""),
                    title=str(row.get("title") or ""),
                    url=str(row.get("url") or ""),
                    published_at=row.get("published_at"),
                    collected_at=row.get("collected_at"),
                    summary_text=str(row.get("summary_text") or ""),
                    content_preview=content_text[:240],
                    score=score,
                )
            )
        return hits

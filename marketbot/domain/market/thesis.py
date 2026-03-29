"""Lightweight thesis tracking storage and heuristics."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    """Current UTC timestamp in ISO-8601 format."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def make_thesis_id(symbol: str, thesis: str) -> str:
    """Create a readable thesis id from symbol and thesis text."""
    base = re.sub(r"[^a-z0-9]+", "-", f"{symbol}-{thesis}".lower()).strip("-")
    base = re.sub(r"-{2,}", "-", base)
    if not base:
        base = "thesis"
    return base[:80]


@dataclass(slots=True)
class ThesisRecord:
    """Structured tracked thesis."""

    id: str
    symbol: str
    thesis: str
    status: str = "active"
    confidence: float = 0.5
    created_at: str = field(default_factory=utc_now_iso)
    last_update_at: str = field(default_factory=utc_now_iso)
    tags: list[str] = field(default_factory=list)
    drivers: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    history: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return {
            "id": self.id,
            "symbol": self.symbol,
            "thesis": self.thesis,
            "status": self.status,
            "confidence": round(float(self.confidence), 4),
            "createdAt": self.created_at,
            "lastUpdateAt": self.last_update_at,
            "tags": list(self.tags),
            "drivers": list(self.drivers),
            "risks": list(self.risks),
            "history": list(self.history),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ThesisRecord":
        """Construct from persisted dict."""
        return cls(
            id=str(payload.get("id") or ""),
            symbol=str(payload.get("symbol") or ""),
            thesis=str(payload.get("thesis") or ""),
            status=str(payload.get("status") or "active"),
            confidence=float(payload.get("confidence") or 0.5),
            created_at=str(payload.get("createdAt") or utc_now_iso()),
            last_update_at=str(payload.get("lastUpdateAt") or utc_now_iso()),
            tags=[str(item) for item in payload.get("tags", [])],
            drivers=[str(item) for item in payload.get("drivers", [])],
            risks=[str(item) for item in payload.get("risks", [])],
            history=[dict(item) for item in payload.get("history", []) if isinstance(item, dict)],
        )


class ThesisStore:
    """File-backed thesis store under the workspace data directory."""

    def __init__(self, workspace: Path):
        self._workspace = Path(workspace)
        self._path = self._workspace / "data" / "theses.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def list_theses(self) -> list[ThesisRecord]:
        """Return all tracked theses newest first."""
        data = self._load_all()
        theses = [ThesisRecord.from_dict(item) for item in data]
        theses.sort(key=lambda item: item.last_update_at, reverse=True)
        return theses

    def get_thesis(self, thesis_id: str) -> ThesisRecord | None:
        """Load a single thesis by id."""
        for thesis in self.list_theses():
            if thesis.id == thesis_id:
                return thesis
        return None

    def create_thesis(
        self,
        *,
        symbol: str,
        thesis: str,
        confidence: float = 0.5,
        tags: list[str] | None = None,
        drivers: list[str] | None = None,
        risks: list[str] | None = None,
        note: str = "",
    ) -> ThesisRecord:
        """Create and persist a new thesis."""
        existing = self.get_thesis(make_thesis_id(symbol, thesis))
        if existing is not None:
            return existing

        now = utc_now_iso()
        record = ThesisRecord(
            id=make_thesis_id(symbol, thesis),
            symbol=symbol.strip().upper(),
            thesis=thesis.strip(),
            confidence=max(0.0, min(1.0, float(confidence))),
            created_at=now,
            last_update_at=now,
            tags=self._clean_list(tags),
            drivers=self._clean_list(drivers),
            risks=self._clean_list(risks),
            history=[
                {
                    "timestamp": now,
                    "action": "created",
                    "note": note.strip(),
                }
            ],
        )
        theses = self._load_all()
        theses.append(record.to_dict())
        self._save_all(theses)
        return record

    def update_thesis(
        self,
        thesis_id: str,
        *,
        status: str | None = None,
        confidence: float | None = None,
        confidence_delta: float | None = None,
        note: str = "",
        verdict: str | None = None,
        evidence: str = "",
        tags: list[str] | None = None,
        drivers: list[str] | None = None,
        risks: list[str] | None = None,
    ) -> ThesisRecord | None:
        """Update a thesis and append a history event."""
        theses = self._load_all()
        now = utc_now_iso()
        for idx, raw in enumerate(theses):
            if str(raw.get("id") or "") != thesis_id:
                continue
            record = ThesisRecord.from_dict(raw)
            if confidence is not None:
                record.confidence = max(0.0, min(1.0, float(confidence)))
            if confidence_delta is not None:
                record.confidence = max(0.0, min(1.0, float(record.confidence) + float(confidence_delta)))
            if status:
                record.status = status
            if tags is not None:
                record.tags = self._clean_list(tags)
            if drivers is not None:
                record.drivers = self._clean_list(drivers)
            if risks is not None:
                record.risks = self._clean_list(risks)
            record.last_update_at = now
            record.history.append(
                {
                    "timestamp": now,
                    "action": "updated",
                    "verdict": verdict or "",
                    "note": note.strip(),
                    "evidence": evidence.strip(),
                    "status": record.status,
                    "confidence": round(float(record.confidence), 4),
                }
            )
            theses[idx] = record.to_dict()
            self._save_all(theses)
            return record
        return None

    @staticmethod
    def derive_verdict(sentiment_score: float) -> str:
        """Map evidence sentiment into a thesis lifecycle verdict."""
        if sentiment_score <= -0.55:
            return "falsified"
        if sentiment_score <= -0.15:
            return "weakened"
        if sentiment_score >= 0.15:
            return "strengthened"
        return "unchanged"

    @staticmethod
    def verdict_status(verdict: str, current_status: str) -> str:
        """Map verdict into next thesis status."""
        if verdict == "falsified":
            return "inactive"
        if current_status in {"closed", "inactive"} and verdict == "strengthened":
            return "active"
        return current_status

    def _load_all(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
        return payload if isinstance(payload, list) else []

    def _save_all(self, rows: list[dict[str, Any]]) -> None:
        self._path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _clean_list(items: list[str] | None) -> list[str]:
        clean: list[str] = []
        for item in items or []:
            text = str(item or "").strip()
            if text and text not in clean:
                clean.append(text)
        return clean

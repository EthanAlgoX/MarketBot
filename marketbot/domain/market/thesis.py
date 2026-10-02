"""Atomic thesis persistence with explicit declarations and evidence-backed checks."""

from __future__ import annotations

import json
import math
import os
import re
import tempfile
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4

from marketbot.domain.market.thesis_rules import evaluate_rules, normalize_rules


class ThesisStorageError(RuntimeError):
    """The existing thesis file is corrupt or cannot be safely persisted."""


def _reject_nonfinite_json(value: str) -> None:
    raise ValueError("nonfinite JSON")


def _confidence(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("confidence must be a finite number")
    try:
        number = float(value)
    except OverflowError:
        raise ValueError("confidence must be a finite number") from None
    if not math.isfinite(number):
        raise ValueError("confidence must be a finite number")
    return max(0.0, min(1.0, number))


def utc_now_iso() -> str:
    """Current UTC timestamp in ISO-8601 format."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _thesis_identity(symbol: str, thesis: str) -> tuple[str, str]:
    """Ignore ticker casing and insignificant surrounding/repeated whitespace."""
    return symbol.strip().upper(), " ".join(thesis.split())


def make_thesis_id(symbol: str, thesis: str) -> str:
    """Create a readable id with a hash of the complete Unicode identity."""
    identity = _thesis_identity(symbol, thesis)
    base = re.sub(r"[^a-z0-9]+", "-", "-".join(identity).lower()).strip("-")
    base = re.sub(r"-{2,}", "-", base)
    if not base:
        base = "thesis"
    content = json.dumps(identity, ensure_ascii=False, separators=(",", ":"))
    digest = sha256(content.encode("utf-8")).hexdigest()
    return f"{base[:15].rstrip('-')}-{digest}"


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
    rules: list[dict[str, Any]] = field(default_factory=list)

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
            "history": deepcopy(self.history),
            "rules": deepcopy(self.rules),
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ThesisRecord":
        """Construct from persisted dict."""
        if not isinstance(payload, dict) or any(
            not isinstance(payload.get(key), str) or not payload[key].strip() for key in ("id", "symbol", "thesis")
        ):
            raise ValueError("thesis record has invalid identity fields")
        for key in ("tags", "drivers", "risks"):
            if not isinstance(payload.get(key, []), list) or any(not isinstance(item, str) for item in payload.get(key, [])):
                raise ValueError(f"thesis record has invalid {key}")
        history = payload.get("history", [])
        if not isinstance(history, list) or any(not isinstance(item, dict) for item in history):
            raise ValueError("thesis record has invalid history")
        return cls(
            id=str(payload.get("id") or ""),
            symbol=str(payload.get("symbol") or ""),
            thesis=str(payload.get("thesis") or ""),
            status=str(payload.get("status") or "active"),
            confidence=_confidence(payload.get("confidence", 0.5)),
            created_at=str(payload.get("createdAt") or utc_now_iso()),
            last_update_at=str(payload.get("lastUpdateAt") or utc_now_iso()),
            tags=[str(item) for item in payload.get("tags", [])],
            drivers=[str(item) for item in payload.get("drivers", [])],
            risks=[str(item) for item in payload.get("risks", [])],
            history=deepcopy(history),
            rules=normalize_rules(payload.get("rules", [])),
        )


class ThesisStore:
    """File-backed thesis store under the workspace data directory."""

    def __init__(self, workspace: Path):
        self._workspace = Path(workspace)
        self._path = self._workspace / "data" / "theses.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock_path = self._path.with_suffix(".lock")

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
        rules: list[dict[str, Any]] | None = None,
        evidence_ids: list[str] | None = None,
        evidence_store: Any = None,
    ) -> ThesisRecord:
        """Create and persist a new thesis."""
        if not isinstance(symbol, str) or not symbol.strip() or not isinstance(thesis, str) or not thesis.strip():
            raise ValueError("symbol and thesis must be nonempty strings")
        clean_confidence = _confidence(confidence)
        clean_rules = normalize_rules([] if rules is None else rules)
        identity = _thesis_identity(symbol, thesis)
        with self._locked():
            theses = self._load_all()
            for raw in theses:
                if _thesis_identity(raw["symbol"], raw["thesis"]) == identity:
                    # Preserve legacy IDs and histories; no migration or duplicate creation.
                    return ThesisRecord.from_dict(raw)

            now = utc_now_iso()
            record = ThesisRecord(
                id=make_thesis_id(symbol, thesis), symbol=symbol.strip().upper(), thesis=thesis.strip(),
                confidence=clean_confidence, created_at=now, last_update_at=now,
                tags=self._clean_list(tags), drivers=self._clean_list(drivers), risks=self._clean_list(risks),
                rules=clean_rules,
                history=[{"timestamp": now, "action": "created", "note": note.strip(),
                          "decisionSource": "declared", "verificationStatus": "unverified_declaration"}],
            )
            self._bind_event(record.id, record.history[-1], evidence_ids, evidence_store)
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
        rules: list[dict[str, Any]] | None = None,
        evidence_ids: list[str] | None = None,
        evidence_store: Any = None,
    ) -> ThesisRecord | None:
        """Update a thesis and append a history event."""
        if confidence is not None:
            confidence = _confidence(confidence)
        if confidence_delta is not None:
            if isinstance(confidence_delta, bool) or not isinstance(confidence_delta, (float, int)):
                raise ValueError("confidenceDelta must be a finite number")
            try:
                confidence_delta = float(confidence_delta)
            except OverflowError:
                raise ValueError("confidenceDelta must be a finite number") from None
            if not math.isfinite(confidence_delta):
                raise ValueError("confidenceDelta must be a finite number")
        if verdict is not None and verdict not in {"strengthened", "weakened", "unchanged", "falsified"}:
            raise ValueError("invalid verdict")
        clean_rules = normalize_rules(rules) if rules is not None else None
        with self._locked():
            theses = self._load_all()
            now = utc_now_iso()
            for idx, raw in enumerate(theses):
                if raw["id"] != thesis_id:
                    continue
                record = ThesisRecord.from_dict(raw)
                if confidence is not None:
                    record.confidence = confidence
                if confidence_delta is not None:
                    record.confidence = _confidence(record.confidence + confidence_delta)
                if status:
                    record.status = status
                elif verdict:
                    record.status = self.verdict_status(verdict, record.status)
                if tags is not None:
                    record.tags = self._clean_list(tags)
                if drivers is not None:
                    record.drivers = self._clean_list(drivers)
                if risks is not None:
                    record.risks = self._clean_list(risks)
                if clean_rules is not None:
                    record.rules = clean_rules
                record.last_update_at = now
                event = {"timestamp": now, "action": "updated", "verdict": verdict or "unchanged",
                         "note": note.strip(), "evidence": evidence.strip(), "status": record.status,
                         "confidence": round(float(record.confidence), 4),
                         "decisionSource": "declared" if verdict or status or confidence is not None or confidence_delta is not None else "observation",
                         "verificationStatus": "unverified_declaration" if verdict or status or confidence is not None or confidence_delta is not None else "not_evaluated"}
                self._bind_event(record.id, event, evidence_ids, evidence_store)
                record.history.append(event)
                theses[idx] = record.to_dict()
                self._save_all(theses)
                return record
            return None

    def review_thesis(
        self, thesis_id: str, *, observations: list[dict[str, Any]], evidence_store: Any,
        note: str = "", now: datetime | None = None,
    ) -> tuple[ThesisRecord, dict[str, Any]] | None:
        """Evaluate persisted conditions and bind the exact decision to ledger facts."""
        with self._locked():
            theses = self._load_all()
            for index, raw in enumerate(theses):
                if raw["id"] != thesis_id:
                    continue
                record = ThesisRecord.from_dict(raw)
                review = evaluate_rules(record.rules, observations, symbol=record.symbol, lookup=evidence_store.get, now=now)
                previous_status = record.status
                # A positive condition does not implicitly reopen a manually closed thesis.
                if review["verificationStatus"] == "verified" and review["verdict"] == "falsified":
                    record.status = "inactive"
                timestamp = utc_now_iso()
                event = {"timestamp": timestamp, "action": "reviewed", "note": note.strip(),
                         "previousStatus": previous_status, "status": record.status,
                         "confidence": record.confidence, **deepcopy(review)}
                self._bind_event(record.id, event, review["evidenceIds"], evidence_store)
                record.history.append(event)
                record.last_update_at = timestamp
                theses[index] = record.to_dict()
                self._save_all(theses)
                review["claimId"] = event.get("claimId")
                return record, review
            return None

    @staticmethod
    def derive_verdict(sentiment_score: float) -> str:
        """Legacy compatibility: sentiment alone cannot verify an investment thesis."""
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
            payload = json.loads(self._path.read_text(encoding="utf-8"), parse_constant=_reject_nonfinite_json)
            if not isinstance(payload, list):
                raise ValueError("thesis store root is not an array")
            ids: set[str] = set()
            for item in payload:
                record = ThesisRecord.from_dict(item)
                if record.id in ids:
                    raise ValueError("thesis store contains duplicate IDs")
                ids.add(record.id)
            return payload
        except (OSError, UnicodeError, ValueError, TypeError, OverflowError):
            raise ThesisStorageError("Existing thesis storage is corrupt or unreadable; it was not overwritten") from None

    def _save_all(self, rows: list[dict[str, Any]]) -> None:
        temporary_path = None
        try:
            content = json.dumps(rows, ensure_ascii=False, indent=2, allow_nan=False)
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self._path.parent, prefix=".theses-", suffix=".tmp", delete=False) as stream:
                temporary_path = Path(stream.name)
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary_path, self._path)
        except (OSError, ValueError, UnicodeError):
            raise ThesisStorageError("Thesis storage could not be atomically updated; the previous file was preserved") from None
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    @contextmanager
    def _locked(self) -> Iterator[None]:
        """Serialize read-modify-write transactions across threads and processes."""
        with self._lock_path.open("a+b") as stream:
            if os.name == "nt":
                import msvcrt

                stream.seek(0)
                if not stream.read(1):
                    stream.write(b"0")
                    stream.flush()
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    yield
                finally:
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _bind_event(thesis_id: str, event: dict[str, Any], evidence_ids: list[str] | None, evidence_store: Any) -> None:
        if evidence_ids is not None and (not isinstance(evidence_ids, list) or len(evidence_ids) > 100 or any(not isinstance(item, str) for item in evidence_ids)):
            raise ValueError("evidenceIds must be an array of at most 100 ledger IDs")
        if not evidence_ids:
            event.setdefault("evidenceIds", [])
            return
        if evidence_store is None:
            raise ValueError("evidence references require the local evidence ledger")
        records = evidence_store.validate_references(evidence_ids)
        ids = [item.evidence_id for item in records]
        claim_id = f"thesis:{thesis_id[:80]}:{uuid4().hex}"
        evidence_store.bind_claim(claim_id, ids)
        event.update({"evidenceIds": ids, "claimId": claim_id})

    @staticmethod
    def _clean_list(items: list[str] | None) -> list[str]:
        if items is not None and (not isinstance(items, list) or any(not isinstance(item, str) for item in items)):
            raise ValueError("tags, drivers, and risks must be arrays of strings")
        clean: list[str] = []
        for item in items or []:
            text = str(item or "").strip()
            if text and text not in clean:
                clean.append(text)
        return clean

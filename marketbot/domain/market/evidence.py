"""Immutable, verifiable research evidence persisted inside a workspace.

SQLite transactions serialize writers across threads and processes. The database is
published atomically on its first write; reads never create files. Source observation
and publication times remain unknown unless supplied, independently of retrieval.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
import stat
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import parse_qsl, quote, unquote, urlsplit

_EVIDENCE_ID = re.compile(r"ev_[0-9a-f]{64}\Z")
_CLAIM_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}\Z")
_KIND = re.compile(r"[A-Za-z][A-Za-z0-9_.:-]{0,79}\Z")
_SYMBOL = re.compile(r"[A-Za-z0-9^][A-Za-z0-9.^_=/:-]{0,39}\Z")
_URL_PREFIX = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
_ENV_REFERENCE = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}")
_CREDENTIAL_TEXT = re.compile(
    r"\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|"
    r"authorization|password)\s*[:=]\s*\S+|\bBearer\s+\S+", re.IGNORECASE
)
_SENSITIVE_KEYS = {
    "apikey", "authorization", "password", "passwd", "secret", "clientsecret",
    "token", "accesstoken", "refreshtoken", "idtoken", "credentials", "credential",
    "privatekey", "headers", "env", "environment", "cookie", "setcookie",
}
_SECRET_QUERY_KEYS = _SENSITIVE_KEYS | {"key", "signature", "sig", "auth"}
_URL_KEYS = {"url", "sourceurl", "link", "href"}
_SCHEMA_VERSION = 1
_APPLICATION_ID = 0x4D424556  # MBEV: distinguish this database from other workspace stores.
_MAX_JSON_BYTES = 2 * 1024 * 1024
_FIELDS = {
    "evidenceId", "contentDigest", "kind", "source", "sourceUrl", "symbols",
    "observedAt", "publishedAt", "retrievedAt", "payload", "quality", "derivedFrom",
}


class EvidenceValidationError(ValueError):
    """An input cannot be safely represented as public, attributable evidence."""


class EvidenceStoreError(RuntimeError):
    """The existing evidence store is unsafe, corrupt, or unavailable."""


def _key_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def validate_source_url(value: str | None) -> str | None:
    """Accept public HTTP(S) citations, rejecting embedded credentials and secret queries."""
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > 4096:
        raise EvidenceValidationError("sourceUrl must be a nonempty public HTTP(S) URL")
    value = value.strip()
    if any(char.isspace() or ord(char) < 32 for char in value) or "\\" in value:
        raise EvidenceValidationError("sourceUrl contains invalid URL characters")
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
            raise EvidenceValidationError("Only public HTTP(S) source URLs are supported")
        if parsed.username is not None or parsed.password is not None:
            raise EvidenceValidationError("Credential-bearing source URLs are forbidden")
        # Accessing port validates malformed/out-of-range ports without echoing the URL.
        _ = parsed.port
        parsed.hostname.encode("idna")
        for key, _value in parse_qsl(parsed.query, keep_blank_values=True):
            if _key_name(unquote(key)) in _SECRET_QUERY_KEYS:
                raise EvidenceValidationError("Secret query parameters are forbidden in source URLs")
        if _ENV_REFERENCE.search(value) or _CREDENTIAL_TEXT.search(unquote(parsed.fragment)):
            raise EvidenceValidationError("Source URLs must not contain credential placeholders")
    except (ValueError, UnicodeError) as exc:
        if isinstance(exc, EvidenceValidationError):
            raise
        raise EvidenceValidationError("sourceUrl is invalid") from None
    return value


def _validate_json(value: Any, *, public: bool, depth: int = 0) -> None:
    if depth > 64:
        raise EvidenceValidationError("Evidence JSON is nested too deeply")
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise EvidenceValidationError("Evidence JSON must contain only finite numbers")
        return
    if isinstance(value, str):
        if public and (_ENV_REFERENCE.search(value) or _CREDENTIAL_TEXT.search(value)):
            raise EvidenceValidationError("Credential values or environment placeholders are forbidden")
        if public and _URL_PREFIX.match(value):
            validate_source_url(value)
        return
    if isinstance(value, list):
        for item in value:
            _validate_json(item, public=public, depth=depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise EvidenceValidationError("Evidence JSON object keys must be strings")
            if public and _key_name(key) in _SENSITIVE_KEYS:
                raise EvidenceValidationError("Credential, header, or environment fields are forbidden")
            if public and _key_name(key) in _URL_KEYS and item:
                validate_source_url(item)
            _validate_json(item, public=public, depth=depth + 1)
        return
    raise EvidenceValidationError("Evidence values must use JSON-compatible types")


def canonical_json(value: Any) -> str:
    """Canonical finite JSON used by content digests; object ordering is immaterial."""
    _validate_json(value, public=False)
    try:
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
        if len(encoded.encode("utf-8")) > _MAX_JSON_BYTES:
            raise EvidenceValidationError("Evidence JSON exceeds the storage size limit")
        return encoded
    except (ValueError, UnicodeError, OverflowError):
        raise EvidenceValidationError("Evidence cannot be encoded as finite UTF-8 JSON") from None


def content_digest(payload: Any) -> str:
    """A reproducible SHA-256 digest over the canonical stored payload."""
    return "sha256:" + hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def _timestamp(value: str | None, field: str, *, required: bool = False) -> str | None:
    if value is None:
        if required:
            return datetime.now(UTC).isoformat()
        return None
    if not isinstance(value, str) or len(value) > 80:
        raise EvidenceValidationError(f"{field} must be an ISO-8601 timestamp with timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError
        return parsed.astimezone(UTC).isoformat()
    except (ValueError, OverflowError):
        raise EvidenceValidationError(f"{field} must be an ISO-8601 timestamp with timezone") from None


def _evidence_id(value: str) -> str:
    if not isinstance(value, str) or not _EVIDENCE_ID.fullmatch(value):
        raise EvidenceValidationError("Invalid evidenceId; expected ev_ followed by 64 lowercase hex digits")
    return value


def _reference_ids(values: list[str] | tuple[str, ...] | None) -> tuple[str, ...]:
    if values is None:
        return ()
    if not isinstance(values, (list, tuple)) or len(values) > 1000:
        raise EvidenceValidationError("Evidence references must be a list of at most 1000 IDs")
    return tuple(sorted({_evidence_id(value) for value in values}))


def _claim_id(value: str) -> str:
    if not isinstance(value, str) or not _CLAIM_ID.fullmatch(value) or ".." in value:
        raise EvidenceValidationError("Invalid claim ID; paths and traversal are forbidden")
    return value


def _symbol(value: str) -> str:
    if not isinstance(value, str) or not _SYMBOL.fullmatch(value.strip()):
        raise EvidenceValidationError("Invalid evidence symbol")
    return value.strip().upper()


@dataclass(frozen=True, slots=True)
class EvidenceRecord:
    """Immutable evidence; JSON properties return detached copies on every access."""

    evidence_id: str
    content_digest: str
    kind: str
    source: str
    source_url: str | None
    symbols: tuple[str, ...]
    observed_at: str | None
    published_at: str | None
    retrieved_at: str
    derived_from: tuple[str, ...]
    _payload_json: str
    _quality_json: str

    @property
    def payload(self) -> Any:
        return json.loads(self._payload_json)

    @property
    def quality(self) -> dict[str, Any]:
        return json.loads(self._quality_json)

    def to_dict(self) -> dict[str, Any]:
        return {
            "evidenceId": self.evidence_id,
            "contentDigest": self.content_digest,
            "kind": self.kind,
            "source": self.source,
            "sourceUrl": self.source_url,
            "symbols": list(self.symbols),
            "observedAt": self.observed_at,
            "publishedAt": self.published_at,
            "retrievedAt": self.retrieved_at,
            "payload": self.payload,
            "quality": self.quality,
            "derivedFrom": list(self.derived_from),
        }


def _make_record(
    *, kind: str, source: str, payload: Any, source_url: str | None = None,
    symbols: list[str] | tuple[str, ...] | None = None, observed_at: str | None = None,
    published_at: str | None = None, retrieved_at: str | None = None,
    quality: dict[str, Any] | None = None, derived_from: list[str] | tuple[str, ...] | None = None,
) -> EvidenceRecord:
    if not isinstance(kind, str) or not _KIND.fullmatch(kind):
        raise EvidenceValidationError("Evidence kind must be a short identifier")
    if not isinstance(source, str) or not source.strip() or len(source) > 200:
        raise EvidenceValidationError("Evidence source must be a nonempty label of at most 200 characters")
    if any(ord(char) < 32 for char in source):
        raise EvidenceValidationError("Evidence source contains invalid characters")
    _validate_json(source, public=True)
    if symbols is not None and (not isinstance(symbols, (list, tuple)) or len(symbols) > 100):
        raise EvidenceValidationError("Evidence symbols must be a list of at most 100 symbols")
    if quality is not None and not isinstance(quality, dict):
        raise EvidenceValidationError("Evidence quality must be a JSON object")
    _validate_json(payload, public=True)
    _validate_json(quality or {}, public=True)
    payload_json = canonical_json(payload)
    digest = "sha256:" + hashlib.sha256(payload_json.encode("utf-8")).hexdigest()
    identity = {
        "kind": kind, "source": source.strip(), "sourceUrl": validate_source_url(source_url),
        "symbols": sorted({_symbol(symbol) for symbol in symbols or []}),
        "observedAt": _timestamp(observed_at, "observedAt"),
        "publishedAt": _timestamp(published_at, "publishedAt"),
        "contentDigest": digest, "quality": quality or {}, "derivedFrom": list(_reference_ids(derived_from)),
    }
    evidence_id = "ev_" + hashlib.sha256(canonical_json(identity).encode("utf-8")).hexdigest()
    return EvidenceRecord(
        evidence_id=evidence_id, content_digest=digest, kind=kind, source=identity["source"],
        source_url=identity["sourceUrl"], symbols=tuple(identity["symbols"]),
        observed_at=identity["observedAt"], published_at=identity["publishedAt"],
        retrieved_at=_timestamp(retrieved_at, "retrievedAt", required=True),
        derived_from=tuple(identity["derivedFrom"]), _payload_json=payload_json,
        _quality_json=canonical_json(identity["quality"]),
    )


_SCHEMA = """
CREATE TABLE evidence (
    evidence_id TEXT PRIMARY KEY,
    content_digest TEXT NOT NULL,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    document TEXT NOT NULL
);
CREATE TABLE evidence_symbols (
    evidence_id TEXT NOT NULL REFERENCES evidence(evidence_id),
    symbol TEXT NOT NULL,
    PRIMARY KEY (evidence_id, symbol)
);
CREATE TABLE evidence_derivations (
    evidence_id TEXT NOT NULL REFERENCES evidence(evidence_id),
    parent_id TEXT NOT NULL REFERENCES evidence(evidence_id),
    PRIMARY KEY (evidence_id, parent_id)
);
CREATE TABLE claim_evidence (
    claim_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL REFERENCES evidence(evidence_id),
    PRIMARY KEY (claim_id, evidence_id)
);
CREATE INDEX evidence_kind_source ON evidence(kind, source);
CREATE INDEX evidence_retrieved ON evidence(retrieved_at, evidence_id);
CREATE INDEX evidence_symbol ON evidence_symbols(symbol, evidence_id);
"""


class EvidenceStore:
    """Append-only research ledger with content and provenance verification."""

    def __init__(self, workspace: str | Path):
        self.workspace = Path(workspace).expanduser().resolve()
        self.directory = self.workspace / "data" / "research" / "evidence"
        self.path = self.directory / "ledger.sqlite3"

    def _check_paths(self) -> None:
        def mode_if_present(path: Path) -> int | None:
            try:
                return path.lstat().st_mode
            except FileNotFoundError:
                # SQLite creates/removes journals while other clients check the
                # store. Absence is valid; separate exists/type queries race.
                return None

        workspace_mode = mode_if_present(self.workspace)
        if workspace_mode is not None and not stat.S_ISDIR(workspace_mode):
            raise EvidenceStoreError("Evidence workspace must be a directory")
        current = self.workspace
        for part in ("data", "research", "evidence"):
            current /= part
            mode = mode_if_present(current)
            if mode is not None and not stat.S_ISDIR(mode):
                raise EvidenceStoreError("Evidence storage must remain inside its workspace")
        for path in (self.path, Path(str(self.path) + "-journal"), Path(str(self.path) + "-wal"), Path(str(self.path) + "-shm")):
            mode = mode_if_present(path)
            if mode is not None and not stat.S_ISREG(mode):
                raise EvidenceStoreError("Evidence storage path is unsafe")
        if not self.path.resolve().is_relative_to(self.workspace):
            raise EvidenceStoreError("Evidence storage must remain inside its workspace")

    def _ensure_database(self) -> None:
        self._check_paths()
        self.directory.mkdir(parents=True, exist_ok=True)
        self._check_paths()
        if self.path.exists():
            return
        temporary: Path | None = None
        try:
            fd, name = tempfile.mkstemp(prefix=".ledger-", suffix=".sqlite3", dir=self.directory)
            os.close(fd)
            temporary = Path(name)
            connection = sqlite3.connect(temporary)
            try:
                connection.executescript(_SCHEMA)
                for table in ("evidence", "evidence_symbols", "evidence_derivations", "claim_evidence"):
                    for operation in ("UPDATE", "DELETE"):
                        connection.execute(
                            f"CREATE TRIGGER immutable_{table}_{operation.lower()} BEFORE {operation} ON {table} "
                            "BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END"
                        )
                connection.execute(f"PRAGMA user_version={_SCHEMA_VERSION}")
                connection.execute(f"PRAGMA application_id={_APPLICATION_ID}")
                connection.commit()
            finally:
                connection.close()
            # A hard link atomically publishes a complete database without replacing
            # another process's database or an existing corrupt/empty file.
            try:
                os.link(temporary, self.path)
            except FileExistsError:
                pass
            self._check_paths()
        except (OSError, sqlite3.Error):
            raise EvidenceStoreError("Unable to initialize evidence storage safely") from None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    @contextmanager
    def _connection(self, *, write: bool = False) -> Iterator[sqlite3.Connection | None]:
        self._check_paths()
        if write:
            self._ensure_database()
        elif not self.path.exists():
            yield None
            return
        connection: sqlite3.Connection | None = None
        try:
            uri = "file:" + quote(str(self.path), safe="/") + ("?mode=rw" if write else "?mode=ro")
            connection = sqlite3.connect(uri, uri=True, timeout=30)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys=ON")
            if (connection.execute("PRAGMA application_id").fetchone()[0] != _APPLICATION_ID
                    or connection.execute("PRAGMA user_version").fetchone()[0] != _SCHEMA_VERSION):
                raise EvidenceStoreError("Existing evidence storage has an unsupported or corrupt schema")
            if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise EvidenceStoreError("Existing evidence storage is corrupt")
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if tables != {"evidence", "evidence_symbols", "evidence_derivations", "claim_evidence"}:
                raise EvidenceStoreError("Existing evidence storage has an unsupported or corrupt schema")
            triggers = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
            expected_triggers = {
                f"immutable_{table}_{operation}" for table in tables for operation in ("update", "delete")
            }
            if triggers != expected_triggers:
                raise EvidenceStoreError("Existing evidence storage has lost its immutability safeguards")
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            if write:
                connection.commit()
        except sqlite3.Error:
            if connection is not None:
                connection.rollback()
            raise EvidenceStoreError("Evidence storage is corrupt or unavailable; it was not replaced") from None
        except Exception:
            if connection is not None and write:
                connection.rollback()
            raise
        finally:
            if connection is not None:
                connection.close()

    def _decode(self, row: sqlite3.Row) -> EvidenceRecord:
        try:
            document = json.loads(row["document"])
            if not isinstance(document, dict) or set(document) != _FIELDS:
                raise ValueError
            if not isinstance(document["retrievedAt"], str):
                raise ValueError
            record = _make_record(
                kind=document["kind"], source=document["source"], payload=document["payload"],
                source_url=document["sourceUrl"], symbols=document["symbols"], observed_at=document["observedAt"],
                published_at=document["publishedAt"], retrieved_at=document["retrievedAt"],
                quality=document["quality"], derived_from=document["derivedFrom"],
            )
            if (record.to_dict() != document or canonical_json(document) != row["document"]
                    or record.evidence_id != row["evidence_id"] or record.content_digest != row["content_digest"]
                    or record.kind != row["kind"] or record.source != row["source"]
                    or record.retrieved_at != row["retrieved_at"]):
                raise ValueError
            return record
        except (ValueError, TypeError, KeyError, RecursionError):
            raise EvidenceStoreError("Stored evidence failed content or provenance verification") from None

    def _get(self, connection: sqlite3.Connection, evidence_id: str) -> EvidenceRecord | None:
        row = connection.execute("SELECT * FROM evidence WHERE evidence_id=?", (evidence_id,)).fetchone()
        if row is None:
            return None
        record = self._decode(row)
        symbols = {row[0] for row in connection.execute("SELECT symbol FROM evidence_symbols WHERE evidence_id=?", (evidence_id,))}
        parents = {row[0] for row in connection.execute("SELECT parent_id FROM evidence_derivations WHERE evidence_id=?", (evidence_id,))}
        if symbols != set(record.symbols) or parents != set(record.derived_from):
            raise EvidenceStoreError("Stored evidence reference indexes failed verification")
        for parent in record.derived_from:
            if connection.execute("SELECT 1 FROM evidence WHERE evidence_id=?", (parent,)).fetchone() is None:
                raise EvidenceStoreError("Stored evidence contains an unknown derivation")
        return record

    def _validate_references(self, connection: sqlite3.Connection | None, evidence_ids: tuple[str, ...]) -> list[EvidenceRecord]:
        records = []
        for evidence_id in evidence_ids:
            record = self._get(connection, evidence_id) if connection is not None else None
            if record is None:
                raise EvidenceValidationError("Unknown evidence reference")
            records.append(record)
        return records

    def record(
        self, *, kind: str, source: str, payload: Any, source_url: str | None = None,
        symbols: list[str] | tuple[str, ...] | None = None, observed_at: str | None = None,
        published_at: str | None = None, retrieved_at: str | None = None,
        quality: dict[str, Any] | None = None, derived_from: list[str] | tuple[str, ...] | None = None,
    ) -> EvidenceRecord:
        """Append public evidence, returning the original immutable record on duplicates."""
        record = _make_record(
            kind=kind, source=source, payload=payload, source_url=source_url, symbols=symbols,
            observed_at=observed_at, published_at=published_at, retrieved_at=retrieved_at,
            quality=quality, derived_from=derived_from,
        )
        with self._connection(write=True) as connection:
            self._validate_references(connection, record.derived_from)
            existing = self._get(connection, record.evidence_id)
            if existing is not None:
                return existing
            connection.execute(
                "INSERT INTO evidence VALUES(?,?,?,?,?,?)",
                (record.evidence_id, record.content_digest, record.kind, record.source, record.retrieved_at, canonical_json(record.to_dict())),
            )
            connection.executemany("INSERT INTO evidence_symbols VALUES(?,?)", [(record.evidence_id, symbol) for symbol in record.symbols])
            connection.executemany("INSERT INTO evidence_derivations VALUES(?,?)", [(record.evidence_id, parent) for parent in record.derived_from])
        return record

    def get(self, evidence_id: str) -> EvidenceRecord | None:
        """Read and verify one record without creating storage."""
        _evidence_id(evidence_id)
        with self._connection() as connection:
            return self._get(connection, evidence_id) if connection is not None else None

    def verify(self, evidence_id: str) -> bool:
        """Return whether an ID exists and verifies; corruption raises instead of hiding it."""
        return self.get(evidence_id) is not None

    def list_records(self, *, symbol: str | None = None, kind: str | None = None, source: str | None = None, limit: int = 100) -> list[EvidenceRecord]:
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 1000:
            raise EvidenceValidationError("Evidence list limit must be an integer between 1 and 1000")
        clauses, arguments = [], []
        if symbol is not None:
            clauses.append("e.evidence_id IN (SELECT evidence_id FROM evidence_symbols WHERE symbol=?)")
            arguments.append(_symbol(symbol))
        if kind is not None:
            if not isinstance(kind, str) or not _KIND.fullmatch(kind):
                raise EvidenceValidationError("Invalid evidence kind filter")
            clauses.append("e.kind=?")
            arguments.append(kind)
        if source is not None:
            if not isinstance(source, str) or not source.strip() or len(source) > 200:
                raise EvidenceValidationError("Invalid evidence source filter")
            clauses.append("e.source=?")
            arguments.append(source.strip())
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with self._connection() as connection:
            if connection is None:
                return []
            rows = connection.execute("SELECT e.evidence_id FROM evidence e" + where + " ORDER BY e.retrieved_at DESC, e.evidence_id LIMIT ?", (*arguments, limit)).fetchall()
            return [self._get(connection, row[0]) for row in rows]

    def validate_references(self, evidence_ids: list[str] | tuple[str, ...]) -> list[EvidenceRecord]:
        """Resolve known references without changing the ledger; reject the entire unknown set."""
        ids = _reference_ids(evidence_ids)
        with self._connection() as connection:
            return self._validate_references(connection, ids)

    def bind_claim(self, claim_id: str, evidence_ids: list[str] | tuple[str, ...]) -> list[EvidenceRecord]:
        """Add immutable evidence bindings to a claim, atomically validating all IDs."""
        claim = _claim_id(claim_id)
        ids = _reference_ids(evidence_ids)
        if not ids:
            return self.get_claim_evidence(claim)
        with self._connection(write=True) as connection:
            self._validate_references(connection, ids)
            connection.executemany("INSERT OR IGNORE INTO claim_evidence VALUES(?,?)", [(claim, evidence_id) for evidence_id in ids])
            bound = connection.execute("SELECT evidence_id FROM claim_evidence WHERE claim_id=? ORDER BY evidence_id", (claim,)).fetchall()
            return [self._get(connection, row[0]) for row in bound]

    def get_claim_evidence(self, claim_id: str) -> list[EvidenceRecord]:
        claim = _claim_id(claim_id)
        with self._connection() as connection:
            if connection is None:
                return []
            rows = connection.execute("SELECT evidence_id FROM claim_evidence WHERE claim_id=? ORDER BY evidence_id", (claim,)).fetchall()
            return self._validate_references(connection, tuple(row[0] for row in rows))

    def claims_for(self, evidence_id: str) -> list[str]:
        _evidence_id(evidence_id)
        with self._connection() as connection:
            if connection is None or self._get(connection, evidence_id) is None:
                raise EvidenceValidationError("Unknown evidence reference")
            return [row[0] for row in connection.execute("SELECT claim_id FROM claim_evidence WHERE evidence_id=? ORDER BY claim_id", (evidence_id,))]

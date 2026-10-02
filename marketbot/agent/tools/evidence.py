"""Explicit recording and read-only lookup of attributable research evidence."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool
from marketbot.domain.market.evidence import (
    EvidenceStore,
    EvidenceStoreError,
    EvidenceValidationError,
)

_ID_SCHEMA = {"type": "string", "pattern": "^ev_[0-9a-f]{64}$"}
_TIME_SCHEMA = {
    "type": "string",
    "description": "Actual source time, ISO-8601 with timezone. Omit if unknown; retrieval time is not source time.",
}


class _EvidenceTool(Tool):
    def __init__(self, workspace: str | Path | EvidenceStore):
        self.store = workspace if isinstance(workspace, EvidenceStore) else EvidenceStore(workspace)

    async def _run(self, method, **kwargs: Any) -> str:
        try:
            result = await asyncio.to_thread(method, **kwargs)
            return json.dumps(result, ensure_ascii=False, allow_nan=False)
        except (EvidenceValidationError, EvidenceStoreError) as exc:
            return json.dumps({"error": {"code": "invalid_evidence" if isinstance(exc, EvidenceValidationError) else "evidence_storage_error", "message": str(exc)}}, ensure_ascii=False)


class EvidenceRecordTool(_EvidenceTool):
    name = "evidence_record"
    read_only = False
    description = (
        "Record immutable public research evidence in the local workspace only when the user "
        "explicitly requests recording. Financial tools automatically record their own results. "
        "Supply the source, actual observation/publication times if known, and public JSON payload; "
        "never record secrets, headers, environment variables or API-key URLs. Returns a stable "
        "evidenceId and verifiable contentDigest. Duplicate observations reuse the original record."
    )
    parameters = {
        "type": "object",
        "properties": {
            "kind": {"type": "string", "maxLength": 80, "description": "Evidence kind, e.g. quote, filing, calculation, or user_note."},
            "source": {"type": "string", "maxLength": 200, "description": "Attributable public provider/tool/document label."},
            "payload": {"type": "object", "description": "Public JSON content retained without summarizing numerical observations."},
            "sourceUrl": {"type": "string", "description": "Optional public HTTP(S) citation with no credentials or API keys."},
            "symbols": {"type": "array", "maxItems": 100, "items": {"type": "string"}},
            "observedAt": _TIME_SCHEMA,
            "publishedAt": _TIME_SCHEMA,
            "quality": {"type": "object", "description": "Public quality metadata, such as freshness, priceType, and warnings."},
            "derivedFrom": {"type": "array", "maxItems": 1000, "items": _ID_SCHEMA, "description": "Existing evidence IDs used to derive this result; unknown references are rejected."},
        },
        "required": ["kind", "source", "payload"],
        "additionalProperties": False,
    }

    async def execute(
        self, kind: str, source: str, payload: dict[str, Any], sourceUrl: str | None = None,
        symbols: list[str] | None = None, observedAt: str | None = None, publishedAt: str | None = None,
        quality: dict[str, Any] | None = None, derivedFrom: list[str] | None = None,
        **kwargs: Any,
    ) -> str:
        def record():
            return {"evidence": self.store.record(
                kind=kind, source=source, payload=payload, source_url=sourceUrl,
                symbols=symbols, observed_at=observedAt, published_at=publishedAt,
                quality=quality, derived_from=derivedFrom,
            ).to_dict()}

        return await self._run(record)


class EvidenceGetTool(_EvidenceTool):
    name = "evidence_get"
    read_only = True
    description = (
        "Read and verify an immutable workspace evidence record by evidenceId. "
        "Returns source times, contentDigest, full public payload, quality and derivations; "
        "unknown records return found=false. No network or writes."
    )
    parameters = {"type": "object", "properties": {"evidenceId": _ID_SCHEMA}, "required": ["evidenceId"], "additionalProperties": False}

    async def execute(self, evidenceId: str, **kwargs: Any) -> str:
        def get():
            record = self.store.get(evidenceId)
            return {"found": record is not None, "evidence": record.to_dict() if record is not None else None}

        return await self._run(get)


class EvidenceListTool(_EvidenceTool):
    name = "evidence_list"
    read_only = True
    description = "List verified local research evidence, optionally by symbol, kind, source or claimId. No network or writes."
    parameters = {
        "type": "object",
        "properties": {
            "symbol": {"type": "string"}, "kind": {"type": "string"}, "source": {"type": "string"},
            "claimId": {"type": "string", "description": "Read the immutable evidence bindings for this claim."},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100},
        },
        "additionalProperties": False,
    }

    async def execute(self, symbol: str | None = None, kind: str | None = None, source: str | None = None, claimId: str | None = None, limit: int = 100, **kwargs: Any) -> str:
        def list_records():
            if claimId is not None:
                if symbol is not None or kind is not None or source is not None:
                    raise EvidenceValidationError("claimId cannot be combined with evidence filters")
                if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 1000:
                    raise EvidenceValidationError("Evidence list limit must be an integer between 1 and 1000")
                records = self.store.get_claim_evidence(claimId)[:limit]
            else:
                records = self.store.list_records(symbol=symbol, kind=kind, source=source, limit=limit)
            return {"records": [record.to_dict() for record in records], "count": len(records)}

        return await self._run(list_records)

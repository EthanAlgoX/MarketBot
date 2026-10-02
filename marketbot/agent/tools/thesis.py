"""Investment thesis declarations and deterministic evidence-backed reviews."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from marketbot.agent.tools.base import Tool
from marketbot.domain.market.evidence import EvidenceStore, EvidenceStoreError
from marketbot.domain.market.sentiment import SentimentEngine
from marketbot.domain.market.thesis import ThesisStorageError, ThesisStore, utc_now_iso

if TYPE_CHECKING:
    from marketbot.config.schema import MarketToolsConfig

_NUMBER = {"anyOf": [{"type": "number"}, {"type": "string", "minLength": 1}],
           "description": "Finite numeric value or precise decimal string."}


class ThesisTrackerTool(Tool):
    """Keep legacy CRUD arguments while separating claims from verified conditions."""

    name = "thesis_tracker"
    description = (
        "Create, inspect, update, and review local investment theses. Persist explicit numeric "
        "conditions on create/update; review them using immutable evidenceId and JSON Pointer "
        "references to real stored numeric facts. Free-text sentiment is an observation only. "
        "Explicit verdicts/status/confidence are unverified declarations; rule reviews do not "
        "infer confidence. Missing, stale, synthetic, or mismatched facts leave the thesis unchanged. "
        "Example: rule {id:'floor',metric:'price',operator:'lt',threshold:'100',effect:'falsified',"
        "maxAgeSeconds:86400}, observation {metric:'price',evidenceId:'ev_...',jsonPointer:'/quotes/0/price'}."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["create", "get", "list", "update", "review"]},
            "thesisId": {"type": "string"}, "symbol": {"type": "string"}, "thesis": {"type": "string"},
            "confidence": {"type": "number"}, "confidenceDelta": {"type": "number"},
            "status": {"type": "string"}, "note": {"type": "string"},
            "evidence": {"type": "string", "description": "Free-text observation. Its sentiment cannot verify or falsify a thesis."},
            "verdict": {"type": "string", "enum": ["strengthened", "weakened", "unchanged", "falsified"],
                        "description": "Explicit declaration; separate from deterministic rule verification."},
            "tags": {"type": "array", "items": {"type": "string"}},
            "drivers": {"type": "array", "items": {"type": "string"}},
            "risks": {"type": "array", "items": {"type": "string"}},
            "evidenceIds": {"type": "array", "maxItems": 100, "items": {"type": "string"},
                            "description": "Optional real ledger references for create/update declarations. References alone do not make a declaration verified."},
            "rules": {
                "type": "array", "maxItems": 100,
                "description": "Create/update only. Omit to preserve conditions; [] clears them. Metrics must name the stored numeric leaf or its parent metric/name; use the same unit as the source field.",
                "items": {"type": "object", "properties": {
                    "id": {"type": "string", "minLength": 1, "maxLength": 100},
                    "metric": {"type": "string", "minLength": 1, "maxLength": 100},
                    "operator": {"type": "string", "enum": ["lt", "lte", "gt", "gte", "eq", "ne"]},
                    "threshold": _NUMBER,
                    "effect": {"type": "string", "enum": ["weakened", "falsified", "strengthened"]},
                    "maxAgeSeconds": {"type": "integer", "minimum": 1, "maximum": 315360000, "default": 86400,
                                      "description": "Maximum source-observation age; default 24 hours. Specify an appropriate longer age for historical or reported fundamentals."},
                }, "required": ["id", "metric", "operator", "threshold", "effect"]},
            },
            "observations": {
                "type": "array", "maxItems": 100,
                "description": "Review only. One observation per condition metric. Data/time come from the referenced payload, never model-supplied values. All rules need valid current facts before any lifecycle change.",
                "items": {"type": "object", "properties": {
                    "metric": {"type": "string", "minLength": 1}, "evidenceId": {"type": "string"},
                    "jsonPointer": {"type": "string", "minLength": 1,
                                    "description": "RFC 6901 pointer to an immutable numeric payload field, e.g. /quotes/0/price or /facts/0/value."},
                    "value": {**_NUMBER, "description": "Optional assertion that must equal the stored fact; cannot supply missing values."},
                    "observedAt": {"type": "string", "description": "Optional assertion that must equal stored source time, including timezone. Retrieval time is not observation time."},
                }, "required": ["metric", "evidenceId", "jsonPointer"]},
            },
            "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
        },
        "required": ["action"],
    }

    def __init__(self, config: MarketToolsConfig | None = None, workspace: Path | None = None):
        self._config = config
        self._workspace = Path(workspace) if workspace else None
        self._store = ThesisStore(self._workspace) if self._workspace else None
        self._evidence_store = EvidenceStore(self._workspace) if self._workspace else None
        self._sentiment = SentimentEngine(backend=config.sentiment_backend if config else "lexicon",
                                          model=config.sentiment_model if config else "")

    async def execute(
        self, action: str, thesisId: str | None = None, symbol: str | None = None,
        thesis: str | None = None, confidence: float | None = None, confidenceDelta: float | None = None,
        status: str | None = None, note: str = "", evidence: str = "", verdict: str | None = None,
        tags: list[str] | None = None, drivers: list[str] | None = None, risks: list[str] | None = None,
        limit: int = 20, rules: list[dict[str, Any]] | None = None,
        observations: list[dict[str, Any]] | None = None, evidenceIds: list[str] | None = None,
        **kwargs: Any,
    ) -> str:
        def encode(value: dict[str, Any]) -> str:
            return json.dumps(value, ensure_ascii=False, allow_nan=False)

        if self._store is None:
            return encode({"error": "workspace is required for thesis tracking"})
        op = str(action or "").strip().lower()
        clean_id = str(thesisId or "").strip()
        try:
            if not isinstance(note, str) or not isinstance(evidence, str):
                raise ValueError("note and evidence must be strings")
            if status is not None and (not isinstance(status, str) or not status.strip()):
                raise ValueError("status must be a nonempty string")
            if op == "list":
                if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
                    raise ValueError("limit must be an integer between 1 and 100")
                records = self._store.list_theses()[:limit]
                return encode({"asOf": utc_now_iso(), "action": op, "theses": [item.to_dict() for item in records], "count": len(records)})
            if op in {"get", "update", "review"} and not clean_id:
                raise ValueError(f"thesisId is required for {op}")
            if op == "get":
                record = self._store.get_thesis(clean_id)
                if record is None:
                    return encode({"error": "thesis not found", "thesisId": clean_id})
                return encode({"asOf": utc_now_iso(), "action": op, "thesis": record.to_dict()})
            if op == "create":
                if evidenceIds:
                    self._evidence_store.validate_references(evidenceIds)
                record = self._store.create_thesis(
                    symbol=symbol, thesis=thesis, confidence=0.5 if confidence is None else confidence,
                    tags=tags, drivers=drivers, risks=risks, note=note, rules=rules,
                    evidence_ids=evidenceIds, evidence_store=self._evidence_store,
                )
                return encode({"asOf": utc_now_iso(), "action": op, "thesis": record.to_dict()})
            if op == "update":
                sentiment = self._sentiment.analyze_text(evidence).to_dict() if evidence.strip() else None
                record = self._store.update_thesis(
                    clean_id, status=status, confidence=confidence, confidence_delta=confidenceDelta,
                    note=note, evidence=evidence, verdict=verdict, tags=tags, drivers=drivers, risks=risks,
                    rules=rules, evidence_ids=evidenceIds, evidence_store=self._evidence_store,
                )
                if record is None:
                    return encode({"error": "thesis not found", "thesisId": clean_id})
                event = record.history[-1]
                return encode({"asOf": utc_now_iso(), "action": op, "verdict": verdict or "unchanged",
                               "decisionSource": event["decisionSource"], "verificationStatus": event["verificationStatus"],
                               "derivedSentiment": sentiment, "thesis": record.to_dict()})
            if op == "review":
                if any(item is not None for item in (rules, status, verdict, confidence, confidenceDelta, evidenceIds)):
                    raise ValueError("review evaluates persisted rules only; use update for rules or explicit declarations")
                reviewed = self._store.review_thesis(clean_id, observations=[] if observations is None else observations, evidence_store=self._evidence_store, note=note)
                if reviewed is None:
                    return encode({"error": "thesis not found", "thesisId": clean_id})
                record, review = reviewed
                return encode({"asOf": utc_now_iso(), "action": op, **review, "thesis": record.to_dict()})
            raise ValueError("unsupported thesis action")
        except (ThesisStorageError, EvidenceStoreError) as exc:
            return encode({"ok": False, "error": {"type": "storage_error", "message": str(exc)}})
        except (ValueError, TypeError, OSError) as exc:
            return encode({"ok": False, "error": {"type": "invalid_input", "message": str(exc)}})

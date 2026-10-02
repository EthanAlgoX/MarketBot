"""Capture public financial tool facts in the workspace evidence ledger."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool


def capture_finance_result(workspace: Path, name: str, result: str) -> str:
    """Return data plus verified ledger references, retaining source observation times."""
    from marketbot.domain.market.evidence import EvidenceStore

    try:
        payload = json.loads(result)
    except (ValueError, TypeError):
        return result
    if not isinstance(payload, dict) or payload.get("error") or payload.get("ok") is False:
        return result
    store = EvidenceStore(workspace)
    refs = []
    try:
        for key in ("snapshot", "news", "macro", "fundamentals"):
            component = payload.get(key)
            if isinstance(component, dict) and component:
                captured = json.loads(capture_finance_result(workspace, f"market_{key}", json.dumps(component, ensure_ascii=False)))
                payload[key] = captured
                refs.extend(captured.get("evidenceIds", []))
        # Individual immutable records allow a review to point to /price or /value.
        facts = []
        for key in ("quotes", "items", "indicators"):
            for row in payload.get(key, []) or []:
                if isinstance(row, dict):
                    facts.append((key, row))
        for key, row in facts:
            record = store.record(
                kind={"quotes": "quote", "items": "source_item", "indicators": "macro"}[key],
                source=str(row.get("provider") or row.get("source") or payload.get("source") or name),
                payload=row,
                source_url=row.get("url") or None,
                symbols=[row["symbol"]] if row.get("symbol") else [],
                observed_at=row.get("observedAt"),
                published_at=row.get("publishedAt"),
                retrieved_at=row.get("retrievedAt") or payload.get("asOf"),
                quality={"priceType": row.get("priceType", "unknown"), "observationTimeKnown": bool(row.get("observedAt"))},
            )
            refs.append(record.evidence_id)
            row["evidenceId"] = record.evidence_id
        parent = store.record(
            kind="tool_result", source=name, payload=payload,
            symbols=payload.get("symbols", []), retrieved_at=payload.get("asOf"),
            quality={"derived": name not in {"market_snapshot", "market_news", "market_fundamentals", "market_macro"}, "warnings": payload.get("warnings", [])},
            derived_from=refs,
        )
        payload["evidenceIds"] = [*refs, parent.evidence_id]
        payload["evidenceRecordId"] = parent.evidence_id
    except (ValueError, OSError, RuntimeError) as exc:
        # Data remains inspectable; a failed ledger must never imply recorded evidence.
        payload["evidenceRecording"] = {"ok": False, "errorType": type(exc).__name__, "recordedReferenceCount": len(refs)}
        if refs:
            payload["evidenceIds"] = refs
        payload.setdefault("warnings", []).append("Complete evidence recording failed; inspect individually recorded references before citing them.")
    return json.dumps(payload, ensure_ascii=False)


class FinanceEvidenceTool(Tool):
    """Preserve the native schema while adding persisted evidence to research results."""

    def __init__(self, tool: Tool, workspace: Path):
        self._tool = tool
        self._workspace = workspace

    @property
    def name(self) -> str:
        return self._tool.name

    @property
    def description(self) -> str:
        return self._tool.description + " Results include workspace evidence IDs when persistence succeeds."

    @property
    def parameters(self) -> dict[str, Any]:
        return self._tool.parameters

    async def execute(self, **kwargs: Any) -> str:
        return capture_finance_result(self._workspace, self.name, await self._tool.execute(**kwargs))

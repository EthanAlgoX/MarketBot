"""Local financial watch definitions, evidence checks, and alert acknowledgements."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool
from marketbot.agent.tools.portfolio import DECIMAL_NUMBER, PortfolioRiskTool
from marketbot.domain.market.evidence import EvidenceStoreError
from marketbot.domain.market.watch import WatchStore

_EVIDENCE_IDS = {"type": "array", "items": {"type": "string", "minLength": 1}, "maxItems": 200}
_HOLDINGS = {
    **PortfolioRiskTool.parameters["properties"]["holdings"],
    "items": {**PortfolioRiskTool.parameters["properties"]["holdings"]["items"],
              "properties": {**PortfolioRiskTool.parameters["properties"]["holdings"]["items"]["properties"], "evidenceIds": _EVIDENCE_IDS}},
}
_FX = {
    **PortfolioRiskTool.parameters["properties"]["fxRates"],
    "additionalProperties": {**PortfolioRiskTool.parameters["properties"]["fxRates"]["additionalProperties"],
                             "properties": {**PortfolioRiskTool.parameters["properties"]["fxRates"]["additionalProperties"]["properties"], "evidenceIds": _EVIDENCE_IDS}},
}


class MarketWatchTool(Tool):
    name = "market_watch"
    description = (
        "Save/get/list/disable local portfolio or watchlist monitors; evaluate supplied quote and FX "
        "evidence against explicit price-change, portfolio-weight and freshness rules; read/ack the "
        "durable local alert outbox. Requires actual observedAt/source/currency and matching evidence IDs. "
        "First valid evaluation establishes a quiet baseline. Unchanged rule states do not alert; "
        "incomplete/stale data do not advance valid state. No network, external messages, or trades. "
        "save replaces a COMPLETE definition, preserves audit history, and explicitly reactivates it."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["save", "get", "list", "remove", "evaluate", "outbox", "ack"]},
            "watchId": {"type": "string", "minLength": 1, "maxLength": 100},
            "name": {"type": "string", "minLength": 1, "maxLength": 200},
            "kind": {"type": "string", "enum": ["portfolio", "watchlist"]},
            "symbols": {"type": "array", "maxItems": 100, "items": {"type": "string", "minLength": 1, "maxLength": 40}},
            "holdings": _HOLDINGS,
            "baseCurrency": PortfolioRiskTool.parameters["properties"]["baseCurrency"],
            "cash": PortfolioRiskTool.parameters["properties"]["cash"],
            "fxRates": _FX,
            "maxAgeSeconds": {**DECIMAL_NUMBER, "description": "Saved freshness cutoff for every quote and foreign FX observation. Defaults to 3600 seconds; maximum one year."},
            "rules": {
                "type": "array", "maxItems": 20,
                "items": {"type": "object", "properties": {
                    "id": {"type": "string", "minLength": 1, "maxLength": 100},
                    "type": {"type": "string", "enum": ["price_change", "max_weight", "freshness"]},
                    "symbol": {"type": "string", "description": "Optional target; otherwise rule applies to each security."},
                    "thresholdPct": {**DECIMAL_NUMBER, "description": "Positive percent: 5 means 5%. max_weight compares security value / total including cash; price_change uses first valid price."},
                    "direction": {"type": "string", "enum": ["up", "down", "either"]},
                    "maxAgeSeconds": {**DECIMAL_NUMBER, "description": "Explicit freshness-rule cutoff; combines with saved cutoff using the stricter limit."},
                }, "required": ["type"]},
            },
            "observations": {
                "type": "array", "maxItems": 100,
                "items": {"type": "object", "properties": {
                    "symbol": {"type": "string"}, "price": DECIMAL_NUMBER,
                    "currency": {"type": "string"}, "source": {"type": "string"},
                    "provider": {"type": "string"}, "observedAt": {"type": "string"}, "evidenceIds": _EVIDENCE_IDS,
                }, "required": ["symbol", "price", "currency"]},
            },
            "asOf": {"type": "string", "description": "Evaluation time with timezone, not a substitute for each observation's actual timestamp."},
            "evidenceIds": _EVIDENCE_IDS,
            "alertId": {"type": "string", "minLength": 1},
            "includeInactive": {"type": "boolean"},
            "includeAcknowledged": {"type": "boolean"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000},
        },
        "required": ["action"],
    }

    def __init__(self, workspace: Path, config: Any = None, evidence_store: Any = None):
        self.store = WatchStore(workspace, evidence_store=evidence_store)

    async def execute(
        self, action: str, watchId: str | None = None, name: str | None = None,
        kind: str = "watchlist", symbols: list[str] | None = None, holdings: Any = None,
        baseCurrency: str | None = None, cash: Any = None, fxRates: Any = None,
        maxAgeSeconds: Any = 3600, rules: Any = None, observations: Any = None,
        asOf: str | None = None, evidenceIds: Any = None, alertId: str | None = None,
        includeInactive: bool = False, includeAcknowledged: bool = False, limit: int = 200,
        **kwargs: Any,
    ) -> str:
        try:
            if action in {"get", "remove", "evaluate"} and not watchId:
                result = {"ok": False, "error": {"type": "invalid_watch", "message": f"{action} requires watchId."}}
            elif action == "save":
                result = self.store.save(name=name, kind=kind, watch_id=watchId, symbols=symbols, holdings=holdings,
                                         base_currency=baseCurrency, cash=cash, fx_rates=fxRates, rules=rules,
                                         max_age_seconds=maxAgeSeconds)
            elif action == "get":
                result = self.store.get(watchId)
            elif action == "list":
                result = self.store.list(include_inactive=includeInactive)
            elif action == "remove":
                result = self.store.remove(watchId)
            elif action == "evaluate":
                result = self.store.evaluate(watchId, observations=observations, holdings=holdings, cash=cash,
                                             fx_rates=fxRates, as_of=asOf, evidence_ids=evidenceIds)
            elif action == "outbox":
                result = self.store.outbox(watch_id=watchId, include_acknowledged=includeAcknowledged, limit=limit)
            elif action == "ack" and alertId:
                result = self.store.ack(alertId)
            else:
                result = {"ok": False, "error": {"type": "invalid_watch", "message": "Unknown action, or ack without alertId."}}
        except (sqlite3.DatabaseError, OSError, ValueError, EvidenceStoreError) as exc:
            result = {"ok": False, "error": {"type": "watch_storage_error", "message": f"Watch storage could not be accessed ({type(exc).__name__}); existing data was preserved."}}
        return json.dumps(result, ensure_ascii=False, allow_nan=False)

"""JSONL rollout recorder for market signal decisions."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from marketbot.rl.types import MarketSignalDecision, MarketSignalFeatures


class MarketSignalRolloutRecorder:
    """Persist signal decisions as replayable JSONL events."""

    def __init__(self, workspace: Path | None, relative_path: str) -> None:
        self._workspace = workspace
        self._relative_path = str(relative_path or "").strip()

    @property
    def enabled(self) -> bool:
        return self._workspace is not None and bool(self._relative_path)

    @property
    def path(self) -> Path | None:
        if not self.enabled:
            return None
        return (self._workspace / self._relative_path).resolve()

    def record(
        self,
        *,
        features: MarketSignalFeatures,
        decision: MarketSignalDecision,
        rendered_result: dict[str, Any],
    ) -> Path | None:
        target = self.path
        if target is None:
            return None
        target.parent.mkdir(parents=True, exist_ok=True)
        event = {
            "ts": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "event": "market_signal_decision",
            "features": features.to_dict(),
            "decision": decision.to_dict(),
            "result": rendered_result,
        }
        with target.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        return target

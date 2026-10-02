"""JSONL rollout recorder for market signal decisions."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path, PureWindowsPath
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
        workspace = Path(self._workspace).expanduser().resolve()
        relative = Path(self._relative_path)
        if relative.is_absolute() or PureWindowsPath(self._relative_path).drive or ".." in relative.parts or "\\" in self._relative_path:
            raise ValueError("Rollout log must use a relative path inside its workspace")
        target = workspace / relative
        current = workspace
        for part in relative.parts:
            current /= part
            if current.is_symlink():
                raise ValueError("Rollout log symlink paths are forbidden")
        if target.resolve() == workspace or not target.resolve().is_relative_to(workspace):
            raise ValueError("Rollout log must remain inside its workspace")
        if target.exists() and not target.is_file():
            raise ValueError("Rollout log must be a file")
        return target

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
        event = {
            "ts": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "event": "market_signal_decision",
            "features": features.to_dict(),
            "decision": decision.to_dict(),
            "result": rendered_result,
        }
        try:
            serialized = json.dumps(event, ensure_ascii=False, allow_nan=False) + "\n"
            serialized.encode("utf-8")
        except (ValueError, TypeError, UnicodeError):
            raise ValueError("Rollout events must contain finite, JSON-compatible values") from None
        target.parent.mkdir(parents=True, exist_ok=True)
        target = self.path  # Recheck path boundaries after creating directories.
        with target.open("a", encoding="utf-8") as handle:
            handle.write(serialized)
        return target

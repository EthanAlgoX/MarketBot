"""Persistence helpers for skill routing scores."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class SkillScoreStore:
    """JSON-backed score store under the workspace data directory."""

    def __init__(self, workspace: Path):
        self.workspace = Path(workspace)
        self.path = self.workspace / "data" / "skill_scores.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, Any]:
        """Load the score payload or return an empty structure."""
        if not self.path.exists():
            return {"version": 1, "buckets": {}}
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"version": 1, "buckets": {}}
        if not isinstance(payload, dict):
            return {"version": 1, "buckets": {}}
        buckets = payload.get("buckets")
        if not isinstance(buckets, dict):
            payload["buckets"] = {}
        payload.setdefault("version", 1)
        return payload

    def save(self, payload: dict[str, Any]) -> None:
        """Persist the score payload."""
        safe_payload = {
            "version": int(payload.get("version", 1) or 1),
            "buckets": payload.get("buckets", {}),
        }
        self.path.write_text(json.dumps(safe_payload, ensure_ascii=False, indent=2), encoding="utf-8")

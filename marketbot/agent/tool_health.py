"""Runtime tool health checks used to reduce avoidable tool-call failures."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ToolHealthStatus:
    """One tool's runtime health snapshot."""

    status: str
    reason: str = ""


class ToolHealthSnapshot:
    """Static tool health evaluator for prompt-time tool exposure."""

    def __init__(self) -> None:
        self._statuses: dict[str, ToolHealthStatus] = {}

    def refresh(self, tools: dict[str, Any]) -> None:
        """Recompute health for all registered tools."""
        self._statuses = {name: self._evaluate(tool) for name, tool in tools.items()}

    def healthy_names(self) -> set[str]:
        """Return tool names considered safe enough to expose to the model."""
        return {
            name
            for name, state in self._statuses.items()
            if state.status in {"healthy", "degraded"}
        }

    def status_payload(self) -> dict[str, dict[str, str]]:
        """Return a JSON-serializable status payload."""
        return {
            name: {"status": state.status, "reason": state.reason}
            for name, state in self._statuses.items()
        }

    def _evaluate(self, tool: Any) -> ToolHealthStatus:
        enabled = getattr(tool, "enabled", True)
        if enabled is False:
            return ToolHealthStatus(status="disabled", reason="tool disabled by config")

        command = getattr(tool, "command", None)
        if isinstance(command, str) and command.strip():
            expanded = Path(command).expanduser()
            if not expanded.exists() and not shutil.which(command):
                return ToolHealthStatus(status="unavailable", reason=f"command not found: {command}")

        api_key = getattr(tool, "api_key", None)
        if isinstance(api_key, str) and not api_key.strip() and getattr(tool, "name", "") == "web_search":
            return ToolHealthStatus(status="degraded", reason="missing api_key; web search likely unavailable")

        return ToolHealthStatus(status="healthy")

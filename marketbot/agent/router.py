"""Deterministic request routing for execution mode selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


RouteMode = Literal["direct_react", "planned_task", "market_fast_path", "scheduled_task"]


@dataclass(slots=True)
class RouteDecision:
    """Structured route decision for one inbound request."""

    mode: RouteMode
    reason: str


class RequestRouter:
    """Cheap router used before planner-driven execution is introduced."""

    _PLANNED_MARKERS = (
        "步骤",
        "分步骤",
        "先",
        "然后",
        "最后",
        "计划",
        "方案",
        "报告",
        "digest",
        "research",
        "report",
        "analyze and",
    )
    _MARKET_FAST_PATH_MARKERS = (
        "每日机会",
        "今日机会",
        "市场机会",
        "daily opportunity",
        "market opportunity",
    )

    def decide(self, *, text: str, channel: str, metadata: dict | None = None) -> RouteDecision:
        """Pick the execution mode for the current request."""
        normalized = str(text or "").strip().lower()
        if channel == "system":
            return RouteDecision(mode="scheduled_task", reason="system_message")
        if any(token in normalized for token in ("/new", "/help", "/stop")):
            return RouteDecision(mode="direct_react", reason="slash_command")
        if any(marker.lower() in normalized for marker in self._MARKET_FAST_PATH_MARKERS):
            return RouteDecision(mode="market_fast_path", reason="market_scan")
        if any(marker.lower() in normalized for marker in self._PLANNED_MARKERS):
            return RouteDecision(mode="planned_task", reason="multi_step_intent")
        return RouteDecision(mode="direct_react", reason="default")

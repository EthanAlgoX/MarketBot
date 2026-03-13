"""PRM payload helpers for future market-step judging."""

from __future__ import annotations

from typing import Any


def build_market_step_payload(
    *,
    task_instruction: str,
    history: list[dict[str, Any]],
    current_step: dict[str, Any],
) -> dict[str, Any]:
    """Create a compact PRM payload for a market-research step."""
    return {
        "task_instruction": task_instruction,
        "history": history,
        "current": current_step,
    }

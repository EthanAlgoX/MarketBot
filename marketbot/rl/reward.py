"""Reward helpers for offline market backtests."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(slots=True)
class RewardBreakdown:
    """Simple composite reward representation."""

    realized_return: float = 0.0
    max_drawdown_penalty: float = 0.0
    turnover_penalty: float = 0.0
    volatility_penalty: float = 0.0
    slippage_penalty: float = 0.0
    rule_violation_penalty: float = 0.0

    @property
    def score(self) -> float:
        return (
            self.realized_return
            - self.max_drawdown_penalty
            - self.turnover_penalty
            - self.volatility_penalty
            - self.slippage_penalty
            - self.rule_violation_penalty
        )

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["score"] = round(self.score, 6)
        return payload

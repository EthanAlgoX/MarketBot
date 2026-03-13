"""Shared typed payloads for MarketBot RL scaffolding."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class MarketSignalFeatures:
    """Normalized features used by a market decision policy."""

    symbol: str
    price_change_pct: float = 0.0
    news_sentiment: float = 0.0
    social_sentiment: float = 0.0
    macro_risk: float = 0.0
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SignalAction:
    """Structured action emitted before user-facing rendering."""

    action: str
    position_pct: float
    stop_loss_pct: float
    take_profit_pct: float | None
    holding_horizon: str
    confidence: float
    evidence_keys: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class MarketSignalDecision:
    """Decision payload returned by a policy backend."""

    action: SignalAction
    score: float
    risk_level: str
    rationale: list[str] = field(default_factory=list)
    policy_mode: str = "heuristic"
    policy_name: str = "heuristic_v1"
    diagnostics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["structured_action"] = payload.pop("action")
        return payload

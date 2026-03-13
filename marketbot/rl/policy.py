"""Policy backends for market decision tools."""

from __future__ import annotations

from typing import Any

from marketbot.rl.types import MarketSignalDecision, MarketSignalFeatures, SignalAction


def clamp(value: float, lower: float, upper: float) -> float:
    """Clamp a numeric value into a closed interval."""
    return max(lower, min(upper, value))


def evidence_keys(evidence: list[str]) -> list[str]:
    """Extract compact evidence keys from raw evidence strings."""
    keys: list[str] = []
    for item in evidence:
        text = str(item or "").strip()
        if not text:
            continue
        head = text.split("=", 1)[0].split(":", 1)[0].strip().lower()
        normalized = "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in head).strip("_")
        key = normalized or "evidence"
        if key not in keys:
            keys.append(key)
    return keys


class HeuristicMarketSignalPolicy:
    """Current heuristic signal policy, exposed behind an RL-friendly interface."""

    def __init__(
        self,
        *,
        min_confidence: float,
        max_position_pct: float,
        stop_loss_pct: float,
        weights: tuple[float, float, float, float],
        mode: str = "heuristic",
    ) -> None:
        self._min_confidence = min_confidence
        self._max_position_pct = max_position_pct
        self._stop_loss_pct = stop_loss_pct
        self._weights = weights
        self._mode = mode

    @staticmethod
    def action_from_score(score: float) -> str:
        if score >= 0.35:
            return "buy"
        if score <= -0.35:
            return "sell"
        if score <= -0.15:
            return "reduce"
        return "watch"

    def decide(self, features: MarketSignalFeatures) -> MarketSignalDecision:
        wm, wn, ws, wr = self._weights

        momentum = clamp(features.price_change_pct / 5.0, -1.0, 1.0)
        news = clamp(features.news_sentiment, -1.0, 1.0)
        social = clamp(features.social_sentiment, -1.0, 1.0)
        macro_penalty = clamp(features.macro_risk, 0.0, 1.0)

        score = (wm * momentum) + (wn * news) + (ws * social) - (wr * macro_penalty)
        score = clamp(score, -1.0, 1.0)
        action = self.action_from_score(score)

        evidence_count = len(features.evidence)
        confidence = 0.45 + abs(score) * 0.40 + min(evidence_count, 4) * 0.03
        confidence = clamp(confidence, 0.05, 0.95)
        if confidence < self._min_confidence:
            action = "watch"

        position_pct = 0.0 if action == "watch" else round(self._max_position_pct * confidence, 4)
        risk_level = "high" if macro_penalty >= 0.65 else "medium" if macro_penalty >= 0.35 else "low"
        action_payload = SignalAction(
            action=action,
            position_pct=position_pct,
            stop_loss_pct=self._stop_loss_pct,
            take_profit_pct=round(self._stop_loss_pct * 2.0, 4) if action != "watch" else None,
            holding_horizon="swing",
            confidence=round(confidence, 4),
            evidence_keys=evidence_keys(features.evidence),
        )
        rationale = [
            f"momentum={momentum:.2f}",
            f"news={news:.2f}",
            f"social={social:.2f}",
            f"macroRisk={macro_penalty:.2f}",
        ]
        diagnostics: dict[str, Any] = {
            "requestedMode": self._mode,
            "effectiveMode": "heuristic",
            "fallbackUsed": self._mode != "heuristic",
            "evidenceCount": evidence_count,
        }
        if self._mode != "heuristic":
            diagnostics["fallbackReason"] = "rl policy backend is not configured"
        return MarketSignalDecision(
            action=action_payload,
            score=round(score, 4),
            risk_level=risk_level,
            rationale=rationale,
            policy_mode=self._mode,
            policy_name="heuristic_v1",
            diagnostics=diagnostics,
        )

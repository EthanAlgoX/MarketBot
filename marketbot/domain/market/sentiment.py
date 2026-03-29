"""Sentiment backends for market-facing tools."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value into a closed interval."""
    return max(lower, min(upper, value))


@dataclass(slots=True)
class SentimentResult:
    """Normalized sentiment result used by market tools."""

    score: float
    label: str
    backend: str
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Return a stable JSON-serializable payload."""
        return {
            "score": round(clamp(self.score, -1.0, 1.0), 4),
            "label": self.label,
            "backend": self.backend,
            "reason": self.reason,
        }


_POSITIVE_SENTIMENT_TERMS = {
    "beat",
    "strong",
    "surge",
    "bullish",
    "upgrade",
    "record",
    "breakout",
    "rally",
    "growth",
    "超预期",
    "增长",
    "上调",
    "突破",
}
_NEGATIVE_SENTIMENT_TERMS = {
    "miss",
    "weak",
    "bearish",
    "downgrade",
    "drop",
    "selloff",
    "lawsuit",
    "recession",
    "risk",
    "爆雷",
    "下调",
    "下滑",
}


class LexiconSentimentEngine:
    """Low-dependency finance-aware lexical sentiment engine."""

    backend_name = "lexicon"

    def analyze_text(self, text: str) -> SentimentResult:
        """Score text using a simple finance lexicon."""
        lower = str(text or "").lower()
        pos = sum(1 for term in _POSITIVE_SENTIMENT_TERMS if term in lower)
        neg = sum(1 for term in _NEGATIVE_SENTIMENT_TERMS if term in lower)
        score = clamp((pos - neg) / 4.0, -1.0, 1.0)
        if score > 0.15:
            label = "positive"
        elif score < -0.15:
            label = "negative"
        else:
            label = "neutral"
        if pos == 0 and neg == 0:
            reason = "no lexicon hits"
        elif pos > neg:
            reason = f"positive hits={pos}, negative hits={neg}"
        elif neg > pos:
            reason = f"negative hits={neg}, positive hits={pos}"
        else:
            reason = f"balanced hits={pos}"
        return SentimentResult(score=score, label=label, backend=self.backend_name, reason=reason)


class SentimentEngine:
    """Facade around pluggable sentiment backends."""

    def __init__(self, backend: str = "lexicon", model: str = ""):
        self.backend = (backend or "lexicon").strip().lower()
        self.model = model or ""
        self._lexicon = LexiconSentimentEngine()

    def analyze_text(self, text: str) -> SentimentResult:
        """Analyze text with configured backend and degrade safely."""
        if self.backend == "finbert":
            result = self._try_finbert(text)
            if result is not None:
                return result
        return self._lexicon.analyze_text(text)

    def _try_finbert(self, text: str) -> SentimentResult | None:
        """Attempt local FinBERT inference. Returns None on any failure."""
        try:
            from transformers import pipeline  # type: ignore
        except Exception:
            return None

        model_name = self.model or "ProsusAI/finbert"
        try:
            classifier = pipeline("sentiment-analysis", model=model_name, tokenizer=model_name)
            payload = classifier(str(text or "")[:4000])[0]
        except Exception:
            return None

        raw_label = str(payload.get("label") or "").lower()
        confidence = float(payload.get("score") or 0.0)
        if "positive" in raw_label:
            score = confidence
            label = "positive"
        elif "negative" in raw_label:
            score = -confidence
            label = "negative"
        else:
            score = 0.0
            label = "neutral"
        return SentimentResult(
            score=score,
            label=label,
            backend="finbert",
            reason=f"model={model_name}",
        )

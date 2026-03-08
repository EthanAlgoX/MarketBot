"""Recursive memory retrieval inspired by OpenViking.

Directory recursive retrieval strategy:
1. Intent Analysis - Generate multiple retrieval conditions
2. Initial Positioning - Use L0 (abstract) to quickly locate high-score directory
3. Refined Exploration - Secondary retrieval within L1 (overview)
4. Recursive Drill-down - Repeat for subdirectories if exist
5. Result Aggregation - Return most relevant context
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from marketbot.providers.base import LLMProvider
    from marketbot.agent.memory import MemoryStore


@dataclass
class RetrievalResult:
    uri: str
    layer: str
    score: float
    snippet: str


_INTENT_ANALYSIS_PROMPT = """Analyze the user query and decompose it into 3-5 independent retrieval keywords/phrases.

Query: {query}

Output ONLY valid JSON array:
["keyword1", "keyword2", "keyword3"]

Focus on:
- Key concepts and entities
- Action intents (e.g., "find preferences", "get project info")
- Context modifiers (e.g., "recent", "important", "detailed")"""


class RecursiveRetriever:
    """Recursive memory retrieval with intent analysis and layered search."""

    def __init__(self, memory_store: MemoryStore):
        self.store = memory_store

    async def find(
        self,
        query: str,
        provider: LLMProvider,
        model: str,
    ) -> list[RetrievalResult]:
        """Find relevant memory using recursive retrieval strategy.

        Args:
            query: User query to search for
            provider: LLM provider for intent analysis
            model: Model to use

        Returns:
            List of retrieval results sorted by relevance
        """
        logger.info("Recursive retrieval for query: {}", query)

        intents = await self._analyze_intent(query, provider, model)
        logger.debug("Intents: {}", intents)

        candidates = await self._l0_scan(intents)
        logger.debug("L0 candidates: {}", len(candidates))

        refined = await self._l1_refine(candidates, intents, provider, model)
        logger.debug("L1 refined: {}", len(refined))

        results = self._aggregate(refined)
        return results

    async def _analyze_intent(self, query: str, provider: LLMProvider, model: str) -> list[str]:
        """Intent Analysis - Decompose query into multiple retrieval conditions."""
        try:
            response = await provider.chat(
                messages=[
                    {"role": "system", "content": "Output ONLY valid JSON."},
                    {"role": "user", "content": _INTENT_ANALYSIS_PROMPT.format(query=query)},
                ],
                model=model,
            )

            content = (response.content or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            intents = json.loads(content)
            return intents if isinstance(intents, list) else [query]
        except Exception:
            logger.exception("Intent analysis failed, using query as-is")
            return [query]

    async def _l0_scan(self, intents: list[str]) -> list[RetrievalResult]:
        """L0 Layer Scan - Quick positioning using abstract."""
        results = []
        abstract = self.store.layered.read_abstract()

        if not abstract:
            return results

        for intent in intents:
            score = self._keyword_score(intent, abstract)
            results.append(RetrievalResult(
                uri="memory/.abstract",
                layer="L0",
                score=score,
                snippet=abstract[:200],
            ))

        return sorted(results, key=lambda x: x.score, reverse=True)[:5]

    async def _l1_refine(
        self,
        candidates: list[RetrievalResult],
        intents: list[str],
        provider: LLMProvider,
        model: str,
    ) -> list[RetrievalResult]:
        """L1 Layer Refinement - Secondary retrieval within overview."""
        results = []
        overview = self.store.layered.read_overview()

        if not overview:
            return candidates

        for intent in intents:
            score = self._keyword_score(intent, overview)
            snippet = self._extract_snippet(intent, overview)
            results.append(RetrievalResult(
                uri="memory/.overview",
                layer="L1",
                score=score,
                snippet=snippet,
            ))

        for c in candidates:
            if c.layer == "L0":
                results.append(c)

        return sorted(results, key=lambda x: x.score, reverse=True)[:10]

    def _aggregate(self, results: list[RetrievalResult]) -> list[RetrievalResult]:
        """Result Aggregation - Deduplicate and rank."""
        seen = set()
        deduped = []

        for r in results:
            key = (r.uri, r.layer)
            if key not in seen:
                seen.add(key)
                deduped.append(r)

        return deduped

    def _keyword_score(self, query: str, text: str) -> float:
        """Simple keyword matching score."""
        query_lower = query.lower()
        text_lower = text.lower()

        query_words = set(query_lower.split())
        text_words = set(text_lower.split())

        matches = query_words & text_words
        if not matches:
            return 0.0

        return len(matches) / len(query_words)

    def _extract_snippet(self, query: str, text: str, context_chars: int = 100) -> str:
        """Extract relevant snippet around matched keywords."""
        query_lower = query.lower()
        text_lower = text.lower()

        pos = text_lower.find(query_lower)
        if pos == -1:
            for word in query_lower.split():
                pos = text_lower.find(word)
                if pos != -1:
                    break

        if pos == -1:
            return text[:200]

        start = max(0, pos - context_chars)
        end = min(len(text), pos + len(query) + context_chars)

        snippet = text[start:end]
        if start > 0:
            snippet = "..." + snippet
        if end < len(text):
            snippet = snippet + "..."

        return snippet

    async def find_with_history(
        self,
        query: str,
        provider: LLMProvider,
        model: str,
    ) -> list[RetrievalResult]:
        """Find in both memory and history."""
        results = await self.find(query, provider, model)

        history = self.store.layered.read_history(max_lines=50)
        if history:
            score = self._keyword_score(query, history)
            results.append(RetrievalResult(
                uri="memory/HISTORY.md",
                layer="L2",
                score=score * 0.5,
                snippet=history[:200],
            ))

        return sorted(results, key=lambda x: x.score, reverse=True)

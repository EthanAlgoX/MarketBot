"""Layered memory system inspired by OpenViking.

Three-layer context:
- L0 (Abstract): ~100 tokens - Quick relevance check
- L1 (Overview): ~2k tokens - Understand structure and key points
- L2 (Details): Full content - Load on demand
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from marketbot.utils.helpers import ensure_dir

if TYPE_CHECKING:
    from marketbot.providers.base import LLMProvider


@dataclass
class LayeredMemory:
    abstract: str
    overview: str
    details: str


_LAYERED_SUMMARY_PROMPT = """You are a memory consolidation agent. Analyze the following conversation and generate a three-layer summary.

## Current Long-term Memory
{memory}

## Recent Conversation History
{history}

Generate the following three layers:

1. **L0 (Abstract)**: A one-sentence summary (max 100 tokens) capturing the core essence. This is used for quick relevance checking.

2. **L1 (Overview)**: Key information and usage scenarios (500-2000 tokens). This is used for Agent decision-making during planning phase. Include:
   - User preferences and habits
   - Important facts about the user
   - Agent capabilities or tools the user frequently uses
   - Context for ongoing tasks

3. **L2 (Details)**: Complete original content. Keep everything useful for detailed reference.

Output as JSON:
{{"abstract": "...", "overview": "...", "details": "..."}}
"""


class LayeredMemoryStore:
    """Three-layer context memory storage with Viking-style分层上下文记忆存储."""

    L0_FILE = ".abstract"
    L1_FILE = ".overview"

    def __init__(self, workspace: Path):
        self.memory_dir = ensure_dir(workspace / "memory")
        self.memory_file = self.memory_dir / "MEMORY.md"
        self.history_file = self.memory_dir / "HISTORY.md"
        self.abstract_file = self.memory_dir / self.L0_FILE
        self.overview_file = self.memory_dir / self.L1_FILE

    def read_long_term(self) -> str:
        if self.memory_file.exists():
            return self.memory_file.read_text(encoding="utf-8")
        return ""

    def read_history(self, max_lines: int = 100) -> str:
        if self.history_file.exists():
            content = self.history_file.read_text(encoding="utf-8")
            lines = content.strip().split("\n\n")
            return "\n\n".join(lines[-max_lines:]) if lines else ""
        return ""

    def read_abstract(self) -> str:
        if self.abstract_file.exists():
            return self.abstract_file.read_text(encoding="utf-8")
        return ""

    def read_overview(self) -> str:
        if self.overview_file.exists():
            return self.overview_file.read_text(encoding="utf-8")
        return ""

    def write_long_term(self, content: str) -> None:
        self.memory_file.write_text(content, encoding="utf-8")

    def write_layers(self, layered: LayeredMemory) -> None:
        self.abstract_file.write_text(layered.abstract, encoding="utf-8")
        self.overview_file.write_text(layered.overview, encoding="utf-8")
        self.memory_file.write_text(layered.details, encoding="utf-8")
        logger.info("Saved layered memory: L0={} chars, L1={} chars, L2={} chars",
                    len(layered.abstract), len(layered.overview), len(layered.details))

    def append_history(self, entry: str) -> None:
        with open(self.history_file, "a", encoding="utf-8") as f:
            f.write(entry.rstrip() + "\n\n")

    def get_context(self, layer: str = "L1") -> str:
        """Get memory context at specified layer.

        Args:
            layer: "L0", "L1", or "L2"

        Returns:
            Memory content at the requested layer
        """
        if layer == "L0":
            return self.read_abstract() or self.read_overview() or self.read_long_term()
        elif layer == "L1":
            return self.read_overview() or self.read_long_term()
        else:
            return self.read_long_term()

    def has_layers(self) -> bool:
        """Check if layered memory has been generated."""
        return self.abstract_file.exists() and self.overview_file.exists()

    async def generate_layers(
        self,
        provider: LLMProvider,
        model: str,
        conversation_lines: list[str],
    ) -> LayeredMemory | None:
        """Generate three-layer summary from conversation using LLM.

        Args:
            provider: LLM provider for generating summaries
            model: Model name to use
            conversation_lines: List of conversation messages to process

        Returns:
            LayeredMemory with abstract, overview, and details
        """
        current_memory = self.read_long_term()
        history = "\n\n".join(conversation_lines[-20:]) if conversation_lines else ""

        prompt = _LAYERED_SUMMARY_PROMPT.format(
            memory=current_memory or "(empty)",
            history=history or "(no recent history)",
        )

        try:
            response = await provider.chat(
                messages=[
                    {"role": "system", "content": "You are a memory consolidation agent. Output ONLY valid JSON."},
                    {"role": "user", "content": prompt},
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

            data = json.loads(content.strip())
            return LayeredMemory(
                abstract=data.get("abstract", ""),
                overview=data.get("overview", ""),
                details=data.get("details", ""),
            )
        except Exception:
            logger.exception("Failed to generate layered memory")
            return None

    def get_memory_context(self) -> str:
        """Get memory context for agent prompt (backward compatible)."""
        long_term = self.read_long_term()
        return f"## Long-term Memory\n{long_term}" if long_term else ""

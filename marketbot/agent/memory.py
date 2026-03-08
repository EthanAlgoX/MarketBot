"""Memory system for persistent agent memory."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from marketbot.utils.helpers import ensure_dir
from marketbot.agent.layered_memory import LayeredMemoryStore, LayeredMemory

if TYPE_CHECKING:
    from marketbot.providers.base import LLMProvider
    from marketbot.session.manager import Session


_SAVE_MEMORY_TOOL = [
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save the memory consolidation result to persistent storage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "history_entry": {
                        "type": "string",
                        "description": "A paragraph (2-5 sentences) summarizing key events/decisions/topics. "
                        "Start with [YYYY-MM-DD HH:MM]. Include detail useful for grep search.",
                    },
                    "memory_update": {
                        "type": "string",
                        "description": "Full updated long-term memory as markdown. Include all existing "
                        "facts plus new ones. Return unchanged if nothing new.",
                    },
                },
                "required": ["history_entry", "memory_update"],
            },
        },
    }
]


class MemoryStore:
    """Two-layer memory with optional layered context (L0/L1/L2).

    Supports backward compatibility with MEMORY.md + HISTORY.md,
    plus optional three-layer summary generation via LayeredMemoryStore.
    """

    def __init__(self, workspace: Path):
        self.memory_dir = ensure_dir(workspace / "memory")
        self.memory_file = self.memory_dir / "MEMORY.md"
        self.history_file = self.memory_dir / "HISTORY.md"
        self.layered = LayeredMemoryStore(workspace)

    def read_long_term(self) -> str:
        if self.memory_file.exists():
            return self.memory_file.read_text(encoding="utf-8")
        return ""

    def write_long_term(self, content: str) -> None:
        self.memory_file.write_text(content, encoding="utf-8")

    def append_history(self, entry: str) -> None:
        with open(self.history_file, "a", encoding="utf-8") as f:
            f.write(entry.rstrip() + "\n\n")

    def read_history(self, max_lines: int = 100) -> str:
        """Read history from layered store (for backward compatibility)."""
        return self.layered.read_history(max_lines)

    def get_memory_context(self) -> str:
        long_term = self.read_long_term()
        return f"## Long-term Memory\n{long_term}" if long_term else ""

    async def consolidate(
        self,
        session: Session,
        provider: LLMProvider,
        model: str,
        *,
        archive_all: bool = False,
        memory_window: int = 50,
        layered: bool = False,
    ) -> bool:
        """Consolidate old messages into MEMORY.md + HISTORY.md via LLM tool call.

        Args:
            session: The conversation session
            provider: LLM provider for generating summaries
            model: Model name to use
            archive_all: If True, archive all messages
            memory_window: Window size for keeping recent messages
            layered: If True, generate three-layer summary (L0/L1/L2)

        Returns True on success (including no-op), False on failure.
        """
        if archive_all:
            old_messages = session.messages
            keep_count = 0
            logger.info("Memory consolidation (archive_all): {} messages", len(session.messages))
        else:
            keep_count = memory_window // 2
            if len(session.messages) <= keep_count:
                return True
            if len(session.messages) - session.last_consolidated <= 0:
                return True
            old_messages = session.messages[session.last_consolidated:-keep_count]
            if not old_messages:
                return True
            logger.info("Memory consolidation: {} to consolidate, {} keep", len(old_messages), keep_count)

        lines = []
        for m in old_messages:
            if not m.get("content"):
                continue
            tools = f" [tools: {', '.join(m['tools_used'])}]" if m.get("tools_used") else ""
            lines.append(f"[{m.get('timestamp', '?')[:16]}] {m['role'].upper()}{tools}: {m['content']}")

        current_memory = self.read_long_term()

        if layered:
            return await self._consolidate_layered(provider, model, lines, current_memory)

        prompt = f"""Process this conversation and call the save_memory tool with your consolidation.

## Current Long-term Memory
{current_memory or "(empty)"}

## Conversation to Process
{chr(10).join(lines)}"""

        try:
            response = await provider.chat(
                messages=[
                    {"role": "system", "content": "You are a memory consolidation agent. Call the save_memory tool with your consolidation of the conversation."},
                    {"role": "user", "content": prompt},
                ],
                tools=_SAVE_MEMORY_TOOL,
                model=model,
            )

            if not response.has_tool_calls:
                logger.warning("Memory consolidation: LLM did not call save_memory, skipping")
                return False

            args = response.tool_calls[0].arguments
            if isinstance(args, str):
                args = json.loads(args)
            if isinstance(args, list):
                if args and isinstance(args[0], dict):
                    args = args[0]
                else:
                    logger.warning("Memory consolidation: unexpected arguments as empty or non-dict list")
                    return False
            if not isinstance(args, dict):
                logger.warning("Memory consolidation: unexpected arguments type {}", type(args).__name__)
                return False

            if entry := args.get("history_entry"):
                if not isinstance(entry, str):
                    entry = json.dumps(entry, ensure_ascii=False)
                self.append_history(entry)
            if update := args.get("memory_update"):
                if not isinstance(update, str):
                    update = json.dumps(update, ensure_ascii=False)
                if update != current_memory:
                    self.write_long_term(update)

            session.last_consolidated = 0 if archive_all else len(session.messages) - keep_count
            logger.info("Memory consolidation done: {} messages, last_consolidated={}", len(session.messages), session.last_consolidated)
            return True
        except Exception:
            logger.exception("Memory consolidation failed")
            return False

    async def _consolidate_layered(
        self,
        provider: LLMProvider,
        model: str,
        lines: list[str],
        current_memory: str,
    ) -> bool:
        """Consolidate using three-layer summary (L0/L1/L2)."""
        history = "\n\n".join(lines)

        prompt = f"""Analyze the following conversation and generate a three-layer summary.

## Current Long-term Memory
{current_memory or "(empty)"}

## Conversation to Process
{history}

Generate three layers:

1. **L0 (Abstract)**: One sentence (max 100 tokens) - core essence
2. **L1 (Overview)**: Key info and usage scenarios (500-2000 tokens)
3. **L2 (Details)**: Complete content to preserve

Output ONLY valid JSON:
{{"abstract": "...", "overview": "...", "details": "..."}}"""

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
            layered = LayeredMemory(
                abstract=data.get("abstract", ""),
                overview=data.get("overview", ""),
                details=data.get("details", ""),
            )

            self.layered.write_layers(layered)
            self.append_history(f"[Layered Memory] L0: {layered.abstract[:100]}...")

            logger.info("Layered memory consolidation done")
            return True
        except Exception:
            logger.exception("Layered memory consolidation failed")
            return False

    def get_context(self, layer: str = "L1") -> str:
        """Get memory context at specified layer (L0/L1/L2).

        Args:
            layer: "L0" for abstract, "L1" for overview, "L2" for full

        Returns:
            Memory content at the requested layer
        """
        return self.layered.get_context(layer)

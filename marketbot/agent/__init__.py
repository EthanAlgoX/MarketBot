"""Agent package exports with lazy imports to avoid heavy dependency coupling."""

from __future__ import annotations

from typing import Any

__all__ = ["AgentLoop", "ContextBuilder", "MemoryStore", "SkillsLoader"]


def __getattr__(name: str) -> Any:
    """Resolve heavy exports lazily so lightweight modules can import safely."""
    if name == "AgentLoop":
        from marketbot.agent.loop import AgentLoop

        return AgentLoop
    if name == "ContextBuilder":
        from marketbot.agent.context import ContextBuilder

        return ContextBuilder
    if name == "MemoryStore":
        from marketbot.agent.memory import MemoryStore

        return MemoryStore
    if name == "SkillsLoader":
        from marketbot.agent.skills import SkillsLoader

        return SkillsLoader
    raise AttributeError(f"module 'marketbot.agent' has no attribute {name!r}")

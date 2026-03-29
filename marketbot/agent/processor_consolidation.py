"""Consolidation scheduling helpers for MessageProcessor."""

from __future__ import annotations

import asyncio
from typing import Any


def should_consolidate(processor: Any, session: Any) -> bool:
    """Return True when unconsolidated messages exceed the configured window."""
    unconsolidated = len(session.messages) - session.last_consolidated
    return unconsolidated >= processor.memory_window and session.key not in processor._consolidating


async def schedule_consolidation(processor: Any, session: Any) -> None:
    """Schedule background memory consolidation for a session when needed."""
    if not should_consolidate(processor, session):
        return

    processor._consolidating.add(session.key)
    lock = processor._consolidation_locks.setdefault(session.key, asyncio.Lock())

    async def _consolidate_and_unlock() -> None:
        try:
            async with lock:
                await processor._consolidate_memory(session)
        finally:
            processor._consolidating.discard(session.key)
            task = asyncio.current_task()
            if task is not None:
                processor._consolidation_tasks.discard(task)

    task = asyncio.create_task(_consolidate_and_unlock())
    processor._consolidation_tasks.add(task)


async def consolidate_memory(processor: Any, session: Any, archive_all: bool = False) -> bool:
    """Delegate session consolidation to the configured handler or memory store."""
    if processor.consolidate_delegate is not None:
        return await processor.consolidate_delegate(session, archive_all)
    if not processor.provider:
        return False
    return await processor.memory_store.consolidate(
        session,
        provider=processor.provider,
        model=processor.model,
        archive_all=archive_all,
        memory_window=processor.memory_window,
        layered=processor.layered_consolidation,
    )

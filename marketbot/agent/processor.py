"""Message processor for handling incoming messages."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

from loguru import logger

if TYPE_CHECKING:
    from marketbot.agent.context import ContextBuilder
    from marketbot.agent.memory import MemoryStore
    from marketbot.agent.tools.registry import ToolRegistry
    from marketbot.bus.events import InboundMessage, OutboundMessage
    from marketbot.bus.queue import MessageBus
    from marketbot.session.manager import Session, SessionManager


class MessageProcessor:
    """
    Handles message processing logic.
    
    Responsible for:
    - Slash command handling
    - Message preprocessing
    - Memory consolidation triggers
    """

    def __init__(
        self,
        context: ContextBuilder,
        memory_store: MemoryStore,
        tools: ToolRegistry,
        bus: MessageBus,
        sessions: SessionManager,
        workspace: Path,
        memory_window: int,
        memory_layer: str = "L1",
        layered_consolidation: bool = False,
    ):
        self.context = context
        self.memory_store = memory_store
        self.tools = tools
        self.bus = bus
        self.sessions = sessions
        self.workspace = workspace
        self.memory_window = memory_window
        self.memory_layer = memory_layer
        self.layered_consolidation = layered_consolidation
        
        self._consolidating: set[str] = set()
        self._consolidation_tasks: set[asyncio.Task] = set()
        self._consolidation_locks: dict[str, asyncio.Lock] = {}

    def get_session(self, key: str) -> "Session":
        """Get or create a session."""
        return self.sessions.get_or_create(key)

    async def handle_slash_command(
        self,
        cmd: str,
        session: "Session",
        channel: str,
        chat_id: str,
    ) -> "OutboundMessage | None":
        """Handle slash commands like /new, /help, /stop."""
        if cmd == "/new":
            return await self._handle_new_session(session, channel, chat_id)
        elif cmd == "/help":
            return self._handle_help(channel, chat_id)
        elif cmd == "/stop":
            return self._handle_stop(channel, chat_id)
        return None

    async def _handle_new_session(
        self,
        session: "Session",
        channel: str,
        chat_id: str,
    ) -> "OutboundMessage | None":
        """Handle /new command - archive and clear session."""
        lock = self._consolidation_locks.setdefault(session.key, asyncio.Lock())
        self._consolidating.add(session.key)
        try:
            async with lock:
                snapshot = session.messages[session.last_consolidated:]
                if snapshot:
                    from marketbot.session.manager import Session
                    temp = Session(key=session.key)
                    temp.messages = list(snapshot)
                    if not await self._consolidate_memory(temp, archive_all=True):
                        return OutboundMessage(
                            channel=channel, chat_id=chat_id,
                            content="Memory archival failed, session not cleared. Please try again.",
                        )
        except Exception:
            logger.exception("/new archival failed for {}", session.key)
            return OutboundMessage(
                channel=channel, chat_id=chat_id,
                content="Memory archival failed, session not cleared. Please try again.",
            )
        finally:
            self._consolidating.discard(session.key)

        session.clear()
        self.sessions.save(session)
        self.sessions.invalidate(session.key)
        return OutboundMessage(channel=channel, chat_id=chat_id, content="New session started.")

    def _handle_help(self, channel: str, chat_id: str) -> "OutboundMessage":
        """Handle /help command."""
        return OutboundMessage(
            channel=channel, chat_id=chat_id,
            content="🐂 marketbot commands:\n/new — Start a new conversation\n/stop — Stop the current task\n/help — Show available commands"
        )

    def _handle_stop(self, channel: str, chat_id: str) -> "OutboundMessage":
        """Handle /stop command."""
        return OutboundMessage(
            channel=channel, chat_id=chat_id,
            content="Task cancellation is not yet implemented."
        )

    def should_consolidate(self, session: "Session") -> bool:
        """Check if memory consolidation should be triggered."""
        unconsolidated = len(session.messages) - session.last_consolidated
        return (unconsolidated >= self.memory_window 
                and session.key not in self._consolidating)

    async def schedule_consolidation(self, session: "Session") -> None:
        """Schedule memory consolidation for a session."""
        if not self.should_consolidate(session):
            return
            
        self._consolidating.add(session.key)
        lock = self._consolidation_locks.setdefault(session.key, asyncio.Lock())

        async def _consolidate_and_unlock():
            try:
                async with lock:
                    await self._consolidate_memory(session)
            finally:
                self._consolidating.discard(session.key)
                task = asyncio.current_task()
                if task is not None:
                    self._consolidation_tasks.discard(task)

        task = asyncio.create_task(_consolidate_and_unlock())
        self._consolidation_tasks.add(task)

    async def _consolidate_memory(self, session: "Session", archive_all: bool = False) -> bool:
        """Delegate to MemoryStore.consolidate()."""
        return await self.memory_store.consolidate(
            session, 
            provider=None,  # Will be set by MemoryStore
            model="unknown",
            archive_all=archive_all,
            memory_window=self.memory_window,
            layered=self.layered_consolidation,
        )

    def build_messages(
        self,
        session: "Session",
        current_message: str,
        media: list[str] | None = None,
        channel: str | None = None,
        chat_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Build messages for LLM from session and current input."""
        history = session.get_history(max_messages=self.memory_window)
        return self.context.build_messages(
            history=history,
            current_message=current_message,
            media=media,
            channel=channel,
            chat_id=chat_id,
        )

    def save_session(self, session: "Session", messages: list[dict], skip: int) -> None:
        """Save new messages to session."""
        from datetime import datetime
        for m in messages[skip:]:
            entry = dict(m)
            role, content = entry.get("role"), entry.get("content")
            if role == "assistant" and not content and not entry.get("tool_calls"):
                continue
            if role == "tool" and isinstance(content, str) and len(content) > 500:
                entry["content"] = content[:500] + "\n... (truncated)"
            elif role == "user":
                if isinstance(content, str) and content.startswith(self.context._RUNTIME_CONTEXT_TAG):
                    parts = content.split("\n\n", 1)
                    if len(parts) > 1 and parts[1].strip():
                        entry["content"] = parts[1]
                    else:
                        continue
            entry.setdefault("timestamp", datetime.now().isoformat())
            session.messages.append(entry)
        session.updated_at = datetime.now()

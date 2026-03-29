"""Message processor for handling incoming messages."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from marketbot.agent import processor_consolidation
from marketbot.agent import processor_messages
from marketbot.agent import processor_runtime
from marketbot.agent.processor_save import save_session_messages

if TYPE_CHECKING:
    from marketbot.agent.context import ContextBuilder
    from marketbot.agent.memory import MemoryStore
    from marketbot.agent.tools.registry import ToolRegistry
    from marketbot.bus.events import InboundMessage
    from marketbot.bus.queue import MessageBus
    from marketbot.providers.base import LLMProvider
    from marketbot.session.manager import Session, SessionManager

class MessageProcessor:
    """
    Handles message processing logic.
    
    Responsible for:
    - Slash command handling
    - Message preprocessing
    - Memory consolidation triggers
    """

    _TOOL_RESULT_MAX_CHARS = 500

    def __init__(
        self,
        context: ContextBuilder,
        memory_store: MemoryStore,
        tools: ToolRegistry,
        bus: MessageBus,
        sessions: SessionManager,
        workspace: Path,
        memory_window: int,
        provider: "LLMProvider | None" = None,
        model: str = "unknown",
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
        self.history_turn_window = max(4, min(8, max(1, memory_window // 4)))
        self.provider = provider
        self.model = model
        self.memory_layer = memory_layer
        self.layered_consolidation = layered_consolidation
        self.consolidate_delegate: Callable[["Session", bool], Awaitable[bool]] | None = None
        
        self._consolidating: set[str] = set()
        self._consolidation_tasks: set[asyncio.Task] = set()
        self._consolidation_locks: dict[str, asyncio.Lock] = {}

    def get_session(self, key: str) -> "Session":
        """Get or create a session."""
        return self.sessions.get_or_create(key)

    @staticmethod
    def rewrite_sensitive_market_shortcuts(message: str) -> str:
        """Expand terse market-analysis shortcuts that some upstream backends misclassify."""
        return processor_runtime.rewrite_sensitive_market_shortcuts(message)

    async def handle_slash_command(
        self,
        cmd: str,
        session: "Session",
        channel: str,
        chat_id: str,
    ) -> "OutboundMessage | None":
        """Handle slash commands like /new, /help, /stop."""
        return await processor_runtime.handle_slash_command(self, cmd, session, channel, chat_id)

    async def _handle_new_session(
        self,
        session: "Session",
        channel: str,
        chat_id: str,
    ) -> "OutboundMessage | None":
        """Handle /new command - archive and clear session."""
        return await processor_runtime.handle_new_session(self, session, channel, chat_id)

    def _handle_help(self, channel: str, chat_id: str) -> "OutboundMessage":
        """Handle /help command."""
        return processor_runtime.handle_help(channel, chat_id)

    def _handle_stop(self, channel: str, chat_id: str) -> "OutboundMessage":
        """Handle /stop command."""
        return processor_runtime.handle_stop(channel, chat_id)

    def should_consolidate(self, session: "Session") -> bool:
        """Check if memory consolidation should be triggered."""
        return processor_consolidation.should_consolidate(self, session)

    async def schedule_consolidation(self, session: "Session") -> None:
        """Schedule memory consolidation for a session."""
        await processor_consolidation.schedule_consolidation(self, session)

    async def _consolidate_memory(self, session: "Session", archive_all: bool = False) -> bool:
        """Delegate to MemoryStore.consolidate()."""
        return await processor_consolidation.consolidate_memory(self, session, archive_all=archive_all)

    def build_messages(
        self,
        session: "Session",
        current_message: str,
        routing_message: str | None = None,
        skill_names: list[str] | None = None,
        media: list[str] | None = None,
        channel: str | None = None,
        chat_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Build messages for LLM from session and current input."""
        return processor_messages.build_messages(
            self,
            session=session,
            current_message=current_message,
            routing_message=routing_message,
            skill_names=skill_names,
            media=media,
            channel=channel,
            chat_id=chat_id,
        )

    def get_recent_history(self, session: "Session") -> list[dict[str, Any]]:
        """Return a bounded history window tuned for token efficiency."""
        return processor_messages.get_recent_history(self, session)

    def get_last_skill_routing(self) -> dict[str, Any] | None:
        """Expose structured skill-routing metadata for downstream renderers."""
        return processor_messages.get_last_skill_routing(self)

    def save_session(self, session: "Session", messages: list[dict], skip: int) -> None:
        """Save new messages to session."""
        save_session_messages(
            session=session,
            messages=messages,
            skip=skip,
            runtime_context_tag=self.context._RUNTIME_CONTEXT_TAG,
            tool_result_max_chars=self._TOOL_RESULT_MAX_CHARS,
        )

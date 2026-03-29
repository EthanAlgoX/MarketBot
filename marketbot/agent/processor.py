"""Message processor for handling incoming messages."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from loguru import logger

if TYPE_CHECKING:
    from marketbot.agent.context import ContextBuilder
    from marketbot.agent.memory import MemoryStore
    from marketbot.agent.tools.registry import ToolRegistry
    from marketbot.bus.events import InboundMessage
    from marketbot.bus.queue import MessageBus
    from marketbot.providers.base import LLMProvider
    from marketbot.session.manager import Session, SessionManager

from marketbot.bus.events import OutboundMessage


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
        normalized = str(message or "").strip()
        daily_market_scan_prompt = (
            "请做一份今日市场机会扫描。"
            "基于公开市场数据和当前工具返回的数据，分析美股、港股、A股和加密市场中值得关注的机会、主题、代表标的、催化剂与风险。"
            "优先使用 market_snapshot、market_news、market_macro、market_brief 这条固定 market tool 链路。"
            "工具调用阶段优先一次性完成 market_snapshot、market_news、market_macro，并尽量同时纳入 market_brief。"
            "不要把 <minimax:tool_call>、<invoke ...>、XML、函数调用标记或伪工具调用文本写进用户可见正文。"
            "如果工具不可用或当前轮次已经不能再调用工具，就直接输出最终 markdown 报告，不要在正文里请求继续调工具。"
            "不要优先使用 exec、web_fetch、web_search、browser_site、market_social_sentiment、market_fundamentals 或泛化网页抓取作为兜底。"
            "如果没有高置信机会，请明确写出今日无高置信机会，并给出观察名单。"
            "最终 markdown 尽量使用固定结构：# 📅 每日机会扫描、## 1. Market Regime、## 2. High-Conviction Setups、## 3. Watchlist、## 4. Invalidations、## 5. Data Gaps。"
            "如果实时报价覆盖很差或宏观字段大面积为空，不要输出 confidence=0.54、score=-0.08、止损位、仓位建议、轻仓跟进等伪精度内容。"
            "周末或休市且数据 degraded 时，Watchlist 最多保留 2 个有近期催化的标的，不要塞没有催化剂支持的代码。"
            "不要把超过 14 天的旧新闻当成主催化剂，不要写配置建议如 FRED API Key；统一概括为 macro data unavailable 或 live data unavailable。"
            "避免把少量资产快照直接上升为系统性结论；单点异常数据必须标记为 unverified outlier。"
            "如果当前是周末或主要市场休市时段，请按下一交易日观察名单输出，而不是给出盘中执行建议。"
            "完成首轮取数后直接输出最终答案，不要继续追加价格历史、额外验证或补充工具轮次。"
            "用户可见答案里不要出现 provider、后端、API 名称、HTTP 状态码或数据源厂商名。"
            "周末或休市时最多保留 3 个观察项，并优先使用固定篮子内已有标的；不要引入当前工具输出里没有出现过的新代码。"
        )
        rewrites = {
            "每日机会": daily_market_scan_prompt,
            "每日机会分析": daily_market_scan_prompt,
            "今日机会": daily_market_scan_prompt,
        }
        return rewrites.get(normalized, message)

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
        await self.sessions.save_async(session)
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
        if self.consolidate_delegate is not None:
            return await self.consolidate_delegate(session, archive_all)
        if not self.provider:
            return False
        return await self.memory_store.consolidate(
            session, 
            provider=self.provider,
            model=self.model,
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
        history = self.get_recent_history(session)
        original_message = current_message
        current_message = self.rewrite_sensitive_market_shortcuts(current_message)
        messages = self.context.build_messages(
            history=history,
            current_message=current_message,
            routing_message=original_message,
            media=media,
            channel=channel,
            chat_id=chat_id,
        )
        if routing := self.context.get_last_skill_routing():
            session.metadata["last_skill_routing"] = routing
        return messages

    def get_recent_history(self, session: "Session") -> list[dict[str, Any]]:
        """Return a bounded history window tuned for token efficiency."""
        return session.get_history(
            max_messages=self.memory_window,
            max_turns=self.history_turn_window,
        )

    def get_last_skill_routing(self) -> dict[str, Any] | None:
        """Expose structured skill-routing metadata for downstream renderers."""
        return self.context.get_last_skill_routing()

    def save_session(self, session: "Session", messages: list[dict], skip: int) -> None:
        """Save new messages to session."""
        from datetime import datetime
        for m in messages[skip:]:
            entry = dict(m)
            role, content = entry.get("role"), entry.get("content")
            if role == "assistant" and not content and not entry.get("tool_calls"):
                continue
            if role == "tool" and isinstance(content, str) and len(content) > self._TOOL_RESULT_MAX_CHARS:
                entry["content"] = content[:self._TOOL_RESULT_MAX_CHARS] + "\n... (truncated)"
            elif role == "user":
                if isinstance(content, str) and content.startswith(self.context._RUNTIME_CONTEXT_TAG):
                    parts = content.split("\n\n", 1)
                    if len(parts) > 1 and parts[1].strip():
                        entry["content"] = parts[1]
                    else:
                        continue
                if isinstance(content, list):
                    filtered = []
                    for c in content:
                        if (
                            c.get("type") == "text"
                            and isinstance(c.get("text"), str)
                            and c["text"].startswith(self.context._RUNTIME_CONTEXT_TAG)
                        ):
                            continue
                        if (
                            c.get("type") == "image_url"
                            and c.get("image_url", {}).get("url", "").startswith("data:image/")
                        ):
                            filtered.append({"type": "text", "text": "[image]"})
                        else:
                            filtered.append(c)
                    if not filtered:
                        continue
                    entry["content"] = filtered
            entry.setdefault("timestamp", datetime.now().isoformat())
            session.messages.append(entry)
        session.updated_at = datetime.now()

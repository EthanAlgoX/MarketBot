"""Agent loop: the core processing engine."""

from __future__ import annotations

import asyncio
import json
import os
import re
from contextlib import AsyncExitStack
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from loguru import logger

from marketbot.agent.context import ContextBuilder
from marketbot.agent.executor import AgentExecutor
from marketbot.agent.memory import MemoryStore
from marketbot.agent.plan_runtime import PlanRuntime
from marketbot.agent.planner import TaskPlanner
from marketbot.agent.verifier import StepVerifier
from marketbot.agent.processor import MessageProcessor
from marketbot.agent.recursive_retriever import RecursiveRetriever
import marketbot.agent.request_policy as request_policy
import marketbot.agent.response_postprocess as response_postprocess
from marketbot.agent.router import RequestRouter
from marketbot.agent.subagent import SubagentManager
from marketbot.agent.tool_health import ToolHealthSnapshot
import marketbot.agent.tool_runtime as tool_runtime
import marketbot.agent.turn_runtime as turn_runtime
from marketbot.agent.tools.message import MessageTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.market_routing import classify_market_request
from marketbot.domain.market import MarketDomainPlugin, build_market_runtime_profile
from marketbot.providers.base import LLMProvider
from marketbot.runtime.bootstrap import ToolBootstrapContext, register_core_tools
from marketbot.session.manager import Session, SessionManager

if TYPE_CHECKING:
    from marketbot.config.schema import (
        BrowserToolsConfig,
        ChannelsConfig,
        ExecToolConfig,
        LarkCliToolsConfig,
        MarketToolsConfig,
        TwitterCliToolsConfig,
        XiaohongshuCliToolsConfig,
    )
    from marketbot.cron.service import CronService


class AgentLoop:
    """
    The agent loop is the core processing engine.

    It:
    1. Receives messages from the bus
    2. Builds context with history, memory, skills
    3. Calls the LLM
    4. Executes tool calls
    5. Sends responses back
    """

    _TOOL_RESULT_MAX_CHARS = 500
    _TOOL_RESULT_PROMPT_MAX_CHARS = 1400
    _PARALLEL_SAFE_TOOL_PREFIXES = ("market_",)
    _PARALLEL_SAFE_TOOLS = {"read_file", "list_dir", "web_search", "web_fetch"}
    _PARALLEL_UNSAFE_TOOLS = {"write_file", "edit_file", "exec", "message", "spawn", "cron"}
    _BROAD_MARKET_SCAN_MARKERS = (
        "今日市场机会扫描",
        "每日机会分析",
        "每日机会",
        "今日机会",
        "daily opportunity",
        "market opportunities today",
    )
    _BROAD_MARKET_SCAN_ALLOWED_TOOLS = {
        "market_snapshot",
        "market_macro",
        "market_news",
        "market_brief",
    }
    _BROAD_MARKET_SCAN_SNAPSHOT_SYMBOLS = [
        "SPY", "QQQ", "DIA", "IWM", "NVDA", "AAPL", "MSFT", "TSLA",
        "BTC-USD", "ETH-USD", "GLD", "TLT", "DXY",
        "0700.HK", "9988.HK", "3690.HK", "9618.HK", "HSI", "HSTECH",
        "000300", "000001", "399001", "600519", "002594", "300750",
    ]
    _BROAD_MARKET_SCAN_NEWS_SYMBOLS = [
        "SPY", "QQQ", "NVDA", "TSLA", "BTC-USD", "0700.HK", "600519", "002594",
    ]
    _BROAD_MARKET_SCAN_BRIEF_SYMBOLS = [
        "SPY", "QQQ", "NVDA", "TSLA", "BTC-USD", "0700.HK", "600519",
    ]
    _BROAD_MARKET_SCAN_MACRO_INDICATORS = [
        "fedFunds", "us10y", "dxy", "cpi", "unemployment",
    ]
    _DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"

    def __init__(
        self,
        bus: MessageBus,
        provider: LLMProvider,
        workspace: Path,
        model: str | None = None,
        max_iterations: int = 40,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        memory_window: int = 100,
        reasoning_effort: str | None = None,
        brave_api_key: str | None = None,
        web_proxy: str | None = None,
        browser_config: BrowserToolsConfig | None = None,
        xiaohongshu_cli_config: XiaohongshuCliToolsConfig | None = None,
        twitter_cli_config: TwitterCliToolsConfig | None = None,
        lark_cli_config: LarkCliToolsConfig | None = None,
        exec_config: ExecToolConfig | None = None,
        cron_service: CronService | None = None,
        restrict_to_workspace: bool = False,
        session_manager: SessionManager | None = None,
        mcp_servers: dict | None = None,
        channels_config: ChannelsConfig | None = None,
        market_config: MarketToolsConfig | None = None,
        memory_layer: str = "L1",
        layered_consolidation: bool = False,
    ):
        from marketbot.config.schema import ExecToolConfig
        workspace = self._normalize_workspace(workspace)
        self.bus = bus
        self.channels_config = channels_config
        self.provider = provider
        self.workspace = workspace
        self.model = model or provider.get_default_model()
        self.max_iterations = max_iterations
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.memory_window = memory_window
        self.reasoning_effort = reasoning_effort
        self.brave_api_key = brave_api_key
        self.web_proxy = web_proxy
        self.browser_config = browser_config
        self.xiaohongshu_cli_config = xiaohongshu_cli_config
        self.twitter_cli_config = twitter_cli_config
        self.lark_cli_config = lark_cli_config
        self.exec_config = exec_config or ExecToolConfig()
        self.cron_service = cron_service
        self.restrict_to_workspace = restrict_to_workspace
        self.market_config = market_config
        self.memory_layer = memory_layer
        self.layered_consolidation = layered_consolidation

        self.context = ContextBuilder(workspace)
        self.context.set_memory_layer(self.memory_layer)
        self.memory_store = MemoryStore(workspace)
        self.retriever = RecursiveRetriever(self.memory_store)
        self.sessions = session_manager or SessionManager(workspace)
        self.tools = ToolRegistry()
        self.tool_health = ToolHealthSnapshot()
        self.router = RequestRouter()
        self.planner = TaskPlanner()
        self.verifier = StepVerifier()
        self.plan_runtime = PlanRuntime()
        self.subagents = SubagentManager(
            provider=provider,
            workspace=workspace,
            bus=bus,
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            reasoning_effort=reasoning_effort,
            brave_api_key=brave_api_key,
            web_proxy=web_proxy,
            browser_config=browser_config,
            xiaohongshu_cli_config=xiaohongshu_cli_config,
            twitter_cli_config=twitter_cli_config,
            lark_cli_config=lark_cli_config,
            exec_config=self.exec_config,
            restrict_to_workspace=restrict_to_workspace,
        )
        self.processor = MessageProcessor(
            context=self.context,
            memory_store=self.memory_store,
            tools=self.tools,
            bus=self.bus,
            sessions=self.sessions,
            workspace=self.workspace,
            memory_window=self.memory_window,
            provider=self.provider,
            model=self.model,
            memory_layer=self.memory_layer,
            layered_consolidation=self.layered_consolidation,
        )
        self.processor.consolidate_delegate = (
            lambda session, archive_all=False: self._consolidate_memory(
                session,
                archive_all=archive_all,
            )
        )

        self._running = False
        self._mcp_servers = mcp_servers or {}
        self._mcp_stack: AsyncExitStack | None = None
        self._mcp_connected = False
        self._mcp_connecting = False
        self._consolidating = self.processor._consolidating
        self._consolidation_tasks = self.processor._consolidation_tasks
        self._consolidation_locks = self.processor._consolidation_locks
        self._active_tasks: dict[str, list[asyncio.Task]] = {}  # session_key -> tasks
        self._session_locks: dict[str, asyncio.Lock] = {}
        self._active_request_flags: dict[str, bool] = {}
        self._active_allowed_tools: set[str] | None = None
        self._last_route_decision: dict[str, str] | None = None
        self._last_plan_summary: dict[str, Any] | None = None
        self._last_plan_path: str | None = None
        self._register_default_tools()
        self.executor = AgentExecutor(self)
        self._refresh_runtime_tool_state()
        self.context.set_market_runtime_profile(build_market_runtime_profile(self.market_config))
        self.context.set_browser_adapter_catalog(getattr(self.browser_config, "adapter_catalog", []) if self.browser_config else [])

    @staticmethod
    def _normalize_workspace(value: Path | str | bytes | None) -> Path:
        """Normalize workspace input and fall back for tests that pass sentinel objects."""
        if isinstance(value, Path):
            return value
        if isinstance(value, (str, bytes)):
            return Path(value)
        return Path("/tmp/marketbot")

    def _register_default_tools(self) -> None:
        """Register the default set of tools."""
        ctx = ToolBootstrapContext(
            workspace=self.workspace,
            bus=self.bus,
            subagents=self.subagents,
            exec_config=self.exec_config,
            restrict_to_workspace=self.restrict_to_workspace,
            brave_api_key=self.brave_api_key,
            web_proxy=self.web_proxy,
            browser_config=self.browser_config,
            xiaohongshu_cli_config=self.xiaohongshu_cli_config,
            twitter_cli_config=self.twitter_cli_config,
            lark_cli_config=self.lark_cli_config,
            cron_service=self.cron_service,
            market_config=self.market_config,
        )
        register_core_tools(self.tools, ctx)
        MarketDomainPlugin().register(self.tools, ctx)

    def _refresh_runtime_tool_state(self) -> None:
        """Refresh tool-health derived runtime visibility."""
        self.tool_health.refresh(self.tools._tools)
        self.context.set_available_tools(sorted(self.tool_health.healthy_names()))

    def _visible_tool_names(self) -> set[str]:
        """Return the tool names visible to the model for the current turn."""
        tool_health = getattr(self, "tool_health", None)
        if tool_health is not None:
            visible = set(tool_health.healthy_names())
        else:
            context_tools = getattr(getattr(self, "context", None), "available_tools", None)
            if context_tools:
                visible = set(context_tools)
            else:
                visible = set()
                tools = getattr(self, "tools", None)
                if tools is not None and hasattr(tools, "get_definitions"):
                    try:
                        definitions = tools.get_definitions()
                    except Exception:
                        definitions = []
                    if isinstance(definitions, list):
                        for definition in definitions:
                            function = definition.get("function") if isinstance(definition, dict) else None
                            if isinstance(function, dict):
                                name = str(function.get("name") or "").strip()
                                if name:
                                    visible.add(name)
        active_allowed_tools = getattr(self, "_active_allowed_tools", None)
        if active_allowed_tools is not None:
            visible &= active_allowed_tools
        return visible

    @staticmethod
    def _resolve_dispatch_session_key(msg: InboundMessage) -> str:
        """Resolve the session key used for per-session serialization."""
        if msg.channel == "system":
            if ":" in msg.chat_id:
                channel, chat_id = msg.chat_id.split(":", 1)
                return f"{channel}:{chat_id}"
            return f"cli:{msg.chat_id}"
        return msg.session_key

    def _get_session_lock(self, key: str) -> asyncio.Lock:
        """Get or create a lock for a single session."""
        lock = self._session_locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._session_locks[key] = lock
        return lock

    def get_last_skill_routing(self) -> dict[str, Any] | None:
        """Expose the last structured skill-routing result for downstream consumers."""
        return self.processor.get_last_skill_routing()

    async def _connect_mcp(self) -> None:
        """Connect to configured MCP servers (one-time, lazy)."""
        if self._mcp_connected or self._mcp_connecting or not self._mcp_servers:
            return
        self._mcp_connecting = True
        from marketbot.agent.tools.mcp import connect_mcp_servers
        try:
            self._mcp_stack = AsyncExitStack()
            await self._mcp_stack.__aenter__()
            await connect_mcp_servers(self._mcp_servers, self.tools, self._mcp_stack)
            self._refresh_runtime_tool_state()
            self._mcp_connected = True
        except Exception as e:
            logger.error("Failed to connect MCP servers (will retry next message): {}", e)
            if self._mcp_stack:
                try:
                    await self._mcp_stack.aclose()
                except Exception:
                    pass
                self._mcp_stack = None
        finally:
            self._mcp_connecting = False

    def _set_tool_context(self, channel: str, chat_id: str, message_id: str | None = None) -> None:
        """Update context for all tools that need routing info."""
        for name in ("message", "spawn", "cron"):
            if tool := self.tools.get(name):
                if hasattr(tool, "set_context"):
                    tool.set_context(channel, chat_id, *([message_id] if name == "message" else []))

    @staticmethod
    def _strip_think(text: str | None) -> str | None:
        """Remove <think>…</think> blocks that some models embed in content."""
        if not text:
            return None
        return re.sub(r"<think>[\s\S]*?</think>", "", text).strip() or None

    @staticmethod
    def _tool_hint(tool_calls: list) -> str:
        """Format tool calls as concise hint, e.g. 'web_search("query")'."""
        def _fmt(tc):
            args = (tc.arguments[0] if isinstance(tc.arguments, list) else tc.arguments) or {}
            val = next(iter(args.values()), None) if isinstance(args, dict) else None
            if not isinstance(val, str):
                return tc.name
            return f'{tc.name}("{val[:40]}…")' if len(val) > 40 else f'{tc.name}("{val}")'
        return ", ".join(_fmt(tc) for tc in tool_calls)

    @staticmethod
    def _extract_market_brief_payload(messages: list[dict]) -> dict[str, Any]:
        """Extract the latest structured market brief payload from tool results, if present."""
        return response_postprocess.extract_market_brief_payload(messages)

    def _append_chat_explainability(self, final_content: str | None, explainability: dict[str, Any] | None) -> str | None:
        """Append explainability footer for inline-only entrypoints like CLI/system."""
        return response_postprocess.append_chat_explainability(self, final_content, explainability)

    def _resolve_explainability_mode(self, channel: str) -> str:
        """Resolve explainability policy for the current outbound channel."""
        if self.channels_config is None:
            return "auto"
        channel_key = channel.strip().lower()
        if channel_key and channel_key in self.channels_config.explainability_overrides:
            return str(self.channels_config.explainability_overrides[channel_key]).strip().lower()
        return str(self.channels_config.explainability_mode).strip().lower()

    def _resolve_explainability_delivery(self, channel: str) -> str:
        """Resolve whether explainability is rendered inline or kept in metadata."""
        if self.channels_config is None:
            return "inline"
        channel_key = channel.strip().lower()
        if channel_key and channel_key in self.channels_config.explainability_delivery_overrides:
            resolved = str(self.channels_config.explainability_delivery_overrides[channel_key]).strip().lower()
        else:
            resolved = str(self.channels_config.explainability_delivery).strip().lower()
        if resolved == "auto":
            return "inline"
        return resolved or "inline"

    def _build_chat_explainability(self, messages: list[dict], *, channel: str) -> dict[str, Any] | None:
        """Build a structured explainability bundle for the current reply."""
        return response_postprocess.build_chat_explainability(self, messages, channel=channel)

    def _build_external_skill_install_suggestions(self) -> list[dict[str, str]]:
        """Convert routed external skill suggestions into install-ready suggestions."""
        return response_postprocess.build_external_skill_install_suggestions(self)

    @staticmethod
    def _append_external_skill_suggestions(
        final_content: str | None,
        suggestions: list[dict[str, str]] | None,
    ) -> str | None:
        """Append install-ready external skill suggestions to the final reply."""
        return response_postprocess.append_external_skill_suggestions(final_content, suggestions)

    def _build_response_metadata(
        self,
        *,
        msg_metadata: dict[str, Any] | None,
        usage: dict[str, Any] | None,
        explainability: dict[str, Any] | None,
        external_skill_suggestions: list[dict[str, str]] | None,
        report_path: Path | None,
    ) -> dict[str, Any]:
        """Build outbound metadata for completed turns."""
        return turn_runtime.build_response_metadata(
            self,
            msg_metadata=msg_metadata,
            usage=usage,
            explainability=explainability,
            external_skill_suggestions=external_skill_suggestions,
            report_path=report_path,
        )

    def _finalize_response_content(
        self,
        final_content: str | None,
        *,
        all_msgs: list[dict[str, Any]],
        channel: str,
        request_text: str,
        append_inline_explainability: bool,
        empty_fallback: str | None = None,
    ) -> tuple[str | None, dict[str, Any] | None, list[dict[str, str]], Path | None]:
        """Apply response post-processing shared by system and normal message flows."""
        return turn_runtime.finalize_response_content(
            self,
            final_content,
            all_msgs=all_msgs,
            channel=channel,
            request_text=request_text,
            append_inline_explainability=append_inline_explainability,
            empty_fallback=empty_fallback,
        )

    async def _record_completed_turn(
        self,
        *,
        session: Session,
        history_len: int,
        all_msgs: list[dict[str, Any]],
        usage: dict[str, Any] | None,
        request_text: str,
        final_content: str | None,
        tools_used: list[str],
    ) -> None:
        """Persist usage metadata and session history for a completed turn."""
        await turn_runtime.record_completed_turn(
            self,
            session=session,
            history_len=history_len,
            all_msgs=all_msgs,
            usage=usage,
            request_text=request_text,
            final_content=final_content,
            tools_used=tools_used,
        )

    def _prepare_system_turn(
        self,
        *,
        session: Session,
        channel: str,
        chat_id: str,
        current_message: str,
        message_id: str | None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Prepare session history and prompt messages for a system-triggered turn."""
        return turn_runtime.prepare_system_turn(
            self,
            session=session,
            channel=channel,
            chat_id=chat_id,
            current_message=current_message,
            message_id=message_id,
        )

    async def _prepare_user_turn(
        self,
        *,
        session: Session,
        msg: InboundMessage,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Prepare session state and prompt messages for a user turn."""
        return await turn_runtime.prepare_user_turn(
            self,
            session=session,
            msg=msg,
        )

    @staticmethod
    def _preview_message_content(content: str) -> str:
        """Build a short log preview for message content."""
        return turn_runtime.preview_message_content(content)

    def _build_bus_progress_callback(
        self,
        *,
        msg: InboundMessage,
    ) -> Callable[[str], Awaitable[None]]:
        """Create a progress publisher bound to the current inbound message."""
        return turn_runtime.build_bus_progress_callback(self, msg=msg)

    async def _run_user_turn(
        self,
        *,
        msg: InboundMessage,
        session: Session,
        history: list[dict[str, Any]],
        initial_messages: list[dict[str, Any]],
        on_progress: Callable[[str], Awaitable[None]] | None = None,
    ) -> tuple[str | None, dict[str, Any]]:
        """Execute a normal user turn and return finalized content plus metadata."""
        return await turn_runtime.run_user_turn(
            self,
            msg=msg,
            session=session,
            history=history,
            initial_messages=initial_messages,
            on_progress=on_progress,
        )

    async def _run_system_turn(
        self,
        *,
        msg: InboundMessage,
        session: Session,
        history: list[dict[str, Any]],
        messages: list[dict[str, Any]],
        channel: str,
        chat_id: str,
    ) -> OutboundMessage:
        """Execute a system-triggered turn and return the outbound response."""
        return await turn_runtime.run_system_turn(
            self,
            msg=msg,
            session=session,
            history=history,
            messages=messages,
            channel=channel,
            chat_id=chat_id,
        )

    def _selected_skill_names(self) -> set[str]:
        """Return the set of currently routed skill names."""
        processor = getattr(self, "processor", None)
        if processor is None:
            return set()
        routing = processor.get_last_skill_routing() or {}
        selected = routing.get("selected", []) or []
        names: set[str] = set()
        for item in selected:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if name:
                names.add(name)
        return names

    @staticmethod
    def _tool_result_has_error(result: str) -> bool:
        """Return True when a tool result clearly represents an execution failure."""
        text = str(result or "").strip()
        if not text:
            return False
        if text.startswith("Error"):
            return True
        if text.startswith("{") or text.startswith("["):
            try:
                payload = json.loads(text)
            except Exception:
                return False
            if isinstance(payload, dict) and payload.get("error"):
                return True
        return False

    def _classify_skill_outcome(
        self,
        *,
        final_content: str | None,
        all_msgs: list[dict[str, Any]],
    ) -> str:
        """Infer a coarse routing outcome from turn completion and tool health."""
        content = str(final_content or "").strip().lower()
        if not content:
            return "failure"
        if "maximum number of tool call iterations" in content or "encountered an error calling the ai model" in content:
            return "failure"

        tool_results = [
            str(item.get("content") or "")
            for item in all_msgs
            if isinstance(item, dict) and str(item.get("role") or "") == "tool"
        ]
        if not tool_results:
            return "success"
        error_count = sum(1 for result in tool_results if self._tool_result_has_error(result))
        if error_count == 0:
            return "success"
        if error_count >= len(tool_results):
            return "failure"
        return "partial"

    def _fallback_retry_skill_names(self) -> list[str]:
        """Return one-shot retry candidates derived from the primary skill's fallback chain."""
        routing = self.processor.get_last_skill_routing() or {}
        selected = routing.get("selected") or []
        if not selected or not isinstance(selected[0], dict):
            return []
        primary_name = str(selected[0].get("name") or "").strip()
        if not primary_name:
            return []

        ordered: list[str] = []
        seen: set[str] = {primary_name}
        for item in selected[1:]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name or name in seen:
                continue
            source = str(item.get("source") or "").strip()
            parent = str(item.get("parent") or "").strip()
            if source == "fallback" and parent == primary_name:
                ordered.append(name)
                seen.add(name)
        for item in selected[1:]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name or name in seen:
                continue
            ordered.append(name)
            seen.add(name)
        return ordered

    def _record_named_skill_outcome(
        self,
        *,
        name: str,
        request_text: str,
        outcome: str,
    ) -> None:
        """Persist one explicit routing outcome for the given skill."""
        route = classify_market_request(text=request_text or "")
        self.context.skills.record_skill_outcome(
            name=name,
            text=request_text or "",
            outcome=outcome,
            route=route,
            available_tools=self.context.available_tools,
        )

    async def _retry_turn_with_fallback(
        self,
        *,
        session: Session,
        current_message: str,
        media: list[str] | None,
        channel: str,
        chat_id: str,
        on_progress: Callable[..., Awaitable[None]] | None,
        outcome: str,
    ) -> tuple[list[str], str | None, list[str] | None, list[dict[str, Any]] | None, dict[str, int] | None]:
        """Retry one failed turn using fallback skills, returning retry details when triggered."""
        if outcome != "failure":
            return [], None, None, None, None

        routing = self.processor.get_last_skill_routing() or {}
        selected = routing.get("selected") or []
        if not selected or not isinstance(selected[0], dict):
            return [], None, None, None, None
        primary_name = str(selected[0].get("name") or "").strip()
        retry_skill_names = self._fallback_retry_skill_names()
        if not primary_name or not retry_skill_names:
            return [], None, None, None, None

        self._record_named_skill_outcome(name=primary_name, request_text=current_message, outcome="failure")
        if on_progress is not None:
            await on_progress(
                f"Primary skill `{primary_name}` failed. Retrying with fallback skill `{retry_skill_names[0]}`.",
                tool_hint=False,
            )
        retry_messages = self.processor.build_messages(
            session=session,
            current_message=current_message,
            routing_message=current_message,
            skill_names=retry_skill_names,
            media=media,
            channel=channel,
            chat_id=chat_id,
        )
        executor = getattr(self, "executor", None)
        if executor is not None:
            final_content, tools_used, all_msgs, usage = await executor.execute_messages(
                retry_messages,
                on_progress=on_progress,
            )
        else:
            try:
                final_content, tools_used, all_msgs, usage = await self._run_agent_loop(
                    retry_messages,
                    on_progress=on_progress,
                )
            except TypeError:
                final_content, tools_used, all_msgs, usage = await self._run_agent_loop(retry_messages)
        return retry_skill_names, final_content, tools_used, all_msgs, usage

    async def _record_skill_outcome(
        self,
        *,
        request_text: str,
        all_msgs: list[dict[str, Any]],
        final_content: str | None,
        tools_used: list[str],
    ) -> None:
        """Persist a routing outcome for the primary selected skill."""
        routing = self.processor.get_last_skill_routing() or {}
        selected = routing.get("selected") or []
        if not selected:
            return
        primary = selected[0] if isinstance(selected[0], dict) else {}
        name = str(primary.get("name") or "").strip()
        if not name:
            return
        outcome = self._classify_skill_outcome(final_content=final_content, all_msgs=all_msgs)
        required_tools = set(self.context.skills.get_skill_capabilities(name).get("required_tools", []))
        used = {str(item).strip() for item in tools_used if str(item).strip()}
        if outcome == "success" and required_tools and used and required_tools.isdisjoint(used):
            outcome = "misroute"
        self._record_named_skill_outcome(name=name, request_text=request_text, outcome=outcome)

    def _normalize_daily_opportunity_report(self, final_content: str | None) -> str | None:
        """Normalize the fixed daily-opportunity report shape without rewriting the thesis."""
        return request_policy.normalize_daily_opportunity_report(self, final_content)

    async def _auto_append_daily_opportunity_market_brief(
        self,
        messages: list[dict[str, Any]],
        tools_used: list[str],
        *,
        tool_rounds: int,
    ) -> tuple[list[dict[str, Any]], list[str], int]:
        """Auto-run market_brief once after the first tool round for the fixed daily-opportunity flow."""
        return await request_policy.auto_append_daily_opportunity_market_brief(
            self,
            messages,
            tools_used,
            tool_rounds=tool_rounds,
        )

    def _persist_local_report_if_needed(
        self,
        final_content: str | None,
        *,
        request_text: str | None = None,
    ) -> Path | None:
        """Persist markdown reports for fixed daily opportunity scans."""
        return response_postprocess.persist_local_report_if_needed(
            self,
            final_content,
            request_text=request_text,
        )

    @staticmethod
    def _looks_like_daily_opportunity_failure(content: str) -> bool:
        """Return True when the payload is an error/debug response instead of a real report."""
        return request_policy.looks_like_daily_opportunity_failure(content)

    @staticmethod
    def _append_saved_report_path(final_content: str | None, report_path: Path | None) -> str | None:
        """Append the local markdown path when a report was persisted."""
        return response_postprocess.append_saved_report_path(final_content, report_path)

    def _match_daily_opportunity_report_query(self, text: str | None) -> bool:
        """Return True when the user is asking for saved daily-opportunity report locations."""
        return request_policy.match_daily_opportunity_report_query(text)

    def _build_daily_opportunity_report_query_response(self) -> str:
        """Return a local-path summary for saved daily-opportunity markdown reports."""
        return request_policy.build_daily_opportunity_report_query_response(self)

    @classmethod
    def _compress_tool_result(cls, tool_name: str, result: str) -> str:
        """Trim low-value tool output before feeding it back into the next LLM call."""
        return tool_runtime.compress_tool_result(cls, tool_name, result)

    @staticmethod
    def _merge_usage(total: dict[str, int], usage: dict[str, int] | None) -> dict[str, int]:
        """Merge one provider usage block into the running totals."""
        return tool_runtime.merge_usage(total, usage)

    @staticmethod
    def _tool_cache_key(tool_call: Any) -> str:
        """Build a stable cache key for a tool call."""
        return tool_runtime.tool_cache_key(tool_call)

    @staticmethod
    def _build_cached_tool_result(tool_name: str, previous_result: str) -> str:
        """Return a compact reminder instead of duplicating the same tool output."""
        return tool_runtime.build_cached_tool_result(tool_name, previous_result)

    @classmethod
    def _is_broad_market_scan_request(cls, messages: list[dict[str, Any]] | None) -> bool:
        """Return True when the turn is a generic daily market-opportunity scan."""
        return request_policy.is_broad_market_scan_request(cls, messages)

    @staticmethod
    def _is_xiaohongshu_request(messages: list[dict[str, Any]] | None) -> bool:
        """Return True when the turn explicitly asks for Xiaohongshu research."""
        return request_policy.is_xiaohongshu_request(messages)

    @staticmethod
    def _is_twitter_request(messages: list[dict[str, Any]] | None) -> bool:
        """Return True when the turn explicitly asks for Twitter/X research."""
        return request_policy.is_twitter_request(messages)

    @staticmethod
    def _is_lark_request(messages: list[dict[str, Any]] | None) -> bool:
        """Return True when the turn explicitly asks for Feishu/Lark office operations."""
        return request_policy.is_lark_request(messages)

    def _tool_policy_result(self, tool_name: str) -> str | None:
        """Return a synthetic result when policy blocks a tool for the active request."""
        return request_policy.tool_policy_result(self, tool_name)

    def _normalize_tool_arguments_for_request(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Normalize tool parameters for constrained request types."""
        return request_policy.normalize_tool_arguments_for_request(self, tool_name, arguments)

    def _tool_definitions_for_request(self) -> list[dict[str, Any]]:
        """Return the tool definitions visible to the model for the active request."""
        return request_policy.tool_definitions_for_request(self)

    @classmethod
    def _is_parallel_safe_tool(cls, tool_name: str) -> bool:
        """Return True when the tool is safe to execute concurrently."""
        return request_policy.is_parallel_safe_tool(cls, tool_name)

    async def _execute_tool_calls(self, tool_calls: list) -> list[tuple[Any, str]]:
        """Execute a batch of tool calls, parallelizing only read-only calls."""
        return await tool_runtime.execute_tool_calls(self, tool_calls)

    async def _run_agent_loop(
        self,
        initial_messages: list[dict],
        on_progress: Callable[..., Awaitable[None]] | None = None,
    ) -> tuple[str | None, list[str], list[dict], dict[str, int]]:
        """Run the agent iteration loop. Returns (final_content, tools_used, messages, usage)."""
        return await tool_runtime.run_agent_loop(
            self,
            initial_messages,
            on_progress=on_progress,
        )

    async def run(self) -> None:
        """Run the agent loop, dispatching messages as tasks to stay responsive to /stop."""
        self._running = True
        await self._connect_mcp()
        logger.info("Agent loop started")

        while self._running:
            try:
                msg = await asyncio.wait_for(self.bus.consume_inbound(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            if msg.content.strip().lower() == "/stop":
                await self._handle_stop(msg)
            else:
                task = asyncio.create_task(self._dispatch(msg))
                self._active_tasks.setdefault(msg.session_key, []).append(task)
                task.add_done_callback(lambda t, k=msg.session_key: self._active_tasks.get(k, []) and self._active_tasks[k].remove(t) if t in self._active_tasks.get(k, []) else None)

    async def _handle_stop(self, msg: InboundMessage) -> None:
        """Cancel all active tasks and subagents for the session."""
        tasks = self._active_tasks.pop(msg.session_key, [])
        cancelled = sum(1 for t in tasks if not t.done() and t.cancel())
        for t in tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
        sub_cancelled = await self.subagents.cancel_by_session(msg.session_key)
        total = cancelled + sub_cancelled
        content = f"⏹ Stopped {total} task(s)." if total else "No active task to stop."
        await self.bus.publish_outbound(OutboundMessage(
            channel=msg.channel, chat_id=msg.chat_id, content=content,
        ))

    async def _dispatch(self, msg: InboundMessage) -> None:
        """Process a message under a per-session lock."""
        key = self._resolve_dispatch_session_key(msg)
        async with self._get_session_lock(key):
            try:
                response = await self._process_message(msg)
                if response is not None:
                    await self.bus.publish_outbound(response)
                elif msg.channel == "cli":
                    await self.bus.publish_outbound(OutboundMessage(
                        channel=msg.channel, chat_id=msg.chat_id,
                        content="", metadata=msg.metadata or {},
                    ))
            except asyncio.CancelledError:
                logger.info("Task cancelled for session {}", msg.session_key)
                raise
            except Exception:
                logger.exception("Error processing message for session {}", msg.session_key)
                await self.bus.publish_outbound(OutboundMessage(
                    channel=msg.channel, chat_id=msg.chat_id,
                    content="Sorry, I encountered an error.",
                ))

    async def close_mcp(self) -> None:
        """Close MCP connections."""
        if self._mcp_stack:
            try:
                await self._mcp_stack.aclose()
            except (RuntimeError, BaseExceptionGroup):
                pass  # MCP SDK cancel scope cleanup is noisy but harmless
            self._mcp_stack = None

    def stop(self) -> None:
        """Stop the agent loop."""
        self._running = False
        logger.info("Agent loop stopping")

    async def _process_message(
        self,
        msg: InboundMessage,
        session_key: str | None = None,
        on_progress: Callable[[str], Awaitable[None]] | None = None,
    ) -> OutboundMessage | None:
        """Process a single inbound message and return the response."""
        # System messages: parse origin from chat_id ("channel:chat_id")
        if msg.channel == "system":
            channel, chat_id = (msg.chat_id.split(":", 1) if ":" in msg.chat_id
                                else ("cli", msg.chat_id))
            logger.info("Processing system message from {}", msg.sender_id)
            key = f"{channel}:{chat_id}"
            session = self.processor.get_session(key)
            history, messages = self._prepare_system_turn(
                session=session,
                channel=channel,
                chat_id=chat_id,
                current_message=msg.content,
                message_id=msg.metadata.get("message_id"),
            )
            return await self._run_system_turn(
                msg=msg,
                session=session,
                history=history,
                messages=messages,
                channel=channel,
                chat_id=chat_id,
            )

        preview = self._preview_message_content(msg.content)
        logger.info("Processing message from {}:{}: {}", msg.channel, msg.sender_id, preview)
        route = self.router.decide(text=msg.content, channel=msg.channel, metadata=msg.metadata)
        self._last_route_decision = {"mode": route.mode, "reason": route.reason}
        logger.info("Route decision mode={} reason={}", route.mode, route.reason)

        if self._match_daily_opportunity_report_query(msg.content):
            return OutboundMessage(
                channel=msg.channel,
                chat_id=msg.chat_id,
                content=self._build_daily_opportunity_report_query_response(),
            )

        key = session_key or msg.session_key
        session = self.processor.get_session(key)

        # Slash commands
        cmd = msg.content.strip().lower()
        if cmd in {"/new", "/help"}:
            response = await self.processor.handle_slash_command(cmd, session, msg.channel, msg.chat_id)
            if response is not None:
                return response

        history, initial_messages = await self._prepare_user_turn(session=session, msg=msg)
        final_content, metadata = await self._run_user_turn(
            msg=msg,
            session=session,
            history=history,
            initial_messages=initial_messages,
            on_progress=on_progress,
        )

        if (mt := self.tools.get("message")) and isinstance(mt, MessageTool) and mt._sent_in_turn:
            return None

        preview = final_content[:120] + "..." if len(final_content) > 120 else final_content
        logger.info("Response to {}:{}: {}", msg.channel, msg.sender_id, preview)
        return OutboundMessage(
            channel=msg.channel, chat_id=msg.chat_id, content=final_content,
            metadata=metadata,
        )

    def _save_turn(self, session: Session, messages: list[dict], skip: int) -> None:
        """Save new-turn messages into session, truncating large tool results."""
        if hasattr(self, "processor"):
            self.processor.save_session(session, messages, skip)
            return

        from datetime import datetime

        for m in messages[skip:]:
            entry = dict(m)
            role, content = entry.get("role"), entry.get("content")
            if role == "assistant" and not content and not entry.get("tool_calls"):
                continue
            if role == "tool" and isinstance(content, str) and len(content) > self._TOOL_RESULT_MAX_CHARS:
                entry["content"] = content[:self._TOOL_RESULT_MAX_CHARS] + "\n... (truncated)"
            elif role == "user":
                if isinstance(content, str) and content.startswith(ContextBuilder._RUNTIME_CONTEXT_TAG):
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
                            and c["text"].startswith(ContextBuilder._RUNTIME_CONTEXT_TAG)
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

    async def _consolidate_memory(self, session, archive_all: bool = False) -> bool:
        """Run consolidation using the loop's active provider/model configuration."""
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

    async def process_direct(
        self,
        content: str,
        session_key: str = "cli:direct",
        channel: str = "cli",
        chat_id: str = "direct",
        on_progress: Callable[[str], Awaitable[None]] | None = None,
    ) -> str:
        """Process a message directly (for CLI or cron usage)."""
        await self._connect_mcp()
        msg = InboundMessage(channel=channel, sender_id="user", chat_id=chat_id, content=content)
        response = await self._process_message(msg, session_key=session_key, on_progress=on_progress)
        return response.content if response else ""

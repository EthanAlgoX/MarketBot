"""Agent loop: the core processing engine."""

from __future__ import annotations

import asyncio
import json
import re
from contextlib import AsyncExitStack
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from loguru import logger

from marketbot.agent.context import ContextBuilder
from marketbot.agent.memory import MemoryStore
from marketbot.agent.processor import MessageProcessor
from marketbot.agent.recursive_retriever import RecursiveRetriever
from marketbot.agent.subagent import SubagentManager
from marketbot.agent.tools.message import MessageTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.domain.market import MarketDomainPlugin, build_market_runtime_profile
from marketbot.market_reporting import (
    render_analysis_explainability,
    render_analysis_explainability_summary,
    render_chat_explainability_footer_for_channel,
)
from marketbot.providers.base import LLMProvider
from marketbot.runtime.bootstrap import ToolBootstrapContext, register_core_tools
from marketbot.session.manager import Session, SessionManager

if TYPE_CHECKING:
    from marketbot.config.schema import BrowserToolsConfig, ChannelsConfig, ExecToolConfig, MarketToolsConfig
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
        self._register_default_tools()
        self.context.set_available_tools(self.tools.tool_names)
        self.context.set_market_runtime_profile(build_market_runtime_profile(self.market_config))

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
            cron_service=self.cron_service,
            market_config=self.market_config,
        )
        register_core_tools(self.tools, ctx)
        MarketDomainPlugin().register(self.tools, ctx)

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
            self.context.set_available_tools(self.tools.tool_names)
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
        for message in reversed(messages):
            if message.get("role") != "tool" or message.get("name") != "market_brief":
                continue
            content = message.get("content")
            if not isinstance(content, str):
                continue
            try:
                payload = json.loads(content)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                return payload
        return {}

    def _append_chat_explainability(self, final_content: str | None, explainability: dict[str, Any] | None) -> str | None:
        """Append explainability footer for inline-only entrypoints like CLI/system."""
        if not final_content or not isinstance(explainability, dict):
            return final_content
        if str(explainability.get("delivery", "")).strip().lower() != "inline":
            return final_content
        footer = str(explainability.get("inline_footer", "")).strip()
        if not footer or footer in final_content:
            return final_content
        return f"{final_content.rstrip()}\n\n{footer}"

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
        skill_routing = self.processor.get_last_skill_routing()
        payload = self._extract_market_brief_payload(messages)
        mode = self._resolve_explainability_mode(channel)
        delivery = self._resolve_explainability_delivery(channel)
        inline_footer = render_chat_explainability_footer_for_channel(
            payload,
            skill_routing=skill_routing,
            channel=channel,
            mode=mode,
        )
        summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing)
        details = render_analysis_explainability(payload, skill_routing=skill_routing)
        if not any((inline_footer, summary, details)):
            return None
        return {
            "channel": channel,
            "mode": mode,
            "delivery": delivery,
            "inline_footer": inline_footer,
            "summary": summary,
            "details": details,
        }

    def _build_external_skill_install_suggestions(self) -> list[dict[str, str]]:
        """Convert routed external skill suggestions into install-ready suggestions."""
        routing = self.processor.get_last_skill_routing() or {}
        suggestions = routing.get("externalSuggestions", []) or []
        results: list[dict[str, str]] = []
        for item in suggestions[:3]:
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            results.append(
                {
                    "name": name,
                    "title": str(item.get("title", "")).strip(),
                    "description": str(item.get("description", "")).strip(),
                    "category": str(item.get("category", "")).strip(),
                    "url": str(item.get("url", "")).strip(),
                    "install_command": f"marketbot skills install {name}",
                }
            )
        return results

    @staticmethod
    def _append_external_skill_suggestions(
        final_content: str | None,
        suggestions: list[dict[str, str]] | None,
    ) -> str | None:
        """Append install-ready external skill suggestions to the final reply."""
        if not final_content or not suggestions:
            return final_content
        lines = ["## External Skill Suggestions"]
        for item in suggestions[:3]:
            name = item.get("name", "").strip()
            command = item.get("install_command", "").strip()
            description = item.get("description", "").strip()
            if not name or not command:
                continue
            line = f"- `{name}`: install with `{command}`"
            if description:
                line += f" — {description}"
            lines.append(line)
        block = "\n".join(lines)
        if block in final_content:
            return final_content
        return f"{final_content.rstrip()}\n\n{block}"

    @classmethod
    def _compress_tool_result(cls, tool_name: str, result: str) -> str:
        """Trim low-value tool output before feeding it back into the next LLM call."""
        if not isinstance(result, str):
            result = json.dumps(result, ensure_ascii=False)

        if len(result) <= cls._TOOL_RESULT_PROMPT_MAX_CHARS:
            return result

        if tool_name == "market_brief":
            # Preserve the structured market brief payload for explainability rendering.
            return result

        stripped = result.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                payload = json.loads(stripped)
            except Exception:
                payload = None
            if isinstance(payload, dict):
                summary: dict[str, Any] = {"keys": list(payload.keys())[:12]}
                for key in (
                    "symbol",
                    "symbols",
                    "provider",
                    "activeSymbol",
                    "headline",
                    "summary",
                    "conclusion",
                    "confidence",
                    "warnings",
                    "error",
                ):
                    if key not in payload:
                        continue
                    value = payload[key]
                    if isinstance(value, (str, int, float, bool)) or value is None:
                        summary[key] = value
                    elif isinstance(value, list):
                        summary[key] = {
                            "count": len(value),
                            "sample": value[:3],
                        }
                    elif isinstance(value, dict):
                        summary[key] = {k: value[k] for k in list(value.keys())[:8]}
                compact = {
                    "_truncated": True,
                    "_tool": tool_name,
                    "_original_chars": len(result),
                    "summary": summary,
                }
                return json.dumps(compact, ensure_ascii=False)

        line_count = result.count("\n") + 1
        head = result[: cls._TOOL_RESULT_PROMPT_MAX_CHARS].rstrip()
        return (
            f"{head}\n\n"
            f"[tool output truncated for context efficiency: {len(result)} chars across {line_count} lines]"
        )

    @staticmethod
    def _merge_usage(total: dict[str, int], usage: dict[str, int] | None) -> dict[str, int]:
        """Merge one provider usage block into the running totals."""
        if not usage:
            return total
        total["calls"] = total.get("calls", 0) + 1
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            value = usage.get(key)
            if isinstance(value, int):
                total[key] = total.get(key, 0) + value
        return total

    @staticmethod
    def _tool_cache_key(tool_call: Any) -> str:
        """Build a stable cache key for a tool call."""
        arguments = tool_call.arguments
        try:
            raw = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
        except TypeError:
            raw = json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str)
        return f"{tool_call.name}:{raw}"

    @staticmethod
    def _build_cached_tool_result(tool_name: str, previous_result: str) -> str:
        """Return a compact reminder instead of duplicating the same tool output."""
        preview = previous_result[:280]
        payload = {
            "cached": True,
            "tool": tool_name,
            "note": "Identical tool call already executed earlier in this run. Reuse the previous result.",
            "preview": preview,
        }
        return json.dumps(payload, ensure_ascii=False)

    @classmethod
    def _is_parallel_safe_tool(cls, tool_name: str) -> bool:
        """Return True when the tool is safe to execute concurrently."""
        if tool_name in cls._PARALLEL_UNSAFE_TOOLS:
            return False
        if tool_name in cls._PARALLEL_SAFE_TOOLS:
            return True
        return any(tool_name.startswith(prefix) for prefix in cls._PARALLEL_SAFE_TOOL_PREFIXES)

    async def _execute_tool_calls(self, tool_calls: list) -> list[tuple[Any, str]]:
        """Execute a batch of tool calls, parallelizing only read-only calls."""
        results: list[tuple[Any, str] | None] = [None] * len(tool_calls)
        parallel_batch: list[tuple[int, Any]] = []
        parallel_pending: dict[str, tuple[int, Any]] = {}
        parallel_duplicates: dict[str, list[tuple[int, Any]]] = {}
        cache: dict[str, str] = {}

        async def _run_single(index: int, tool_call: Any) -> tuple[int, str, str]:
            args_str = json.dumps(tool_call.arguments, ensure_ascii=False)
            logger.info("Tool call: {}({})", tool_call.name, args_str[:200])
            result = await self.tools.execute(tool_call.name, tool_call.arguments)
            compressed = self._compress_tool_result(tool_call.name, result)
            return index, self._tool_cache_key(tool_call), compressed

        async def _flush_parallel_batch() -> None:
            nonlocal parallel_batch, parallel_pending, parallel_duplicates
            if not parallel_batch:
                return
            executed = await asyncio.gather(*(_run_single(idx, tc) for idx, tc in parallel_batch))
            for idx, cache_key, result in executed:
                cache[cache_key] = result
                results[idx] = (tool_calls[idx], result)
                for dup_idx, dup_call in parallel_duplicates.get(cache_key, []):
                    results[dup_idx] = (
                        dup_call,
                        self._build_cached_tool_result(dup_call.name, result),
                    )
            parallel_batch = []
            parallel_pending = {}
            parallel_duplicates = {}

        for index, tool_call in enumerate(tool_calls):
            cache_key = self._tool_cache_key(tool_call)
            if cache_key in cache:
                results[index] = (
                    tool_call,
                    self._build_cached_tool_result(tool_call.name, cache[cache_key]),
                )
                continue

            if self._is_parallel_safe_tool(tool_call.name):
                if cache_key in parallel_pending:
                    parallel_duplicates.setdefault(cache_key, []).append((index, tool_call))
                    continue
                parallel_batch.append((index, tool_call))
                parallel_pending[cache_key] = (index, tool_call)
                continue

            await _flush_parallel_batch()
            idx, cache_key, result = await _run_single(index, tool_call)
            cache[cache_key] = result
            results[idx] = (tool_calls[idx], result)

        await _flush_parallel_batch()
        ordered_results: list[tuple[Any, str]] = []
        for item in results:
            if item is not None:
                ordered_results.append(item)
        return ordered_results

    async def _run_agent_loop(
        self,
        initial_messages: list[dict],
        on_progress: Callable[..., Awaitable[None]] | None = None,
    ) -> tuple[str | None, list[str], list[dict], dict[str, int]]:
        """Run the agent iteration loop. Returns (final_content, tools_used, messages, usage)."""
        messages = initial_messages
        iteration = 0
        final_content = None
        tools_used: list[str] = []
        usage_totals: dict[str, int] = {}

        while iteration < self.max_iterations:
            iteration += 1

            response = await self.provider.chat(
                messages=messages,
                tools=self.tools.get_definitions(),
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                reasoning_effort=self.reasoning_effort,
            )
            usage_totals = self._merge_usage(usage_totals, response.usage)
            if response.usage:
                logger.info(
                    "LLM usage iteration={} prompt={} completion={} total={}",
                    iteration,
                    response.usage.get("prompt_tokens", 0),
                    response.usage.get("completion_tokens", 0),
                    response.usage.get("total_tokens", 0),
                )

            if response.has_tool_calls:
                if on_progress:
                    thoughts = [
                        self._strip_think(response.content),
                        response.reasoning_content,
                        *(
                            f"Thinking [{b.get('signature', '...')}]:\n{b.get('thought', '...')}"
                            for b in (response.thinking_blocks or [])
                            if isinstance(b, dict) and "signature" in b
                        ),
                    ]
                    combined_thoughts = "\n\n".join(filter(None, thoughts))
                    if combined_thoughts:
                        await on_progress(combined_thoughts)
                    await on_progress(self._tool_hint(response.tool_calls), tool_hint=True)

                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments, ensure_ascii=False)
                        }
                    }
                    for tc in response.tool_calls
                ]
                messages = self.context.add_assistant_message(
                    messages, response.content, tool_call_dicts,
                    reasoning_content=response.reasoning_content,
                    thinking_blocks=response.thinking_blocks,
                )

                if len(response.tool_calls) > 1:
                    logger.info("Executing {} tool calls (parallel where safe)", len(response.tool_calls))

                for tool_call, result in await self._execute_tool_calls(response.tool_calls):
                    tools_used.append(tool_call.name)
                    messages = self.context.add_tool_result(
                        messages, tool_call.id, tool_call.name, result
                    )
            else:
                clean = self._strip_think(response.content)
                # Don't persist error responses to session history — they can
                # poison the context and cause permanent 400 loops (#1303).
                if response.finish_reason == "error":
                    logger.error("LLM returned error: {}", (clean or "")[:200])
                    final_content = clean or "Sorry, I encountered an error calling the AI model."
                    break
                messages = self.context.add_assistant_message(
                    messages, clean, reasoning_content=response.reasoning_content,
                    thinking_blocks=response.thinking_blocks,
                )
                final_content = clean
                break

        if final_content is None and iteration >= self.max_iterations:
            logger.warning("Max iterations ({}) reached", self.max_iterations)
            final_content = (
                f"I reached the maximum number of tool call iterations ({self.max_iterations}) "
                "without completing the task. You can try breaking the task into smaller steps."
            )

        return final_content, tools_used, messages, usage_totals

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
            self._set_tool_context(channel, chat_id, msg.metadata.get("message_id"))
            history = self.processor.get_recent_history(session)
            messages = self.processor.build_messages(
                session=session,
                current_message=msg.content,
                channel=channel,
                chat_id=chat_id,
            )
            final_content, _, all_msgs, usage = await self._run_agent_loop(messages)
            explainability = self._build_chat_explainability(all_msgs, channel=channel)
            final_content = self._append_chat_explainability(final_content, explainability)
            external_skill_suggestions = self._build_external_skill_install_suggestions()
            final_content = self._append_external_skill_suggestions(final_content, external_skill_suggestions)
            if usage:
                session.metadata["last_usage"] = usage
            self._save_turn(session, all_msgs, 1 + len(history))
            self.sessions.save(session)
            metadata = dict(msg.metadata or {})
            if usage:
                metadata["usage"] = usage
            if skill_routing := self.processor.get_last_skill_routing():
                metadata["skill_routing"] = skill_routing
            if explainability:
                metadata["explainability"] = explainability
            if external_skill_suggestions:
                metadata["skill_install_suggestions"] = external_skill_suggestions
            return OutboundMessage(channel=channel, chat_id=chat_id,
                                  content=final_content or "Background task completed.", metadata=metadata)

        preview = msg.content[:80] + "..." if len(msg.content) > 80 else msg.content
        logger.info("Processing message from {}:{}: {}", msg.channel, msg.sender_id, preview)

        key = session_key or msg.session_key
        session = self.processor.get_session(key)

        # Slash commands
        cmd = msg.content.strip().lower()
        if cmd in {"/new", "/help"}:
            response = await self.processor.handle_slash_command(cmd, session, msg.channel, msg.chat_id)
            if response is not None:
                return response

        await self.processor.schedule_consolidation(session)

        self._set_tool_context(msg.channel, msg.chat_id, msg.metadata.get("message_id"))
        if message_tool := self.tools.get("message"):
            if isinstance(message_tool, MessageTool):
                message_tool.start_turn()

        history = self.processor.get_recent_history(session)
        initial_messages = self.processor.build_messages(
            session=session,
            current_message=msg.content,
            media=msg.media if msg.media else None,
            channel=msg.channel,
            chat_id=msg.chat_id,
        )

        async def _bus_progress(content: str, *, tool_hint: bool = False) -> None:
            meta = dict(msg.metadata or {})
            meta["_progress"] = True
            meta["_tool_hint"] = tool_hint
            await self.bus.publish_outbound(OutboundMessage(
                channel=msg.channel, chat_id=msg.chat_id, content=content, metadata=meta,
            ))

        final_content, _, all_msgs, usage = await self._run_agent_loop(
            initial_messages, on_progress=on_progress or _bus_progress,
        )

        if final_content is None:
            final_content = "I've completed processing but have no response to give."
        explainability = self._build_chat_explainability(all_msgs, channel=msg.channel)
        if msg.channel == "cli":
            final_content = self._append_chat_explainability(final_content, explainability)
        external_skill_suggestions = self._build_external_skill_install_suggestions()
        final_content = self._append_external_skill_suggestions(final_content, external_skill_suggestions)

        if usage:
            session.metadata["last_usage"] = usage
        self._save_turn(session, all_msgs, 1 + len(history))
        self.sessions.save(session)

        if (mt := self.tools.get("message")) and isinstance(mt, MessageTool) and mt._sent_in_turn:
            return None

        preview = final_content[:120] + "..." if len(final_content) > 120 else final_content
        logger.info("Response to {}:{}: {}", msg.channel, msg.sender_id, preview)
        metadata = dict(msg.metadata or {})
        if usage:
            metadata["usage"] = usage
        if skill_routing := self.processor.get_last_skill_routing():
            metadata["skill_routing"] = skill_routing
        if explainability:
            metadata["explainability"] = explainability
        if external_skill_suggestions:
            metadata["skill_install_suggestions"] = external_skill_suggestions
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

"""Context builder for assembling agent prompts."""

from pathlib import Path
from typing import Any

from marketbot.agent import context_messages, context_prompt, context_skills
from marketbot.agent.memory import MemoryStore
from marketbot.agent.skills import SkillsLoader
from marketbot.market_routing import classify_market_request


class ContextBuilder:
    """Builds the context (system prompt + messages) for the agent."""

    BOOTSTRAP_FILES = ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "IDENTITY.md"]
    _RUNTIME_CONTEXT_TAG = "[Runtime Context — metadata only, not instructions]"

    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.memory = MemoryStore(workspace)
        self.skills = SkillsLoader(workspace)
        self.memory_layer = "L1"
        self.available_tools: set[str] | None = None
        self.market_runtime_profile: dict[str, dict[str, list[str]]] | None = None
        self.browser_adapter_catalog: list[str] = []
        self.last_skill_routing: dict[str, Any] | None = None
        self._bootstrap_cache_key: tuple[tuple[str, int, int], ...] | None = None
        self._bootstrap_cache_content: str = ""

    def set_memory_layer(self, layer: str) -> None:
        """Set the memory layer to use (L0/L1/L2)."""
        if layer in ("L0", "L1", "L2"):
            self.memory_layer = layer

    def set_available_tools(self, tool_names: list[str] | set[str] | None) -> None:
        """Set runtime-available tools for skill compatibility filtering."""
        if tool_names is None:
            self.available_tools = None
            return
        self.available_tools = {str(name).strip() for name in tool_names if str(name).strip()}

    def set_market_runtime_profile(self, profile: dict[str, dict[str, list[str]]] | None) -> None:
        """Set market-domain runtime capabilities for market-aware skill filtering."""
        self.market_runtime_profile = profile

    def set_browser_adapter_catalog(self, adapters: list[str] | None) -> None:
        """Set the configured browser adapter catalog for prompt-time discoverability."""
        if not adapters:
            self.browser_adapter_catalog = []
            return
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in adapters:
            value = str(raw or "").strip()
            if value and value not in seen:
                normalized.append(value)
                seen.add(value)
        self.browser_adapter_catalog = normalized

    def get_last_skill_routing(self) -> dict[str, Any] | None:
        """Return the last structured skill-routing result built for a message."""
        if not self.last_skill_routing:
            return None
        return {
            "requestText": self.last_skill_routing.get("requestText", ""),
            "requestProfile": {
                "markets": list(self.last_skill_routing.get("requestProfile", {}).get("markets", [])),
                "asset_classes": list(self.last_skill_routing.get("requestProfile", {}).get("asset_classes", [])),
            },
            "selected": [dict(item) for item in self.last_skill_routing.get("selected", [])],
            "blocked": [dict(item) for item in self.last_skill_routing.get("blocked", [])],
            "diagnostics": [dict(item) for item in self.last_skill_routing.get("diagnostics", [])],
            "externalSuggestions": [dict(item) for item in self.last_skill_routing.get("externalSuggestions", [])],
        }

    def build_system_prompt(
        self,
        skill_names: list[str] | None = None,
        current_message: str | None = None,
        skill_diagnostics: list[dict[str, Any]] | None = None,
        external_skill_suggestions: list[dict[str, Any]] | None = None,
        *,
        include_market_playbook: bool = True,
        include_memory: bool = True,
        include_skills_summary: bool = True,
        selected_skill_char_budget: int | None = None,
        active_skill_char_budget: int | None = 400,
    ) -> str:
        """Build the system prompt from identity, bootstrap files, memory, and skills."""
        return context_prompt.build_system_prompt(
            self,
            skill_names,
            current_message=current_message,
            skill_diagnostics=skill_diagnostics,
            external_skill_suggestions=external_skill_suggestions,
            include_market_playbook=include_market_playbook,
            include_memory=include_memory,
            include_skills_summary=include_skills_summary,
            selected_skill_char_budget=selected_skill_char_budget,
            active_skill_char_budget=active_skill_char_budget,
        )

    def _get_identity(self) -> str:
        """Get the core identity section."""
        return context_prompt.get_identity(self.workspace)

    @staticmethod
    def _market_analysis_playbook() -> str:
        """Get the built-in playbook for single-asset market analysis."""
        return context_prompt.market_analysis_playbook()

    @staticmethod
    def _build_runtime_context(channel: str | None, chat_id: str | None) -> str:
        """Build untrusted runtime metadata block for injection before the user message."""
        return context_messages.build_runtime_context(ContextBuilder._RUNTIME_CONTEXT_TAG, channel, chat_id)

    def _load_bootstrap_files(self) -> str:
        """Load all bootstrap files from workspace."""
        return context_prompt.load_bootstrap_files(self)

    def build_messages(
        self,
        history: list[dict[str, Any]],
        current_message: str,
        routing_message: str | None = None,
        skill_names: list[str] | None = None,
        media: list[str] | None = None,
        channel: str | None = None,
        chat_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Build the complete message list for an LLM call."""
        route_message = routing_message if routing_message is not None else current_message
        routing = self._build_skill_routing(route_message, skill_names)
        resolved_skill_names = [item["name"] for item in routing["selected"]]
        skill_diagnostics = routing["diagnostics"]
        external_skill_suggestions = routing.get("externalSuggestions", [])
        self.last_skill_routing = routing
        request_profile = routing.get("requestProfile", {})
        runtime_ctx = self._build_runtime_context(channel, chat_id)
        user_content = self._build_user_content(current_message, media)
        prior_history = (
            []
            if self._should_reset_history_for_live_market_request(
                route_message,
                request_profile=request_profile,
                resolved_skill_names=resolved_skill_names,
            )
            else history
        )
        include_memory = not self._should_ignore_memory_for_market_scan(
            route_message,
            request_profile=request_profile,
            resolved_skill_names=resolved_skill_names,
        )

        # Merge runtime context and user content into a single user message
        # to avoid consecutive same-role messages that some providers reject.
        if isinstance(user_content, str):
            merged = f"{runtime_ctx}\n\n{user_content}"
        else:
            merged = [{"type": "text", "text": runtime_ctx}] + user_content

        return [
            {
                "role": "system",
                "content": self.build_system_prompt(
                    resolved_skill_names,
                    current_message=route_message,
                    skill_diagnostics=skill_diagnostics,
                    external_skill_suggestions=external_skill_suggestions,
                    include_market_playbook=bool(
                        request_profile.get("markets")
                        or request_profile.get("asset_classes")
                        or resolved_skill_names
                    ),
                    include_memory=include_memory,
                    include_skills_summary=not resolved_skill_names,
                    selected_skill_char_budget=1200,
                    active_skill_char_budget=400,
                ),
            },
            *prior_history,
            {"role": "user", "content": merged},
        ]

    @staticmethod
    def _should_reset_history_for_live_market_request(
        current_message: str,
        *,
        request_profile: dict[str, Any] | None = None,
        resolved_skill_names: list[str] | None = None,
    ) -> bool:
        """Drop stale conversation history for live market scans that should rely on fresh tool output."""
        text = str(current_message or "").lower()
        live_terms = (
            "today",
            "latest",
            "live",
            "intraday",
            "premarket",
            "盘前",
            "盘中",
            "盘后",
            "今日",
            "实时",
            "最新",
        )
        market_terms = (
            "market",
            "watchlist",
            "opportunity",
            "summary",
            "monitor",
            "机会",
            "市场",
            "行情",
            "催化",
            "热点",
        )
        live_request = any(term in text for term in live_terms) and any(term in text for term in market_terms)
        if not live_request:
            return False

        profile = request_profile or {}
        if profile.get("markets") or profile.get("asset_classes"):
            return True

        active_skills = set(resolved_skill_names or [])
        return bool(
            active_skills.intersection(
                {
                    "market-discovery",
                    "market-monitor",
                    "market-report",
                    "stock-watch",
                    "daily-stock-screener",
                    "catalyst-tracker",
                }
            )
        )

    @staticmethod
    def _should_ignore_memory_for_market_scan(
        current_message: str,
        *,
        request_profile: dict[str, Any] | None = None,
        resolved_skill_names: list[str] | None = None,
    ) -> bool:
        """Avoid using memory-backed holdings as implicit input for broad market scans."""
        text = str(current_message or "").lower()
        active_skills = set(resolved_skill_names or [])
        profile = request_profile or {}

        broad_scan_terms = (
            "market opportunity",
            "market opportunities",
            "daily opportunity",
            "daily opportunities",
            "今日机会",
            "市场机会",
            "全市场",
            "热点机会",
        )
        explicit_portfolio_terms = (
            "my portfolio",
            "my holdings",
            "my watchlist",
            "my positions",
            "持仓",
            "组合",
            "自选",
            "观察列表",
            "watchlist",
            "portfolio",
            "holdings",
            "positions",
        )
        broad_scan = any(term in text for term in broad_scan_terms)
        explicit_portfolio = any(term in text for term in explicit_portfolio_terms)

        if explicit_portfolio:
            return False

        if "market-discovery" in active_skills and broad_scan:
            return True

        return False

    def _build_skill_routing(
        self,
        current_message: str,
        skill_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Resolve explicit and auto-detected skills plus structured routing diagnostics."""
        return context_skills.build_skill_routing(self, current_message, skill_names)

    @staticmethod
    def _filter_meta_queries(
        current_message: str,
        selected: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Remove execution skills when the user is only asking about saved artifacts or paths."""
        return context_skills.filter_meta_queries(current_message, selected)

    def _prune_shadowed_skills(self, selected: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Drop broad auto-selected skills when a higher-priority specialist is present."""
        return context_skills.prune_shadowed_skills(self, selected)

    @staticmethod
    def _normalize_skill_names(skill_names: list[str] | None) -> list[str]:
        """Normalize and deduplicate skill names while preserving order."""
        if not skill_names:
            return []
        result: list[str] = []
        seen: set[str] = set()
        for raw in skill_names:
            name = str(raw or "").strip()
            if name and name not in seen:
                result.append(name)
                seen.add(name)
        return result

    def _suggest_skills_for_message(
        self,
        current_message: str,
        route: dict[str, object] | None = None,
    ) -> tuple[list[str], list[dict[str, Any]]]:
        """Suggest built-in skills from common market-analysis intents."""
        return context_skills.suggest_skills_for_message(self, current_message, route=route)

    @staticmethod
    def _should_search_external_skills(current_message: str, diagnostics: list[dict[str, Any]] | None = None) -> bool:
        """Return True when the user likely needs a new skill rather than a normal reply."""
        return context_skills.should_search_external_skills(current_message, diagnostics)

    @staticmethod
    def _format_intel_scheduler_note(
        *,
        current_message: str | None,
        selected_skills: list[str] | None,
    ) -> str:
        """Inject deterministic guidance for recurring intel digest workflows."""
        return context_skills.format_intel_scheduler_note(
            current_message=current_message,
            selected_skills=selected_skills,
        )

    @staticmethod
    def _format_skill_diagnostics(skill_diagnostics: list[dict[str, Any]] | None) -> str:
        """Render per-message skill routing diagnostics into prompt metadata."""
        return context_skills.format_skill_diagnostics(skill_diagnostics)

    @staticmethod
    def _format_external_skill_suggestions(external_skill_suggestions: list[dict[str, Any]] | None) -> str:
        """Render fallback external skill suggestions when no local skill fits."""
        return context_skills.format_external_skill_suggestions(external_skill_suggestions)

    def _format_browser_adapter_catalog(self) -> str:
        """Render configured browser adapters as runtime guidance."""
        return context_skills.format_browser_adapter_catalog(self.browser_adapter_catalog)

    def _build_user_content(self, text: str, media: list[str] | None) -> str | list[dict[str, Any]]:
        """Build user message content with optional base64-encoded images."""
        return context_messages.build_user_content(text, media)

    @staticmethod
    def _augment_user_text(text: str) -> str:
        """Add narrow runtime hints for requests that need deterministic command planning."""
        return context_messages.augment_user_text(text)

    def add_tool_result(
        self, messages: list[dict[str, Any]],
        tool_call_id: str, tool_name: str, result: str,
    ) -> list[dict[str, Any]]:
        """Add a tool result to the message list."""
        return context_messages.add_tool_result(messages, tool_call_id, tool_name, result)

    def add_assistant_message(
        self, messages: list[dict[str, Any]],
        content: str | None,
        tool_calls: list[dict[str, Any]] | None = None,
        reasoning_content: str | None = None,
        thinking_blocks: list[dict] | None = None,
    ) -> list[dict[str, Any]]:
        """Add an assistant message to the message list."""
        return context_messages.add_assistant_message(
            messages,
            content,
            tool_calls=tool_calls,
            reasoning_content=reasoning_content,
            thinking_blocks=thinking_blocks,
        )

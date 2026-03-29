"""Context builder for assembling agent prompts."""

import platform
from pathlib import Path
from typing import Any

from marketbot.agent import context_messages, context_skills
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
        parts = [self._get_identity()]

        bootstrap = self._load_bootstrap_files()
        if bootstrap:
            parts.append(bootstrap)

        memory = self.memory.get_context(layer=self.memory_layer) if include_memory else ""
        if memory:
            layer_label = {"L0": "Abstract", "L1": "Overview", "L2": "Details"}.get(self.memory_layer, "Details")
            parts.append(f"# Memory ({layer_label})\n\n{memory}")

        if include_market_playbook:
            parts.append(self._market_analysis_playbook())

        selected_skills = self._normalize_skill_names(skill_names)
        if selected_skills:
            selected_content = self.skills.load_skills_for_context(
                selected_skills,
                max_chars_per_skill=selected_skill_char_budget,
            )
            if selected_content:
                parts.append(f"# Selected Skills\n\n{selected_content}")

        intel_scheduler_note = self._format_intel_scheduler_note(
            current_message=current_message,
            selected_skills=selected_skills,
        )
        if intel_scheduler_note:
            parts.append(intel_scheduler_note)

        diagnostics_block = self._format_skill_diagnostics(skill_diagnostics)
        if diagnostics_block:
            parts.append(diagnostics_block)

        external_suggestions_block = self._format_external_skill_suggestions(external_skill_suggestions)
        if external_suggestions_block:
            parts.append(external_suggestions_block)

        always_skills = self.skills.get_always_skills()
        if always_skills:
            always_content = self.skills.load_skills_for_context(
                always_skills,
                max_chars_per_skill=active_skill_char_budget,
            )
            if always_content:
                parts.append(f"# Active Skills\n\n{always_content}")

        browser_catalog = self._format_browser_adapter_catalog()
        if browser_catalog:
            parts.append(browser_catalog)

        skills_summary = (
            self.skills.build_skills_summary(
                available_tools=self.available_tools,
                browser_adapter_catalog=self.browser_adapter_catalog,
            )
            if include_skills_summary
            else ""
        )
        if skills_summary:
            parts.append(f"""# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.
Skills with available="false" need dependencies installed first - you can try installing them with apt/brew.
If a skill already appears under `# Selected Skills` or `# Active Skills`, use that inlined content first and only read the file path if you need more detail.

{skills_summary}""")

        return "\n\n---\n\n".join(parts)

    def _get_identity(self) -> str:
        """Get the core identity section."""
        workspace_path = str(self.workspace.expanduser().resolve())
        system = platform.system()
        runtime = f"{'macOS' if system == 'Darwin' else system} {platform.machine()}, Python {platform.python_version()}"

        return f"""# marketbot 🐂

You are marketbot, a helpful AI assistant.

## Runtime
{runtime}

## Workspace
Your workspace is at: {workspace_path}
- Long-term memory: {workspace_path}/memory/MEMORY.md (write important facts here)
- History log: {workspace_path}/memory/HISTORY.md (grep-searchable). Each entry starts with [YYYY-MM-DD HH:MM].
- Custom skills: {workspace_path}/skills/{{skill-name}}/SKILL.md
- Built-in skills: {workspace_path}/marketbot/skills/{{skill-name}}/SKILL.md

## marketbot Guidelines
- State intent before tool calls, but NEVER predict or claim results before receiving them.
- When multiple independent read-only tools are needed, batch them into the same assistant turn instead of calling one tool per turn.
- Before modifying a file, read it first. Do not assume files or directories exist.
- After writing or editing a file, re-read it if accuracy matters.
- If a tool call fails, analyze the error before retrying with a different approach.
- Ask for clarification when the request is ambiguous.
- For market analysis tasks, output a clear signal card:
  Conclusion, Evidence, Confidence (0-1), Key Risks, and Suggested Action.
- If confidence is low (<0.58) or evidence is weak, default to "watch" instead of forcing buy/sell.
- Never present analysis as guaranteed returns; always include risk conditions and invalidation triggers.
- For live market analysis, do not reuse stale provider failures or prices from earlier conversation turns. Verify with current tool output first.
- If current tool output does not confirm a provider-specific failure, say `live data unavailable` instead of naming a provider or HTTP error.
- In user-facing market opportunity scans, do not mention provider names, APIs, or HTTP status codes unless the user explicitly asks for data routing or debugging details.

Reply directly with text for conversations. Only use the 'message' tool to send to a specific chat channel."""

    @staticmethod
    def _market_analysis_playbook() -> str:
        """Get the built-in playbook for single-asset market analysis."""
        return """# Market Analysis Playbook

When the user asks for analysis of a specific asset or trade setup, prefer this workflow:

1. Gather evidence with market tools:
   - If multiple evidence inputs are independent, request them in one tool-calling turn so you can synthesize with fewer loops
   - `market_source_plan` when source routing, A/H/US coverage, or fallback choice matters
   - `market_snapshot` for price, momentum, and flow hints
   - `market_chip_distribution` for A-share chip structure, average cost, and trapped/profitable supply
   - `market_fundamentals` for valuation, market cap, and profile basics
   - `market_news` and `market_social_sentiment` for narrative and crowd context
   - `market_macro` for regime and macro risk
   - `market_event_extract` when a headline or catalyst is driving the move
   - `market_signal` for explicit confidence, sizing, and invalidation
   - `market_brief` when the user wants an end-to-end brief quickly
2. Load the most relevant skills with `read_file`:
   - `market-report` for the final structured write-up
   - `catalyst-tracker` for event calendars and drivers
   - `risk-checklist` for guardrails and position sizing
   - `stock-data-sourcing` when source selection, fallback routing, or A/H/US coverage matters
3. In the final answer, separate facts from assumptions and include:
   - Conclusion
   - Evidence
   - Confidence
   - Key risks
   - Suggested action
4. For live market requests:
   - Treat earlier conversation turns as stale unless current tool output confirms them
   - Do not mention provider-specific failures such as `Yahoo 429` unless they appear in current warnings or source-health data
   - If live data is missing, explicitly say `live data unavailable`
   - For broad market scans, keep user-facing wording generic: `unverified`, `price unavailable`, or `live data unavailable`
   - Only mention provider names or HTTP errors when the user explicitly asks for routing/debugging

If evidence is mixed, reduce conviction and default to `watch`."""

    @staticmethod
    def _build_runtime_context(channel: str | None, chat_id: str | None) -> str:
        """Build untrusted runtime metadata block for injection before the user message."""
        return context_messages.build_runtime_context(ContextBuilder._RUNTIME_CONTEXT_TAG, channel, chat_id)

    def _load_bootstrap_files(self) -> str:
        """Load all bootstrap files from workspace."""
        cache_key: list[tuple[str, int, int]] = []

        for filename in self.BOOTSTRAP_FILES:
            file_path = self.workspace / filename
            if file_path.exists():
                stat = file_path.stat()
                cache_key.append((filename, stat.st_mtime_ns, stat.st_size))

        normalized_key = tuple(cache_key)
        if self._bootstrap_cache_key == normalized_key:
            return self._bootstrap_cache_content

        parts = []
        for filename, _, _ in normalized_key:
            file_path = self.workspace / filename
            content = file_path.read_text(encoding="utf-8")
            parts.append(f"## {filename}\n\n{content}")

        content = "\n\n".join(parts) if parts else ""
        self._bootstrap_cache_key = normalized_key
        self._bootstrap_cache_content = content
        return content

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

"""Context builder for assembling agent prompts."""

import base64
import mimetypes
import platform
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from marketbot.agent.memory import MemoryStore
from marketbot.agent.skills import SkillsLoader
from marketbot.market_routing import classify_market_request
from marketbot.utils.helpers import detect_image_mime


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
        self.last_skill_routing: dict[str, Any] | None = None

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
        skill_diagnostics: list[dict[str, Any]] | None = None,
        external_skill_suggestions: list[dict[str, Any]] | None = None,
        *,
        include_market_playbook: bool = True,
        include_skills_summary: bool = True,
        selected_skill_char_budget: int | None = None,
        active_skill_char_budget: int | None = 400,
    ) -> str:
        """Build the system prompt from identity, bootstrap files, memory, and skills."""
        parts = [self._get_identity()]

        bootstrap = self._load_bootstrap_files()
        if bootstrap:
            parts.append(bootstrap)

        memory = self.memory.get_context(layer=self.memory_layer)
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

        skills_summary = self.skills.build_skills_summary(available_tools=self.available_tools) if include_skills_summary else ""
        if skills_summary:
            parts.append(f"""# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using the read_file tool.
Skills with available="false" need dependencies installed first - you can try installing them with apt/brew.

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

If evidence is mixed, reduce conviction and default to `watch`."""

    @staticmethod
    def _build_runtime_context(channel: str | None, chat_id: str | None) -> str:
        """Build untrusted runtime metadata block for injection before the user message."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M (%A)")
        tz = time.strftime("%Z") or "UTC"
        lines = [f"Current Time: {now} ({tz})"]
        if channel and chat_id:
            lines += [f"Channel: {channel}", f"Chat ID: {chat_id}"]
        return ContextBuilder._RUNTIME_CONTEXT_TAG + "\n" + "\n".join(lines)

    def _load_bootstrap_files(self) -> str:
        """Load all bootstrap files from workspace."""
        parts = []

        for filename in self.BOOTSTRAP_FILES:
            file_path = self.workspace / filename
            if file_path.exists():
                content = file_path.read_text(encoding="utf-8")
                parts.append(f"## {filename}\n\n{content}")

        return "\n\n".join(parts) if parts else ""

    def build_messages(
        self,
        history: list[dict[str, Any]],
        current_message: str,
        skill_names: list[str] | None = None,
        media: list[str] | None = None,
        channel: str | None = None,
        chat_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Build the complete message list for an LLM call."""
        routing = self._build_skill_routing(current_message, skill_names)
        resolved_skill_names = [item["name"] for item in routing["selected"]]
        skill_diagnostics = routing["diagnostics"]
        external_skill_suggestions = routing.get("externalSuggestions", [])
        self.last_skill_routing = routing
        request_profile = routing.get("requestProfile", {})
        runtime_ctx = self._build_runtime_context(channel, chat_id)
        user_content = self._build_user_content(current_message, media)

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
                    skill_diagnostics=skill_diagnostics,
                    external_skill_suggestions=external_skill_suggestions,
                    include_market_playbook=bool(
                        request_profile.get("markets")
                        or request_profile.get("asset_classes")
                        or resolved_skill_names
                    ),
                    include_skills_summary=not resolved_skill_names,
                    selected_skill_char_budget=1200,
                    active_skill_char_budget=400,
                ),
            },
            *history,
            {"role": "user", "content": merged},
        ]

    def _build_skill_routing(
        self,
        current_message: str,
        skill_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Resolve explicit and auto-detected skills plus structured routing diagnostics."""
        resolved = self._normalize_skill_names(skill_names)
        route = classify_market_request(text=current_message)
        diagnostics: list[dict[str, Any]] = []
        selected: list[dict[str, Any]] = []
        blocked: list[dict[str, Any]] = []

        for name in resolved:
            info = {
                **self.skills.explain_skill_compatibility(
                    name,
                    current_message,
                    route=route,
                    available_tools=self.available_tools,
                    runtime_profile=self.market_runtime_profile,
                ),
                "status": "selected",
                "source": "explicit",
            }
            diagnostics.append(info)
            selected.append(info)

        suggested, suggested_diagnostics = self._suggest_skills_for_message(current_message, route=route)
        for item in suggested_diagnostics:
            diagnostics.append(item)
            if item.get("status") == "selected":
                selected.append(item)
            elif item.get("status") == "blocked":
                blocked.append(item)
        for name in suggested:
            if name not in resolved:
                info = next((item for item in selected if item.get("name") == name), None)
                if info is None:
                    info = {
                        "name": name,
                        "compatible": True,
                        "reasons": ["requirements satisfied"],
                        "requestProfile": self.skills._build_request_profile(current_message, route=route),
                        "status": "selected",
                        "source": "auto",
                    }
                    diagnostics.append(info)
                    selected.append(info)

        selected_names = []
        deduped_selected: list[dict[str, Any]] = []
        for item in selected:
            name = str(item.get("name", "")).strip()
            if not name or name in selected_names:
                continue
            selected_names.append(name)
            deduped_selected.append(item)

        deduped_selected = self._prune_shadowed_skills(deduped_selected)

        external_suggestions: list[dict[str, Any]] = []
        if not deduped_selected and self._should_search_external_skills(current_message, diagnostics):
            external_suggestions = self.skills.search_external_skills(current_message, limit=5)

        return {
            "requestText": current_message,
            "requestProfile": self.skills._build_request_profile(current_message, route=route),
            "selected": deduped_selected,
            "blocked": blocked,
            "diagnostics": diagnostics,
            "externalSuggestions": external_suggestions,
        }

    def _prune_shadowed_skills(self, selected: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Drop broad auto-selected skills when a higher-priority specialist is present."""
        if not selected:
            return selected

        by_name = {str(item.get("name", "")).strip(): item for item in selected}
        specialist_names = {
            name
            for name in by_name
            if self.skills.get_skill_capabilities(name).get("priority", 50) >= 70
        }
        if not specialist_names:
            return selected

        shadow_pairs = {
            "social-signal-browser": {"sentiment-analysis"},
            "xueqiu-research": {"sentiment-analysis"},
            "eastmoney-live": {"news-intelligence"},
        }
        blocked_auto: set[str] = set()
        for specialist, blocked in shadow_pairs.items():
            if specialist in specialist_names:
                blocked_auto.update(blocked)

        result: list[dict[str, Any]] = []
        for item in selected:
            name = str(item.get("name", "")).strip()
            source = str(item.get("source", "")).strip()
            if name == "market-report" and source == "auto":
                continue
            if name in blocked_auto and source == "auto":
                continue
            result.append(item)
        return result

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
        text = current_message.lower()
        suggestions: list[str] = []
        diagnostics: list[dict[str, Any]] = []
        candidates: list[str] = []

        def consider(name: str) -> None:
            if self.skills.load_skill(name) and name not in candidates:
                candidates.append(name)

        route = route or classify_market_request(text=current_message)

        analysis_terms = (
            "analyze",
            "analysis",
            "outlook",
            "bias",
            "trade plan",
            "setup",
            "support",
            "resistance",
            "invalidation",
            "regime",
            "trend",
        )
        catalyst_terms = (
            "catalyst",
            "event",
            "earnings",
            "fomc",
            "cpi",
            "nfp",
            "news driver",
            "macro",
            "calendar",
        )
        risk_terms = (
            "risk",
            "position size",
            "sizing",
            "stop loss",
            "stop",
            "invalidat",
            "safe",
            "max loss",
            "risk-reward",
        )
        chart_terms = (
            "chart",
            "rsi",
            "macd",
            "bollinger",
            "bb",
            "vwap",
            "atr",
            "fundamental",
            "quote",
        )
        monitor_terms = (
            "crypto monitor",
            "watchlist",
            "monitor",
            "metals",
            "precious metals",
        )
        browser_research_terms = (
            "xueqiu",
            "雪球",
            "eastmoney",
            "东方财富",
            "股吧",
            "reddit",
            "subreddit",
            "wallstreetbets",
            "github repo",
            "github issue",
            "zhihu",
            "知乎",
            "verify news",
            "cross-check headline",
            "source verify",
            "youtube transcript",
            "video transcript",
            "hot stock",
            "discussion heat",
            "forum heat",
        )
        source_terms = (
            "data source",
            "datasource",
            "provider",
            "coverage",
            "freshness",
            "fallback",
            "route",
            "routing",
            "ingestion",
            "feed",
            "行情源",
            "数据源",
            "新闻源",
            "数据提供商",
            "回退",
            "降级",
            "时效",
            "覆盖",
            "接入",
            "tushare",
            "akshare",
            "efinance",
            "yfinance",
            "bocha",
            "brave",
            "tavily",
            "serpapi",
            "a股",
            "港股",
            "美股",
            "a-share",
            "hk stock",
            "us stock",
        )

        if route["asset_like"] and any(term in text for term in analysis_terms):
            consider("market-report")

        if (route["asset_like"] or route["macro"]) and any(term in text for term in catalyst_terms):
            consider("catalyst-tracker")

        if route["asset_like"] and any(term in text for term in risk_terms):
            consider("risk-checklist")

        if route["equity"] and (any(term in text for term in chart_terms) or any(term in text for term in analysis_terms)):
            consider("stock-info-explorer")
        elif route["crypto"] and any(term in text for term in chart_terms):
            consider("stock-info-explorer")

        if route["metals"] or any(term in text for term in monitor_terms):
            consider("crypto-gold-monitor")
        elif route["crypto"] and ("intermarket" in text or "gold" in text or "silver" in text):
            consider("crypto-gold-monitor")

        if any(term in text for term in browser_research_terms):
            if "xueqiu" in text or "雪球" in text or "hot stock" in text:
                consider("xueqiu-research")
            if "eastmoney" in text or "东方财富" in text or "股吧" in text:
                consider("eastmoney-live")
            if "discussion heat" in text or "forum heat" in text or "retail attention" in text:
                consider("social-signal-browser")
            if "reddit" in text or "subreddit" in text or "wallstreetbets" in text:
                consider("reddit-research")
            if "github repo" in text or "github issue" in text or "github discussion" in text:
                consider("github-browser-research")
            if "zhihu" in text or "知乎" in text:
                consider("zhihu-browser-research")
            if "verify news" in text or "cross-check headline" in text or "source verify" in text:
                consider("browser-news-verifier")
            if "youtube transcript" in text or "video transcript" in text:
                consider("youtube-transcript-browser")

        if any(term in text for term in source_terms):
            consider("stock-data-sourcing")

        for name in self.skills.find_trigger_candidates(current_message, available_tools=self.available_tools):
            consider(name)

        for name in candidates:
            info = self.skills.explain_skill_compatibility(
                name,
                current_message,
                route=route,
                available_tools=self.available_tools,
                runtime_profile=self.market_runtime_profile,
            )
            status = "selected" if info["compatible"] else "blocked"
            diagnostics.append({**info, "status": status, "source": "auto"})
            if info["compatible"] and name not in suggestions:
                suggestions.append(name)

        return suggestions, diagnostics

    @staticmethod
    def _should_search_external_skills(current_message: str, diagnostics: list[dict[str, Any]] | None = None) -> bool:
        """Return True when the user likely needs a new skill rather than a normal reply."""
        if diagnostics:
            return False
        text = current_message.lower()
        discovery_terms = (
            "skill",
            "workflow",
            "agent",
            "plugin",
            "template",
            "library",
            "deploy",
            "deployment",
            "pipeline",
            "automation",
            "screener",
            "screen",
            "scanner",
            "monitor",
            "generator",
        )
        return any(term in text for term in discovery_terms)

    @staticmethod
    def _format_skill_diagnostics(skill_diagnostics: list[dict[str, Any]] | None) -> str:
        """Render per-message skill routing diagnostics into prompt metadata."""
        if not skill_diagnostics:
            return ""
        lines = [
            "# Skill Routing Diagnostics",
            "This block is runtime metadata about why candidate skills were selected or blocked.",
        ]
        for item in skill_diagnostics:
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            status = str(item.get("status", "unknown"))
            source = str(item.get("source", "auto"))
            reasons = [str(reason) for reason in item.get("reasons", []) if str(reason).strip()]
            request_profile = item.get("requestProfile") or {}
            markets = ", ".join(str(entry) for entry in request_profile.get("markets", []) if str(entry).strip()) or "unspecified"
            asset_classes = (
                ", ".join(str(entry) for entry in request_profile.get("asset_classes", []) if str(entry).strip()) or "unspecified"
            )
            lines.append(f"- {name}: {status} ({source})")
            lines.append(f"  request markets={markets}; asset_classes={asset_classes}")
            for reason in reasons:
                lines.append(f"  reason: {reason}")
        return "\n".join(lines)

    @staticmethod
    def _format_external_skill_suggestions(external_skill_suggestions: list[dict[str, Any]] | None) -> str:
        """Render fallback external skill suggestions when no local skill fits."""
        if not external_skill_suggestions:
            return ""
        lines = [
            "# External Skill Suggestions",
            "No suitable local skill was selected. These are curated external candidates from awesome-openclaw-skills / openclaw/skills.",
        ]
        for item in external_skill_suggestions[:5]:
            name = str(item.get("name", "")).strip()
            description = str(item.get("description", "")).strip()
            category = str(item.get("category", "")).strip()
            url = str(item.get("url", "")).strip()
            if not name:
                continue
            title = str(item.get("title", "")).strip() or name
            suffix = f" [{category}]" if category else ""
            lines.append(f"- {name}: {title}{suffix}")
            if description:
                lines.append(f"  description: {description}")
            if url:
                lines.append(f"  source: {url}")
        return "\n".join(lines)

    def _build_user_content(self, text: str, media: list[str] | None) -> str | list[dict[str, Any]]:
        """Build user message content with optional base64-encoded images."""
        if not media:
            return text

        images = []
        for path in media:
            p = Path(path)
            if not p.is_file():
                continue
            raw = p.read_bytes()
            # Detect real MIME type from magic bytes; fallback to filename guess
            mime = detect_image_mime(raw) or mimetypes.guess_type(path)[0]
            if not mime or not mime.startswith("image/"):
                continue
            b64 = base64.b64encode(raw).decode()
            images.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})

        if not images:
            return text
        return images + [{"type": "text", "text": text}]

    def add_tool_result(
        self, messages: list[dict[str, Any]],
        tool_call_id: str, tool_name: str, result: str,
    ) -> list[dict[str, Any]]:
        """Add a tool result to the message list."""
        messages.append({"role": "tool", "tool_call_id": tool_call_id, "name": tool_name, "content": result})
        return messages

    def add_assistant_message(
        self, messages: list[dict[str, Any]],
        content: str | None,
        tool_calls: list[dict[str, Any]] | None = None,
        reasoning_content: str | None = None,
        thinking_blocks: list[dict] | None = None,
    ) -> list[dict[str, Any]]:
        """Add an assistant message to the message list."""
        msg: dict[str, Any] = {"role": "assistant", "content": content}
        if tool_calls:
            msg["tool_calls"] = tool_calls
        if reasoning_content is not None:
            msg["reasoning_content"] = reasoning_content
        if thinking_blocks:
            msg["thinking_blocks"] = thinking_blocks
        messages.append(msg)
        return messages

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
        self.browser_adapter_catalog: list[str] = []
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
        prior_history = (
            []
            if self._should_reset_history_for_live_market_request(
                current_message,
                request_profile=request_profile,
                resolved_skill_names=resolved_skill_names,
            )
            else history
        )
        include_memory = not self._should_ignore_memory_for_market_scan(
            current_message,
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
                    current_message=current_message,
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

        deduped_selected = self._filter_meta_queries(current_message, deduped_selected)
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

    @staticmethod
    def _filter_meta_queries(
        current_message: str,
        selected: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Remove execution skills when the user is only asking about saved artifacts or paths."""
        text = str(current_message or "").lower()
        daily_opportunity_terms = (
            "每日机会",
            "每日机会分析",
            "今日机会",
            "今日机会分析",
        )
        meta_terms = (
            "保存地址",
            "保存路径",
            "文档",
            "报告路径",
            "report path",
            "save path",
            "markdown",
            ".md",
            "md文档",
            "在哪",
            "在哪里",
        )
        if not any(term in text for term in daily_opportunity_terms):
            return selected
        if not any(term in text for term in meta_terms):
            return selected
        return [
            item for item in selected
            if str(item.get("name", "")).strip() != "daily-market-opportunity"
        ]

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
            "reddit-research": {"social-signal-browser", "sentiment-analysis"},
            "twitter-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "zhihu-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "weibo-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "bilibili-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "xiaohongshu-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "douban-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "linkedin-browser-research": {"social-signal-browser", "sentiment-analysis"},
            "eastmoney-live": {"news-intelligence"},
            "browser-news-verifier": {"news-intelligence"},
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
        multi_llm_panel_terms = (
            "bb-browser",
            "gemini",
            "chatgpt",
            "grok",
            "多模型选股",
        )
        discovery_terms = (
            "discover",
            "opportunity",
            "theme",
            "rotation",
            "market opportunity",
            "机会",
            "市场机会",
            "今日机会",
            "机会分析",
            "主题机会",
            "轮动机会",
        )
        daily_opportunity_terms = (
            "每日机会",
            "每日机会分析",
            "今日机会",
            "今日机会分析",
        )
        daily_opportunity_meta_terms = (
            "保存地址",
            "保存路径",
            "文档",
            "报告路径",
            "report path",
            "save path",
            "markdown",
            ".md",
            "md文档",
            "在哪",
            "在哪里",
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
            "weibo",
            "微博",
            "bilibili",
            "b站",
            "xiaohongshu",
            "小红书",
            "twitter",
            "x thread",
            "tweet thread",
            "fintwit",
            "hacker news",
            "hn thread",
            "douban",
            "豆瓣",
            "linkedin",
            "company page",
            "hiring signal",
            "stack overflow",
            "stackoverflow",
            "wikipedia",
            "wiki summary",
            "verify news",
            "cross-check headline",
            "source verify",
            "source validation",
            "youtube",
            "youtube transcript",
            "video transcript",
            "podcast transcript",
            "interview transcript",
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
            "a-share",
        )
        intel_source_terms = (
            "rss",
            "feed source",
            "news source",
            "source pack",
            "digest source",
            "资讯源",
            "情报源",
            "rss 源",
            "添加rss",
            "订阅源",
            "采集资讯",
        )
        intel_digest_terms = (
            "intel digest",
            "daily digest",
            "digest schedule",
            "news digest",
            "ai digest",
            "资讯日报",
            "情报摘要",
            "技术日报",
            "每日摘要",
            "定时摘要",
            "定时日报",
        )

        if all(term in text for term in ("gemini", "chatgpt", "grok")) or (
            "bb-browser" in text and any(term in text for term in ("一个月内大幅上涨", "未来一个月内大涨股票", "多模型选股"))
        ):
            consider("multi-llm-stock-panel")

        if route["asset_like"] and any(term in text for term in analysis_terms):
            consider("market-report")

        if (route["asset_like"] or route["macro"]) and any(term in text for term in catalyst_terms):
            consider("catalyst-tracker")

        if route["asset_like"] and any(term in text for term in risk_terms):
            consider("risk-checklist")

        if (
            route["equity"]
            and (any(term in text for term in chart_terms) or any(term in text for term in analysis_terms))
            and not any(term in text for term in multi_llm_panel_terms)
        ):
            consider("stock-info-explorer")
        elif route["crypto"] and any(term in text for term in chart_terms):
            consider("stock-info-explorer")

        if route["metals"] or any(term in text for term in monitor_terms):
            consider("crypto-gold-monitor")
        elif route["crypto"] and ("intermarket" in text or "gold" in text or "silver" in text):
            consider("crypto-gold-monitor")

        if any(term in text for term in daily_opportunity_terms) and not any(
            term in text for term in daily_opportunity_meta_terms
        ):
            consider("daily-market-opportunity")
        elif (route["asset_like"] or route["equity"] or bool(route.get("etf"))) and any(term in text for term in discovery_terms):
            consider("market-discovery")

        if any(term in text for term in browser_research_terms):
            if all(term in text for term in ("gemini", "chatgpt", "grok")) or "bb-browser" in text:
                consider("multi-llm-stock-panel")
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
            if "weibo" in text or "微博" in text:
                consider("weibo-browser-research")
            if "bilibili" in text or "b站" in text:
                consider("bilibili-browser-research")
            if "xiaohongshu" in text or "小红书" in text or "rednote" in text:
                consider("xiaohongshu-browser-research")
            if "twitter" in text or "x thread" in text or "tweet thread" in text or "fintwit" in text:
                consider("twitter-browser-research")
            if "hacker news" in text or "hn thread" in text:
                consider("hackernews-browser-research")
            if "douban" in text or "豆瓣" in text:
                consider("douban-browser-research")
            if "linkedin" in text or "company page" in text:
                consider("linkedin-browser-research")
            if "stack overflow" in text or "stackoverflow" in text:
                consider("stackoverflow-browser-research")
            if "wikipedia" in text or "wiki summary" in text:
                consider("wikipedia-browser-research")
            if (
                "verify news" in text
                or "cross-check headline" in text
                or "source verify" in text
                or "source validation" in text
            ):
                consider("browser-news-verifier")
            if (
                "youtube" in text
                or "youtube transcript" in text
                or "video transcript" in text
                or "podcast transcript" in text
                or "interview transcript" in text
            ):
                consider("youtube-transcript-browser")

        if any(term in text for term in source_terms):
            consider("stock-data-sourcing")

        if any(term in text for term in intel_source_terms):
            consider("intel-collector")

        if any(term in text for term in intel_digest_terms):
            consider("intel-daily-digest")

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
    def _format_intel_scheduler_note(
        *,
        current_message: str | None,
        selected_skills: list[str] | None,
    ) -> str:
        """Inject deterministic guidance for recurring intel digest workflows."""
        names = set(selected_skills or [])
        if "intel-daily-digest" not in names:
            return ""

        text = str(current_message or "").lower()
        recurring_terms = (
            "schedule",
            "every morning",
            "every day",
            "daily",
            "自动",
            "定时",
            "每天",
            "每日",
        )
        if not any(term in text for term in recurring_terms):
            return ""

        return """# Intel Scheduling Rules

For recurring intel digests with fresh coverage, collection and digest generation are separate jobs.

- Prefer the combined `marketbot intel schedule-latest-daily` command when the user asks for a scheduled daily intel digest with fresh coverage.
- If you do not use the combined command, always output both commands explicitly.
- Do not describe `marketbot intel schedule-daily` as a collection job.
- If the user asks for an 08:00 digest, use this canonical pattern:
  `marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai`
  Or the underlying pair:
  `marketbot intel schedule-collect --cron-expr "55 7 * * *" --tz Asia/Shanghai`
  `marketbot intel schedule-daily --cron-expr "0 8 * * *" --tz Asia/Shanghai`
- Use `marketbot intel schedule-list` and `marketbot intel schedule-remove <job-id>` to manage the resulting jobs."""

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

    def _format_browser_adapter_catalog(self) -> str:
        """Render configured browser adapters as runtime guidance."""
        if not self.browser_adapter_catalog:
            return ""
        lines = [
            "# Browser Adapter Catalog",
            "These browser_site adapters are configured for this runtime. Prefer them over ad hoc adapter guesses.",
        ]
        for adapter in self.browser_adapter_catalog[:20]:
            lines.append(f"- {adapter}")
        if len(self.browser_adapter_catalog) > 20:
            lines.append(f"- ... and {len(self.browser_adapter_catalog) - 20} more")
        return "\n".join(lines)

    def _build_user_content(self, text: str, media: list[str] | None) -> str | list[dict[str, Any]]:
        """Build user message content with optional base64-encoded images."""
        text = self._augment_user_text(text)
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

    @staticmethod
    def _augment_user_text(text: str) -> str:
        """Add narrow runtime hints for requests that need deterministic command planning."""
        raw = str(text or "")
        lower = raw.lower()
        intel_terms = ("intel digest", "daily digest", "资讯日报", "情报摘要")
        recurring_terms = ("schedule", "every morning", "自动", "定时", "每天", "每日")
        if any(term in lower for term in intel_terms) and any(term in lower for term in recurring_terms):
            return (
                raw
                + "\n\n"
                + "Planning note: for the latest scheduled intel digest, prefer "
                + "`marketbot intel schedule-latest-daily`."
            )
        return raw

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

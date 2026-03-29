"""Request-shaping helpers for constrained agent flows."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from loguru import logger


_TICKER_PATTERN = re.compile(r"\b[A-Z]{1,5}\b")
_GUIDANCE_HINTS = ("guidance", "outlook", "forecast")
_EARNINGS_CONTEXT_TERMS = ("earnings", "revenue", "datacenter", "gross margin", "call")


def normalize_daily_opportunity_report(loop: Any, final_content: str | None) -> str | None:
    """Normalize the fixed daily-opportunity report shape without rewriting the thesis."""
    if not final_content or loop._DAILY_OPPORTUNITY_SKILL not in loop._selected_skill_names():
        return final_content

    normalized = str(final_content).strip()
    if not normalized:
        return final_content
    if looks_like_daily_opportunity_failure(normalized):
        lowered = normalized.lower()
        if "<minimax:tool_call>" in lowered or "<invoke name=" in lowered:
            return (
                "# 📅 每日机会扫描\n\n"
                "## 1. Market Regime\n"
                "- some fields unavailable\n\n"
                "## 2. High-Conviction Setups\n"
                "- 今日无高置信机会，维持观察名单\n\n"
                "## 3. Watchlist\n"
                "- 本轮固定扫描已执行，但上游模型返回了无效工具指令，未能生成稳定摘要\n\n"
                "## 4. Invalidations\n"
                "- 重试后若恢复正常回包，再更新下一交易日观察名单\n\n"
                "## 5. Data Gaps\n"
                "- model returned invalid pseudo-tool output after the fixed scan"
            )
        return final_content

    lines = normalized.splitlines()
    if lines:
        first = lines[0].strip()
        if first.startswith("#"):
            lines[0] = "# 📅 每日机会扫描"
    normalized = "\n".join(lines)

    replacements = {
        "## 市场状态": "## 1. Market Regime",
        "## 市场背景": "## 1. Market Regime",
        "## 高置信机会": "## 2. High-Conviction Setups",
        "## 今日无高置信机会": "## 2. High-Conviction Setups",
        "## 观察名单": "## 3. Watchlist",
        "## 失效条件": "## 4. Invalidations",
        "## 风险提示": "## 4. Invalidations",
        "## 数据缺口": "## 5. Data Gaps",
        "## 数据可靠性": "## 5. Data Gaps",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)

    required_sections = [
        "## 1. Market Regime",
        "## 2. High-Conviction Setups",
        "## 3. Watchlist",
        "## 4. Invalidations",
        "## 5. Data Gaps",
    ]
    if "## 1. Market Regime" not in normalized:
        normalized = normalized.replace("# 📅 每日机会扫描", "# 📅 每日机会扫描\n\n## 1. Market Regime", 1)
    for section in required_sections[1:]:
        if section not in normalized:
            normalized = f"{normalized.rstrip()}\n\n{section}\n- some fields unavailable"
    return normalized


async def auto_append_daily_opportunity_market_brief(
    loop: Any,
    messages: list[dict[str, Any]],
    tools_used: list[str],
    *,
    tool_rounds: int,
) -> tuple[list[dict[str, Any]], list[str], int]:
    """Auto-run market_brief once after the first tool round for the fixed daily-opportunity flow."""
    if not loop._active_request_flags.get("broad_market_scan"):
        return messages, tools_used, tool_rounds
    if not loop._active_request_flags.get("daily_opportunity_scan"):
        return messages, tools_used, tool_rounds
    if tool_rounds != 1 or "market_brief" in tools_used:
        return messages, tools_used, tool_rounds

    arguments = loop._normalize_tool_arguments_for_request("market_brief", {})
    tool_call = {
        "id": "daily-opportunity-auto-market-brief",
        "type": "function",
        "function": {
            "name": "market_brief",
            "arguments": json.dumps(arguments, ensure_ascii=False),
        },
    }
    messages = loop.context.add_assistant_message(messages, "", [tool_call])
    logger.info("Auto-running market_brief for daily-market-opportunity after first tool round")
    result = await loop.tools.execute("market_brief", arguments)
    messages = loop.context.add_tool_result(
        messages,
        tool_call["id"],
        "market_brief",
        result,
    )
    return messages, [*tools_used, "market_brief"], tool_rounds + 1


def looks_like_daily_opportunity_failure(content: str) -> bool:
    """Return True when the payload is an error/debug response instead of a real report."""
    normalized = str(content or "").strip()
    if not normalized:
        return True
    lowered = normalized.lower()
    if lowered.startswith("error:"):
        return True
    if any(
        token in lowered
        for token in (
            "invalid params",
            "tool id(",
            "tool result's tool id",
            "not found",
            "backend status",
            "call_function_",
            "<minimax:tool_call>",
            "<invoke name=",
        )
    ):
        return True
    return any(line.strip().lower().startswith("error:") for line in normalized.splitlines())


def match_daily_opportunity_report_query(text: str | None) -> bool:
    """Return True when the user is asking for saved daily-opportunity report locations."""
    normalized = str(text or "").lower()
    if not any(term in normalized for term in ("每日机会", "今日机会", "daily opportunity")):
        return False
    return any(
        term in normalized
        for term in (
            "保存地址",
            "保存到地址",
            "保存路径",
            "保存到路径",
            "保存到",
            "地址",
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
    )


def build_daily_opportunity_report_query_response(loop: Any) -> str:
    """Return a local-path summary for saved daily-opportunity markdown reports."""
    report_dir = loop.workspace / "reports" / "daily-market-opportunity"
    lines = [f"每日机会 markdown 默认保存在: {report_dir}"]
    if report_dir.exists():
        files = sorted(report_dir.glob("*.md"), reverse=True)
        if files:
            lines.append("")
            lines.append("最近文档:")
            for path in files[:5]:
                lines.append(f"- {path}")
        else:
            lines.append("")
            lines.append("当前目录下还没有 .md 文档。")
    else:
        lines.append("")
        lines.append("目录尚未生成。先执行一次“每日机会”后会自动创建。")
    return "\n".join(lines)


def is_broad_market_scan_request(cls: Any, messages: list[dict[str, Any]] | None) -> bool:
    """Return True when the turn is a generic daily market-opportunity scan."""
    if not isinstance(messages, list):
        return False
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        parts.append(value)
            text = "\n".join(parts)
        else:
            continue
        lowered = text.lower()
        return any(marker.lower() in lowered for marker in cls._BROAD_MARKET_SCAN_MARKERS)
    return False


def is_xiaohongshu_request(messages: list[dict[str, Any]] | None) -> bool:
    """Return True when the user explicitly asks for Xiaohongshu/Rednote research."""
    if not isinstance(messages, list):
        return False
    markers = ("xiaohongshu", "小红书", "rednote")
    publish_markers = (
        "发小红书",
        "发布小红书",
        "发布一条小红书",
        "发一条小红书",
        "发个小红书",
        "小红书发布",
        "小红书发帖",
        "发到小红书",
        "发送小红书",
        "发送一条小红书",
        "直接发送小红书",
        "publish to xiaohongshu",
        "post to xiaohongshu",
        "send to xiaohongshu",
    )
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        parts.append(value)
            text = "\n".join(parts)
        else:
            continue
        lowered = text.lower()
        if any(marker in lowered for marker in publish_markers):
            return False
        return any(marker in lowered for marker in markers)
    return False


def is_twitter_request(messages: list[dict[str, Any]] | None) -> bool:
    """Return True when the user explicitly asks for Twitter/X research or actions."""
    if not isinstance(messages, list):
        return False
    markers = ("twitter", "tweet", "tweets", "fintwit", "x thread", "x.com", "@")
    publish_markers = (
        "发推",
        "推特",
        "发推特",
        "发布推特",
        "发布一条推特",
        "发一条推特",
        "发个推特",
        "推文",
        "发推文",
        "发布推文",
        "发布一条推文",
        "发一条推文",
        "发个推文",
        "发 twitter",
        "发 x ",
        "发到 twitter",
        "发到 x",
        "发送推特",
        "发送一条推特",
        "发送推文",
        "发送一条推文",
        "发布到 twitter",
        "发布到 x",
        "tweet this",
        "post to twitter",
        "post on x",
        "publish to twitter",
        "publish on x",
        "send to twitter",
    )
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        parts.append(value)
            text = "\n".join(parts)
        else:
            continue
        lowered = text.lower()
        if any(marker in lowered for marker in publish_markers):
            return False
        return any(marker in lowered for marker in markers)
    return False


def is_lark_request(messages: list[dict[str, Any]] | None) -> bool:
    """Return True when the user explicitly asks for Feishu/Lark/Base office operations."""
    if not isinstance(messages, list):
        return False
    markers = (
        "feishu",
        "lark",
        "飞书",
        "群聊",
        "文档",
        "表格",
        "电子表格",
        "多维表格",
        "bitable",
        "base",
        "任务",
    )
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        parts.append(value)
            text = "\n".join(parts)
        else:
            continue
        lowered = text.lower()
        return any(marker in lowered for marker in markers)
    return False


def tool_policy_result(loop: Any, tool_name: str) -> str | None:
    """Return a synthetic result when policy blocks a tool for the active request."""
    request_flags = getattr(loop, "_active_request_flags", {}) or {}
    if tool_name == "exec" and request_flags.get("broad_market_scan"):
        return (
            "Error: exec disabled for generic daily market scans. "
            "Use native market tools already in context and report data gaps explicitly."
        )
    selected_skills = set(getattr(loop, "_selected_skill_names", lambda: [])() or [])
    available_tools = set(getattr(getattr(loop, "context", None), "available_tools", set()) or set())
    if tool_name == "exec" and request_flags.get("lark_request"):
        return (
            "Error: exec disabled for Lark/Feishu structured requests. "
            "Use lark_base, lark_im, lark_doc, lark_sheets, lark_task, or lark_cli directly."
        )
    if (
        ("xiaohongshu-browser-research" in selected_skills or request_flags.get("xiaohongshu_request"))
        and "xiaohongshu_cli" in available_tools
    ):
        if tool_name in {"read_file", "list_dir"}:
            return (
                f"Error: {tool_name} disabled for xiaohongshu-browser-research when xiaohongshu_cli is available. "
                "Use xiaohongshu_cli to fetch live Xiaohongshu data instead of local memory or cache files."
            )
        if tool_name == "exec":
            return (
                "Error: exec disabled for xiaohongshu-browser-research when xiaohongshu_cli is available. "
                "Use xiaohongshu_cli outputs directly instead of inspecting local cache files."
            )
        if tool_name == "browser_site":
            return (
                "Error: browser_site disabled for xiaohongshu-browser-research when xiaohongshu_cli is available. "
                "Use xiaohongshu_cli unless it explicitly fails for the requested read path."
            )
    if (
        ("twitter-browser-research" in selected_skills or request_flags.get("twitter_request"))
        and "twitter_cli" in available_tools
    ):
        if tool_name in {"read_file", "list_dir"}:
            return (
                f"Error: {tool_name} disabled for twitter-browser-research when twitter_cli is available. "
                "Use twitter_cli to fetch live Twitter/X data instead of local files or cached notes."
            )
        if tool_name == "exec":
            return (
                "Error: exec disabled for twitter-browser-research when twitter_cli is available. "
                "Use twitter_cli outputs directly instead of ad hoc CLI or cache inspection."
            )
        if tool_name == "browser_site":
            return (
                "Error: browser_site disabled for twitter-browser-research when twitter_cli is available. "
                "Use twitter_cli unless it explicitly fails for the requested read path."
            )
    return None


def normalize_tool_arguments_for_request(
    loop: Any,
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    """Normalize tool parameters for constrained request types."""
    params = dict(arguments or {})
    request_flags = getattr(loop, "_active_request_flags", {}) or {}
    if request_flags.get("broad_market_scan"):
        if tool_name == "market_snapshot":
            params["symbols"] = list(loop._BROAD_MARKET_SCAN_SNAPSHOT_SYMBOLS)
            params["includeMacro"] = False
        elif tool_name == "market_news":
            params["symbols"] = list(loop._BROAD_MARKET_SCAN_NEWS_SYMBOLS)
            params["limit"] = 12
        elif tool_name == "market_macro":
            params["indicators"] = list(loop._BROAD_MARKET_SCAN_MACRO_INDICATORS)
        elif tool_name == "market_brief":
            params["symbols"] = list(loop._BROAD_MARKET_SCAN_BRIEF_SYMBOLS)
            params["includeFundamentals"] = False
            params["includeSocial"] = False
            params["includeChips"] = False
            params["includeMacro"] = True
            params["includeNews"] = True
    if request_flags.get("twitter_research") and tool_name == "twitter_cli":
        operation = str(params.get("operation") or "").strip().lower()
        if operation == "search":
            params["search_type"] = "Latest"
            params["max_count"] = min(int(params.get("max_count") or 12), 12)
            exclude = params.get("exclude")
            if isinstance(exclude, list):
                normalized = [str(item).strip().lower() for item in exclude if str(item).strip()]
            else:
                normalized = []
            if "replies" not in normalized:
                normalized.append("replies")
            if "retweets" not in normalized:
                normalized.append("retweets")
            params["exclude"] = normalized
            params.setdefault("do_filter", True)
            params["min_likes"] = 2
            params["query"] = _normalize_twitter_search_query(params.get("query"))
        elif operation == "tweet":
            params["max_count"] = min(int(params.get("max_count") or 20), 20)
    return params


def _normalize_twitter_search_query(value: Any) -> str:
    query = " ".join(str(value or "").split()).strip()
    if not query:
        return query

    ticker = _extract_probable_ticker(query)
    lowered = query.lower()
    if ticker and ticker not in query and f"${ticker}" not in query:
        query = query.replace(ticker, f"${ticker}", 1)
        lowered = query.lower()
    elif ticker and f"${ticker}" not in query:
        query = query.replace(ticker, f"${ticker}", 1)
        lowered = query.lower()

    if ticker and any(term in lowered for term in _GUIDANCE_HINTS):
        if not any(term in lowered for term in _EARNINGS_CONTEXT_TERMS):
            query = f'{query} earnings revenue'
    return query


def _extract_probable_ticker(query: str) -> str | None:
    for match in _TICKER_PATTERN.findall(query):
        if match in {"A", "I", "X", "US", "USA", "AI"}:
            continue
        return match
    return None


def tool_definitions_for_request(loop: Any) -> list[dict[str, Any]]:
    """Return the tool definitions visible to the model for the active request."""
    visible_names = loop._visible_tool_names()
    try:
        definitions = loop.tools.get_definitions(exposed_names=visible_names)
    except TypeError:
        definitions = loop.tools.get_definitions()
        if visible_names:
            filtered_definitions: list[dict[str, Any]] = []
            for definition in definitions:
                function = definition.get("function") if isinstance(definition, dict) else None
                if isinstance(function, dict) and str(function.get("name") or "").strip() in visible_names:
                    filtered_definitions.append(definition)
            definitions = filtered_definitions
    request_flags = getattr(loop, "_active_request_flags", {}) or {}
    if request_flags.get("xiaohongshu_request"):
        available_tools = set(getattr(getattr(loop, "context", None), "available_tools", set()) or set())
        if "xiaohongshu_cli" in available_tools:
            if getattr(loop, "_current_tool_rounds", 0) >= 2:
                return []
            filtered = []
            for definition in definitions:
                function = definition.get("function")
                if isinstance(function, dict) and str(function.get("name") or "").strip() == "xiaohongshu_cli":
                    filtered.append(definition)
            return filtered
    if request_flags.get("twitter_request"):
        available_tools = set(getattr(getattr(loop, "context", None), "available_tools", set()) or set())
        if "twitter_cli" in available_tools:
            if getattr(loop, "_current_tool_rounds", 0) >= 1:
                return []
            filtered = []
            for definition in definitions:
                function = definition.get("function")
                if isinstance(function, dict) and str(function.get("name") or "").strip() == "twitter_cli":
                    filtered.append(definition)
            return filtered
    if not request_flags.get("broad_market_scan"):
        if (
            request_flags.get("xiaohongshu_research") or request_flags.get("twitter_research")
        ) and getattr(loop, "_current_tool_rounds", 0) >= 2:
            return []
        return definitions
    filtered: list[dict[str, Any]] = []
    for definition in definitions:
        function = definition.get("function")
        if not isinstance(function, dict):
            continue
        name = str(function.get("name") or "").strip()
        if name in loop._BROAD_MARKET_SCAN_ALLOWED_TOOLS:
            filtered.append(definition)
    return filtered


def is_parallel_safe_tool(cls: Any, tool_name: str) -> bool:
    """Return True when the tool is safe to execute concurrently."""
    if tool_name in cls._PARALLEL_UNSAFE_TOOLS:
        return False
    if tool_name in cls._PARALLEL_SAFE_TOOLS:
        return True
    return any(tool_name.startswith(prefix) for prefix in cls._PARALLEL_SAFE_TOOL_PREFIXES)

"""Response explainability and local-report post-processing helpers."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from marketbot.agent.response_language import effective_response_language
from marketbot.i18n import localized
from marketbot.market_reporting import (
    render_analysis_explainability,
    render_analysis_explainability_summary,
    render_chat_explainability_footer_for_channel,
)


def extract_market_brief_payload(messages: list[dict]) -> dict[str, Any]:
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


def append_chat_explainability(loop, final_content: str | None, explainability: dict[str, Any] | None) -> str | None:
    """Append explainability footer for inline-only entrypoints like CLI/system."""
    if not final_content or not isinstance(explainability, dict):
        return final_content
    if loop._DAILY_OPPORTUNITY_SKILL in loop._selected_skill_names():
        return final_content
    if is_publish_result_message(final_content):
        return final_content
    if str(explainability.get("delivery", "")).strip().lower() != "inline":
        return final_content
    footer = str(explainability.get("inline_footer", "")).strip()
    if not footer or footer in final_content:
        return final_content
    return f"{final_content.rstrip()}\n\n{footer}"


def is_publish_result_message(content: str | None) -> bool:
    """Return True when content is a terminal publisher status message."""
    normalized = str(content or "").strip()
    publish_prefixes = (
        "推特已发送",
        "推特发送失败",
        "小红书已发送",
        "小红书发送失败",
        "Twitter posted",
        "Twitter post failed",
        "Xiaohongshu posted",
        "Xiaohongshu post failed",
    )
    return bool(normalized) and normalized.startswith(publish_prefixes)


def build_chat_explainability(loop, messages: list[dict], *, channel: str) -> dict[str, Any] | None:
    """Build a structured explainability bundle for the current reply."""
    skill_routing = loop.processor.get_last_skill_routing()
    selected_names = set(loop._selected_skill_names())
    if {"xiaohongshu-publisher", "twitter-publisher"} & selected_names:
        return None
    fallback_execution = getattr(loop, "_last_skill_fallback", None)
    if isinstance(skill_routing, dict) and fallback_execution:
        skill_routing = dict(skill_routing)
        skill_routing["fallbackExecution"] = dict(fallback_execution)
    payload = extract_market_brief_payload(messages)
    mode = loop._resolve_explainability_mode(channel)
    delivery = loop._resolve_explainability_delivery(channel)
    language = effective_response_language(getattr(loop, "language", "en"))
    inline_footer = render_chat_explainability_footer_for_channel(
        payload,
        skill_routing=skill_routing,
        channel=channel,
        mode=mode,
        language=language,
    )
    summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing, language=language)
    details = render_analysis_explainability(payload, skill_routing=skill_routing, language=language)
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


def build_external_skill_install_suggestions(loop) -> list[dict[str, str]]:
    """Convert routed external skill suggestions into install-ready suggestions."""
    routing = loop.processor.get_last_skill_routing() or {}
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


def append_external_skill_suggestions(
    final_content: str | None,
    suggestions: list[dict[str, str]] | None,
    *,
    language: str = "en",
) -> str | None:
    """Append install-ready external skill suggestions to the final reply."""
    if not final_content or not suggestions:
        return final_content
    language = effective_response_language(language)
    lines = [localized("## External Skill Suggestions", "## 外部技能建议", language)]
    for item in suggestions[:3]:
        name = item.get("name", "").strip()
        command = item.get("install_command", "").strip()
        description = item.get("description", "").strip()
        if not name or not command:
            continue
        instruction = localized("install with", "安装命令", language)
        line = f"- `{name}`: {instruction} `{command}`"
        if description:
            line += f" — {description}"
        lines.append(line)
    block = "\n".join(lines)
    if block in final_content:
        return final_content
    return f"{final_content.rstrip()}\n\n{block}"


def persist_local_report_if_needed(
    loop,
    final_content: str | None,
    *,
    request_text: str | None = None,
) -> Path | None:
    """Persist markdown reports for fixed daily opportunity scans."""
    if not final_content or "daily-market-opportunity" not in loop._selected_skill_names():
        return None
    if loop._match_daily_opportunity_report_query(request_text):
        return None
    normalized = final_content.strip()
    if not normalized:
        return None
    if loop._looks_like_daily_opportunity_failure(normalized):
        return None
    if not any(
        marker in normalized
        for marker in ("每日机会", "高置信", "观察名单", "Watchlist", "Market Regime")
    ):
        return None
    report_dir = loop.workspace / "reports" / "daily-market-opportunity"
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_path = report_dir / f"{stamp}-daily-market-opportunity.md"
    language = effective_response_language(getattr(loop, "language", "en"))
    header = [
        localized("# Daily Market Opportunity", "# 每日市场机会", language),
        "",
        f"- {localized('Generated at', '生成时间', language)}: {datetime.now().isoformat()}",
    ]
    clean_request = str(request_text or "").strip()
    if clean_request:
        header.append(f"- {localized('Request', '用户请求', language)}: {clean_request}")
    header.extend(["", "---", "", final_content.rstrip(), ""])
    report_path.write_text("\n".join(header), encoding="utf-8")
    return report_path


def append_saved_report_path(final_content: str | None, report_path: Path | None, *, language: str = "en") -> str | None:
    """Append the local markdown path when a report was persisted."""
    if not final_content or report_path is None:
        return final_content
    language = effective_response_language(language)
    note = f"{localized('Saved locally', '已保存到本地', language)}: {report_path}"
    if note in final_content:
        return final_content
    return f"{final_content.rstrip()}\n\n{note}"

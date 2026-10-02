"""Shared helpers for market report generation and heartbeat parsing."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from marketbot.i18n import msg
from marketbot.market_routing import classify_market_request

_MARKET_MODE_RE = re.compile(r"<!--\s*marketbot:mode\s+([a-z0-9\-_]+)\s*-->", re.I)
_TZ_RE = re.compile(r"<!--\s*marketbot:timezone\s+([A-Za-z0-9_\-/+]+)\s*-->")
_SYMBOLS_RE = re.compile(r"<!--\s*marketbot:symbols\s+([A-Za-z0-9,\-._\s]+)\s*-->")
_ACTIVE_SYMBOLS_RE = re.compile(r"^\s*Active symbols:\s*(.+?)\s*$", re.I | re.M)

_REPORT_LABELS_ZH = {
    "Market Report": "市场研究报告",
    "Market Report Alert": "市场报告提醒",
    "Session": "报告时段",
    "Timezone": "时区",
    "Generated At": "生成时间",
    "Symbols": "标的",
    "Market Focus": "市场类别",
    "Market State": "市场状态",
    "Market Sentiment Index": "市场情绪指数",
    "Macro Regime": "宏观状态",
    "Social Sentiment": "社交情绪",
    "Trigger Headline": "触发标题",
    "Research Evidence": "研究证据",
    "Ledger record": "证据记录",
    "Summary": "摘要",
    "Signals": "规则信号",
    "Action": "行动标签",
    "Confidence": "置信度",
    "Score": "评分",
    "Scenario Playbook": "情景方案",
    "Aggressive": "积极方案",
    "Neutral": "中性方案",
    "Defensive": "防守方案",
    "Event Impact": "事件影响",
    "Event Type": "事件类型",
    "Sentiment": "情绪",
    "Impacted Assets": "相关资产",
    "News Flow": "新闻动态",
    "Social Pulse": "社交动态",
    "Warnings": "数据提示",
    "Capability & Data Notes": "能力与数据说明",
    "Tool Output": "工具输出",
    "Top signals": "主要信号",
    "Attachment": "附件",
    "Skill Routing Request": "技能路由请求",
    "Selected Skills": "已选技能",
    "Blocked Skill": "受限技能",
    "Skill Fallback": "技能回退",
    "Data Reliability": "数据可靠性",
    "Coverage": "覆盖状态",
    "Skills": "技能",
    "Fallback": "回退",
    "Reliability": "可靠性",
    "Capability & Data": "能力与数据",
    "Skills used": "使用的技能",
    "Blocked skill": "受限技能",
    "Data reliability": "数据可靠性",
    "Snapshot": "行情",
    "News": "新闻",
    "Macro": "宏观",
    "No plan": "暂无方案",
}


def _report_label(text: str, *, language: str = "en") -> str:
    """Translate generated labels while preserving source facts and heading levels."""
    if language != "zh":
        return text
    prefix = re.match(r"^#+\s+", text)
    if prefix:
        return prefix.group() + _REPORT_LABELS_ZH.get(text[prefix.end() :], text[prefix.end() :])
    return _REPORT_LABELS_ZH.get(text, text)


def _report_metric(value: object, *, language: str) -> str:
    return msg("unavailable", "不可用", language) if value is None else f"{float(value):.2f}"


def _macro_report_summary(macro: dict, *, language: str) -> str:
    regime = str(macro.get("regime", "unknown"))
    if regime == "unknown" or macro.get("macroRiskDataStatus") == "insufficient_data":
        return regime + msg(
            "; risk unavailable (neutral compatibility default, not observed data)",
            "；宏观风险不可用（中性兼容默认值，非观测数据）",
            language,
        )
    return f"{regime} (risk={_report_metric(macro.get('macroRisk'), language=language)})"


def parse_symbol_csv(symbols: str | None) -> list[str]:
    """Parse comma-separated symbols into a normalized, deduplicated list."""
    if not symbols:
        return []
    result: list[str] = []
    for part in symbols.split(","):
        symbol = part.strip().upper()
        if symbol and symbol not in result:
            result.append(symbol)
    return result


def resolve_market_timezone(timezone_name: str) -> ZoneInfo:
    """Resolve an IANA timezone, falling back to UTC when unavailable."""
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def infer_market_report_session(now: datetime) -> str:
    """Map a timestamp to the report session label."""
    if now.weekday() >= 5:
        return "close"
    current = (now.hour * 60) + now.minute
    if current < 9 * 60 + 30:
        return "premarket"
    if current < 16 * 60:
        return "intraday"
    return "close"


def default_market_report_path(workspace: Path, session: str, timezone_name: str) -> Path:
    """Build a timestamped report path under workspace/reports."""
    tz = resolve_market_timezone(timezone_name)
    stamp = datetime.now(tz).strftime("%Y%m%d_%H%M%S")
    return workspace / "reports" / f"market_report_{session}_{stamp}.md"


def render_market_report_document(
    payload: dict,
    *,
    symbols: list[str],
    headline: str,
    session: str,
    timezone_name: str,
    skill_routing: dict | None = None,
    language: str = "en",
) -> str:
    """Render a standardized market report document for saved or delivered reports."""
    t = partial(_report_label, language=language)
    market_state = str(payload.get("marketState", "unknown")).upper()
    sentiment_index = _report_metric(payload.get("marketSentimentIndex"), language=language)
    market_route = payload.get("marketRoute", {}) or {}
    market_focus = str(market_route.get("primary", "general"))
    macro = payload.get("macro", {}) or {}
    macro_regime = str(macro.get("regime", "unknown"))
    social = payload.get("social", {}) or {}
    social_overall = _report_metric(social.get("overallSentiment"), language=language)
    signals = payload.get("signals", []) or []
    scenarios = payload.get("scenarios", {}) or {}
    event = payload.get("event") or {}
    news = payload.get("news", {}) or {}
    snapshot = payload.get("snapshot", {}) or {}

    lines = [
        t("# Market Report"),
        "",
        f"- {t('Session')}: {session}",
        f"- {t('Timezone')}: {timezone_name}",
        f"- {t('Generated At')}: {payload.get('asOf', datetime.now(UTC).isoformat().replace('+00:00', 'Z'))}",
        f"- {t('Symbols')}: {', '.join(symbols)}",
        f"- {t('Market Focus')}: {market_focus}",
        f"- {t('Market State')}: {market_state}",
        f"- {t('Market Sentiment Index')}: {sentiment_index}",
        f"- {t('Macro Regime')}: {_macro_report_summary(macro, language=language)}",
        f"- {t('Social Sentiment')}: {social_overall}",
    ]

    if headline.strip():
        lines.append(f"- {t('Trigger Headline')}: {headline.strip()}")

    if payload.get("evidenceRecordId"):
        lines += [
            "",
            t("## Research Evidence"),
            "",
            f"- {t('Ledger record')}: `{payload['evidenceRecordId']}`",
            (
                "- 用 evidence_get 查看原始记录。来源观测时间与报告生成时间分别保留。"
                if language == "zh"
                else "- Inspect with evidence_get. Source observation times remain distinct from report generation time."
            ),
        ]
    if payload.get("evidenceRecording", {}).get("ok") is False:
        lines.append(
            (
                "- 证据记录失败，本报告没有可核验的证据记录。"
                if language == "zh"
                else "- Evidence recording failed; this report has no verified ledger record."
            )
        )

    lines += [
        "",
        t("## Summary"),
        "",
        (
            f"本次{session}报告的市场状态为{market_state.lower()}，宏观状态为 `{macro_regime}`，情绪指数为 `{sentiment_index}`。"
            if language == "zh"
            else f"This {session} report reads the tape as {market_state.lower()} with macro regime `{macro_regime}` and sentiment index `{sentiment_index}`."
        ),
        "",
        t("## Signals"),
    ]

    if signals:
        for signal_row in signals:
            symbol = str(signal_row.get("symbol", "")).upper()
            action = str(signal_row.get("action", "watch")).upper()
            confidence = float(signal_row.get("confidence", 0.0))
            score = float(signal_row.get("score", 0.0))
            signal_card = str(signal_row.get("signalCard", "")).strip()
            lines.append(f"### {symbol}")
            lines.append(f"- {t('Action')}: {action}")
            lines.append(f"- {t('Confidence')}: {confidence:.2f}")
            lines.append(f"- {t('Score')}: {score:.2f}")
            if signal_card:
                lines += ["", signal_card, ""]
    else:
        lines += [
            "",
            ("- 未生成规则信号。" if language == "zh" else "- No signal output generated."),
            "",
        ]

    lines += [
        t("## Scenario Playbook"),
        "",
        f"- {t('Aggressive')}: {'; '.join(scenarios.get('aggressive', [t('No plan')]))}",
        f"- {t('Neutral')}: {'; '.join(scenarios.get('neutral', [t('No plan')]))}",
        f"- {t('Defensive')}: {'; '.join(scenarios.get('defensive', [t('No plan')]))}",
    ]

    if event:
        lines += [
            "",
            t("## Event Impact"),
            "",
            f"- {t('Event Type')}: {event.get('eventType', 'unknown')}",
            f"- {t('Sentiment')}: {event.get('sentimentLabel', 'neutral')} ({float(event.get('sentimentScore', 0.0)):.2f})",
        ]
        impacted = event.get("impactedAssets", []) or []
        if impacted:
            lines.append(f"- {t('Impacted Assets')}: {', '.join(str(item) for item in impacted)}")

    news_items = news.get("items", []) or []
    if news_items:
        lines += ["", t("## News Flow"), ""]
        for item in news_items[:6]:
            title = str(item.get("title", "")).strip()
            symbol = str(item.get("symbol", "")).upper()
            source = str(item.get("source", "unknown"))
            published_at = str(item.get("publishedAt", ""))
            url = str(item.get("url") or "").strip()
            reference = f" | {url}" if url else ""
            lines.append(f"- {symbol}: {title} [{source}, {published_at}]{reference}")

    social_rows = social.get("perSymbol", []) or []
    if social_rows:
        lines += ["", t("## Social Pulse"), ""]
        for item in social_rows:
            symbol = str(item.get("symbol", "")).upper()
            sentiment = float(item.get("sentiment", 0.0))
            confidence = float(item.get("confidence", 0.0))
            mentions = int(item.get("mentions", 0))
            lines.append(
                f"- {symbol}: sentiment={sentiment:.2f}, confidence={confidence:.2f}, mentions={mentions}"
            )

    warnings: list[str] = []
    for section in (snapshot, news, social, macro):
        warnings.extend(str(item) for item in (section.get("warnings", []) or []))
    if warnings:
        lines += ["", t("## Warnings"), ""]
        for warning in warnings:
            lines.append(f"- {warning}")

    explainability = render_analysis_explainability(
        payload, skill_routing=skill_routing, language=language
    )
    if explainability:
        lines += ["", t("## Capability & Data Notes"), "", explainability]

    brief_markdown = str(payload.get("briefMarkdown", "")).strip()
    if brief_markdown:
        lines += ["", t("## Tool Output"), "", brief_markdown]

    return "\n".join(lines).rstrip() + "\n"


def render_market_report_notification(
    payload: dict,
    *,
    symbols: list[str],
    session: str,
    timezone_name: str,
    report_path: Path,
    channel: str = "generic",
    skill_routing: dict | None = None,
    language: str = "en",
) -> str:
    """Render a short channel-friendly notification for a saved market report."""
    t = partial(_report_label, language=language)
    market_state = str(payload.get("marketState", "unknown")).upper()
    sentiment_index = _report_metric(payload.get("marketSentimentIndex"), language=language)
    market_route = payload.get("marketRoute", {}) or {}
    market_focus = str(market_route.get("primary", "general"))
    macro = payload.get("macro", {}) or {}
    signals = payload.get("signals", []) or []

    top_lines: list[str] = []
    for row in signals[:3]:
        symbol = str(row.get("symbol", "")).upper()
        action = str(row.get("action", "watch")).upper()
        confidence = float(row.get("confidence", 0.0))
        top_lines.append(f"- {symbol}: {action} ({confidence:.2f})")

    channel_key = channel.strip().lower()
    if channel_key == "slack":
        title = f"*{t('Market Report Alert')} ({session})*"
    elif channel_key in {"telegram", "whatsapp", "qq", "dingtalk"}:
        title = f"{t('Market Report Alert')} ({session})"
    else:
        title = f"# {t('Market Report Alert')} ({session})"

    lines = [
        title,
        "",
        f"{t('Symbols')}: {', '.join(symbols)}",
        f"{t('Market Focus')}: {market_focus}",
        f"{t('Timezone')}: {timezone_name}",
        f"{t('Market State')}: {market_state}",
        f"{t('Market Sentiment Index')}: {sentiment_index}",
        f"{t('Macro Regime')}: {_macro_report_summary(macro, language=language)}",
    ]
    explainability_summary = render_analysis_explainability_summary(
        payload, skill_routing=skill_routing, language=language
    )
    if explainability_summary:
        lines.append(explainability_summary)
    if top_lines:
        lines += ["", t("Top signals") + ":"] + top_lines
    lines += [
        "",
        f"{t('Attachment')}: {report_path.name}",
    ]
    return "\n".join(lines)


def render_analysis_explainability(
    payload: dict, *, skill_routing: dict | None = None, language: str = "en"
) -> str:
    """Render standardized capability and data coverage notes for reports."""
    t = partial(_report_label, language=language)
    lines: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = routing.get("selected", []) or []
    blocked = routing.get("blocked", []) or []
    fallback_execution = routing.get("fallbackExecution") or {}
    request_profile = routing.get("requestProfile", {}) or {}
    data_reliability = payload.get("dataReliability", {}) or {}

    if selected or blocked:
        markets = (
            ", ".join(str(item) for item in request_profile.get("markets", []) if str(item).strip())
            or "unspecified"
        )
        asset_classes = (
            ", ".join(
                str(item) for item in request_profile.get("asset_classes", []) if str(item).strip()
            )
            or "unspecified"
        )
        lines.append(
            f"- {t('Skill Routing Request')}: markets={markets}; asset_classes={asset_classes}"
        )
        if selected:
            lines.append(
                f"- {t('Selected Skills')}: {', '.join(str(item.get('name', '')) for item in selected if item.get('name'))}"
            )
        if blocked:
            for item in blocked[:3]:
                name = str(item.get("name", "")).strip()
                reasons = [str(reason) for reason in item.get("reasons", []) if str(reason).strip()]
                if name and reasons:
                    lines.append(f"- {t('Blocked Skill')}: {name} | {'; '.join(reasons[:2])}")
        if fallback_execution:
            primary = str(fallback_execution.get("primarySkill", "")).strip()
            final = str(fallback_execution.get("finalSkill", "")).strip()
            selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
            chain = (
                f"{primary} -> {selected_fallback or final}"
                if primary and (selected_fallback or final)
                else ""
            )
            if chain:
                lines.append(f"- {t('Skill Fallback')}: {chain}")

    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    components = data_reliability.get("components", {}) or {}
    if overall_status:
        lines.append(f"- {t('Data Reliability')}: {overall_status}")
        for name in ("snapshot", "news", "macro"):
            component = components.get(name) or {}
            if not component:
                continue
            status = str(component.get("status", "unknown"))
            source_health = component.get("sourceHealth", {}) or {}
            details = ", ".join(
                f"{source}={state.get('status', 'unknown')}"
                for source, state in source_health.items()
                if isinstance(state, dict)
            )
            if details:
                lines.append(f"- {t(name.title())} {t('Coverage')}: {details}")
            else:
                lines.append(f"- {t(name.title())} {t('Coverage')}: {status}")

    return "\n".join(lines).strip()


def render_analysis_explainability_summary(
    payload: dict, *, skill_routing: dict | None = None, language: str = "en"
) -> str:
    """Render a single-line explainability summary for notifications."""
    t = partial(_report_label, language=language)
    bits: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = [
        str(item.get("name", "")).strip()
        for item in (routing.get("selected", []) or [])
        if str(item.get("name", "")).strip()
    ]
    fallback_execution = routing.get("fallbackExecution") or {}
    if selected:
        bits.append(f"{t('Skills')}: {', '.join(selected[:3])}")
    primary = str(fallback_execution.get("primarySkill", "")).strip()
    selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
    if primary and selected_fallback:
        bits.append(f"{t('Fallback')}: {primary}->{selected_fallback}")
    data_reliability = payload.get("dataReliability", {}) or {}
    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    if overall_status:
        bits.append(f"{t('Reliability')}: {overall_status}")
    return " | ".join(bits)


def render_chat_explainability_footer(
    payload: dict, *, skill_routing: dict | None = None, language: str = "en"
) -> str:
    """Render a concise explainability footer suitable for chat replies."""
    return render_chat_explainability_footer_for_channel(
        payload, skill_routing=skill_routing, channel="generic", language=language
    )


def render_chat_explainability_footer_for_channel(
    payload: dict,
    *,
    skill_routing: dict | None = None,
    channel: str = "generic",
    mode: str = "auto",
    language: str = "en",
) -> str:
    """Render channel-aware explainability notes for chat replies."""
    t = partial(_report_label, language=language)
    resolved_mode = (mode or "auto").strip().lower()
    channel_key = channel.strip().lower()
    if resolved_mode == "off":
        return ""
    if resolved_mode == "summary" or (
        resolved_mode == "auto"
        and channel_key in {"telegram", "slack", "whatsapp", "qq", "dingtalk", "feishu", "mochat"}
    ):
        summary = render_analysis_explainability_summary(
            payload, skill_routing=skill_routing, language=language
        )
        return f"_{t('Capability & Data')}_: {summary}" if summary else ""

    lines: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = [
        str(item.get("name", "")).strip()
        for item in (routing.get("selected", []) or [])
        if str(item.get("name", "")).strip()
    ]
    blocked = routing.get("blocked", []) or []
    fallback_execution = routing.get("fallbackExecution") or {}
    data_reliability = payload.get("dataReliability", {}) or {}

    if selected:
        lines.append(f"- {t('Skills used')}: {', '.join(selected[:3])}")
    primary = str(fallback_execution.get("primarySkill", "")).strip()
    selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
    if primary and selected_fallback:
        lines.append(f"- {t('Fallback')}: {primary}->{selected_fallback}")
    if blocked:
        blocked_row = blocked[0]
        name = str(blocked_row.get("name", "")).strip()
        reasons = [str(reason) for reason in blocked_row.get("reasons", []) if str(reason).strip()]
        if name and reasons:
            lines.append(f"- {t('Blocked skill')}: {name} ({'; '.join(reasons[:1])})")

    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    if overall_status:
        lines.append(f"- {t('Data reliability')}: {overall_status}")

    if not lines:
        return ""

    return t("## Capability & Data Notes") + "\n" + "\n".join(lines)


def extract_market_heartbeat_spec(
    content: str, now: datetime | None = None
) -> dict[str, object] | None:
    """Parse market heartbeat metadata and derive the current report session."""
    mode_match = _MARKET_MODE_RE.search(content)
    mode = mode_match.group(1).strip().lower() if mode_match else ""

    symbol_match = _SYMBOLS_RE.search(content)
    symbol_text = symbol_match.group(1).strip() if symbol_match else ""
    if not symbol_text:
        legacy_match = _ACTIVE_SYMBOLS_RE.search(content)
        symbol_text = legacy_match.group(1).strip() if legacy_match else ""

    symbols = parse_symbol_csv(symbol_text)
    if not symbols:
        return None

    if mode and mode != "market-report":
        return None

    timezone_match = _TZ_RE.search(content)
    timezone_name = timezone_match.group(1).strip() if timezone_match else "America/New_York"
    current = now or datetime.now(resolve_market_timezone(timezone_name))
    current = current.astimezone(resolve_market_timezone(timezone_name))
    session = infer_market_report_session(current)
    joined = ", ".join(symbols)
    market_route = classify_market_request(symbols=symbols)

    return {
        "mode": "market-report",
        "symbols": symbols,
        "timezone": timezone_name,
        "session": session,
        "marketRoute": market_route,
        "task": (
            f"Generate a {session} {market_route['primary']} market report for symbols: {joined}. "
            "Use current market data and return concise, actionable markdown."
        ),
    }

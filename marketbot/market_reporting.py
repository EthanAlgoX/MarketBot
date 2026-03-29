"""Shared helpers for market report generation and heartbeat parsing."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from marketbot.market_routing import classify_market_request

_MARKET_MODE_RE = re.compile(r"<!--\s*marketbot:mode\s+([a-z0-9\-_]+)\s*-->", re.I)
_TZ_RE = re.compile(r"<!--\s*marketbot:timezone\s+([A-Za-z0-9_\-/+]+)\s*-->")
_SYMBOLS_RE = re.compile(r"<!--\s*marketbot:symbols\s+([A-Za-z0-9,\-._\s]+)\s*-->")
_ACTIVE_SYMBOLS_RE = re.compile(r"^\s*Active symbols:\s*(.+?)\s*$", re.I | re.M)


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
) -> str:
    """Render a standardized market report document for saved or delivered reports."""
    market_state = str(payload.get("marketState", "unknown")).upper()
    sentiment_index = float(payload.get("marketSentimentIndex", 0.0))
    market_route = payload.get("marketRoute", {}) or {}
    market_focus = str(market_route.get("primary", "general"))
    macro = payload.get("macro", {}) or {}
    macro_regime = str(macro.get("regime", "unknown"))
    macro_risk = float(macro.get("macroRisk", 0.5))
    social = payload.get("social", {}) or {}
    social_overall = float(social.get("overallSentiment", 0.0))
    signals = payload.get("signals", []) or []
    scenarios = payload.get("scenarios", {}) or {}
    event = payload.get("event") or {}
    news = payload.get("news", {}) or {}
    snapshot = payload.get("snapshot", {}) or {}

    lines = [
        "# Market Report",
        "",
        f"- Session: {session}",
        f"- Timezone: {timezone_name}",
        f"- Generated At: {payload.get('asOf', datetime.now(UTC).isoformat().replace('+00:00', 'Z'))}",
        f"- Symbols: {', '.join(symbols)}",
        f"- Market Focus: {market_focus}",
        f"- Market State: {market_state}",
        f"- Market Sentiment Index: {sentiment_index:.2f}",
        f"- Macro Regime: {macro_regime} (risk={macro_risk:.2f})",
        f"- Social Sentiment: {social_overall:.2f}",
    ]

    if headline.strip():
        lines.append(f"- Trigger Headline: {headline.strip()}")

    lines += [
        "",
        "## Summary",
        "",
        f"This {session} report reads the tape as {market_state.lower()} with macro regime `{macro_regime}` and sentiment index `{sentiment_index:.2f}`.",
        "",
        "## Signals",
    ]

    if signals:
        for signal_row in signals:
            symbol = str(signal_row.get("symbol", "")).upper()
            action = str(signal_row.get("action", "watch")).upper()
            confidence = float(signal_row.get("confidence", 0.0))
            score = float(signal_row.get("score", 0.0))
            signal_card = str(signal_row.get("signalCard", "")).strip()
            lines.append(f"### {symbol}")
            lines.append(f"- Action: {action}")
            lines.append(f"- Confidence: {confidence:.2f}")
            lines.append(f"- Score: {score:.2f}")
            if signal_card:
                lines += ["", signal_card, ""]
    else:
        lines += ["", "- No signal output generated.", ""]

    lines += [
        "## Scenario Playbook",
        "",
        f"- Aggressive: {'; '.join(scenarios.get('aggressive', ['No plan']))}",
        f"- Neutral: {'; '.join(scenarios.get('neutral', ['No plan']))}",
        f"- Defensive: {'; '.join(scenarios.get('defensive', ['No plan']))}",
    ]

    if event:
        lines += [
            "",
            "## Event Impact",
            "",
            f"- Event Type: {event.get('eventType', 'unknown')}",
            f"- Sentiment: {event.get('sentimentLabel', 'neutral')} ({float(event.get('sentimentScore', 0.0)):.2f})",
        ]
        impacted = event.get("impactedAssets", []) or []
        if impacted:
            lines.append(f"- Impacted Assets: {', '.join(str(item) for item in impacted)}")

    news_items = news.get("items", []) or []
    if news_items:
        lines += ["", "## News Flow", ""]
        for item in news_items[:6]:
            title = str(item.get("title", "")).strip()
            symbol = str(item.get("symbol", "")).upper()
            source = str(item.get("source", "unknown"))
            published_at = str(item.get("publishedAt", ""))
            lines.append(f"- {symbol}: {title} [{source}, {published_at}]")

    social_rows = social.get("perSymbol", []) or []
    if social_rows:
        lines += ["", "## Social Pulse", ""]
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
        lines += ["", "## Warnings", ""]
        for warning in warnings:
            lines.append(f"- {warning}")

    explainability = render_analysis_explainability(payload, skill_routing=skill_routing)
    if explainability:
        lines += ["", "## Capability & Data Notes", "", explainability]

    brief_markdown = str(payload.get("briefMarkdown", "")).strip()
    if brief_markdown:
        lines += ["", "## Tool Output", "", brief_markdown]

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
) -> str:
    """Render a short channel-friendly notification for a saved market report."""
    market_state = str(payload.get("marketState", "unknown")).upper()
    sentiment_index = float(payload.get("marketSentimentIndex", 0.0))
    market_route = payload.get("marketRoute", {}) or {}
    market_focus = str(market_route.get("primary", "general"))
    macro = payload.get("macro", {}) or {}
    macro_regime = str(macro.get("regime", "unknown"))
    macro_risk = float(macro.get("macroRisk", 0.5))
    signals = payload.get("signals", []) or []

    top_lines: list[str] = []
    for row in signals[:3]:
        symbol = str(row.get("symbol", "")).upper()
        action = str(row.get("action", "watch")).upper()
        confidence = float(row.get("confidence", 0.0))
        top_lines.append(f"- {symbol}: {action} ({confidence:.2f})")

    channel_key = channel.strip().lower()
    if channel_key == "slack":
        title = f"*Market Report Alert ({session})*"
    elif channel_key in {"telegram", "whatsapp", "qq", "dingtalk"}:
        title = f"Market Report Alert ({session})"
    else:
        title = f"# Market Report Alert ({session})"

    lines = [
        title,
        "",
        f"Symbols: {', '.join(symbols)}",
        f"Market Focus: {market_focus}",
        f"Timezone: {timezone_name}",
        f"Market State: {market_state}",
        f"Market Sentiment Index: {sentiment_index:.2f}",
        f"Macro Regime: {macro_regime} (risk={macro_risk:.2f})",
    ]
    explainability_summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing)
    if explainability_summary:
        lines.append(explainability_summary)
    if top_lines:
        lines += ["", "Top signals:"] + top_lines
    lines += [
        "",
        f"Attachment: {report_path.name}",
    ]
    return "\n".join(lines)


def render_analysis_explainability(payload: dict, *, skill_routing: dict | None = None) -> str:
    """Render standardized capability and data coverage notes for reports."""
    lines: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = routing.get("selected", []) or []
    blocked = routing.get("blocked", []) or []
    fallback_execution = routing.get("fallbackExecution") or {}
    request_profile = routing.get("requestProfile", {}) or {}
    data_reliability = payload.get("dataReliability", {}) or {}

    if selected or blocked:
        markets = ", ".join(str(item) for item in request_profile.get("markets", []) if str(item).strip()) or "unspecified"
        asset_classes = (
            ", ".join(str(item) for item in request_profile.get("asset_classes", []) if str(item).strip()) or "unspecified"
        )
        lines.append(f"- Skill Routing Request: markets={markets}; asset_classes={asset_classes}")
        if selected:
            lines.append(f"- Selected Skills: {', '.join(str(item.get('name', '')) for item in selected if item.get('name'))}")
        if blocked:
            for item in blocked[:3]:
                name = str(item.get("name", "")).strip()
                reasons = [str(reason) for reason in item.get("reasons", []) if str(reason).strip()]
                if name and reasons:
                    lines.append(f"- Blocked Skill: {name} | {'; '.join(reasons[:2])}")
        if fallback_execution:
            primary = str(fallback_execution.get("primarySkill", "")).strip()
            final = str(fallback_execution.get("finalSkill", "")).strip()
            selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
            chain = f"{primary} -> {selected_fallback or final}" if primary and (selected_fallback or final) else ""
            if chain:
                lines.append(f"- Skill Fallback: {chain}")

    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    components = data_reliability.get("components", {}) or {}
    if overall_status:
        lines.append(f"- Data Reliability: {overall_status}")
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
                lines.append(f"- {name.title()} Coverage: {details}")
            else:
                lines.append(f"- {name.title()} Coverage: {status}")

    return "\n".join(lines).strip()


def render_analysis_explainability_summary(payload: dict, *, skill_routing: dict | None = None) -> str:
    """Render a single-line explainability summary for notifications."""
    bits: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = [str(item.get("name", "")).strip() for item in (routing.get("selected", []) or []) if str(item.get("name", "")).strip()]
    fallback_execution = routing.get("fallbackExecution") or {}
    if selected:
        bits.append(f"Skills: {', '.join(selected[:3])}")
    primary = str(fallback_execution.get("primarySkill", "")).strip()
    selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
    if primary and selected_fallback:
        bits.append(f"Fallback: {primary}->{selected_fallback}")
    data_reliability = payload.get("dataReliability", {}) or {}
    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    if overall_status:
        bits.append(f"Reliability: {overall_status}")
    return " | ".join(bits)


def render_chat_explainability_footer(payload: dict, *, skill_routing: dict | None = None) -> str:
    """Render a concise explainability footer suitable for chat replies."""
    return render_chat_explainability_footer_for_channel(payload, skill_routing=skill_routing, channel="generic")


def render_chat_explainability_footer_for_channel(
    payload: dict,
    *,
    skill_routing: dict | None = None,
    channel: str = "generic",
    mode: str = "auto",
) -> str:
    """Render channel-aware explainability notes for chat replies."""
    resolved_mode = (mode or "auto").strip().lower()
    channel_key = channel.strip().lower()
    if resolved_mode == "off":
        return ""
    if resolved_mode == "summary" or (
        resolved_mode == "auto"
        and channel_key in {"telegram", "slack", "whatsapp", "qq", "dingtalk", "feishu", "mochat"}
    ):
        summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing)
        return f"_Capability & Data_: {summary}" if summary else ""

    lines: list[str] = []
    routing = skill_routing or payload.get("skillRouting") or {}
    selected = [str(item.get("name", "")).strip() for item in (routing.get("selected", []) or []) if str(item.get("name", "")).strip()]
    blocked = routing.get("blocked", []) or []
    fallback_execution = routing.get("fallbackExecution") or {}
    data_reliability = payload.get("dataReliability", {}) or {}

    if selected:
        lines.append(f"- Skills used: {', '.join(selected[:3])}")
    primary = str(fallback_execution.get("primarySkill", "")).strip()
    selected_fallback = str(fallback_execution.get("selectedFallback", "")).strip()
    if primary and selected_fallback:
        lines.append(f"- Fallback: {primary}->{selected_fallback}")
    if blocked:
        blocked_row = blocked[0]
        name = str(blocked_row.get("name", "")).strip()
        reasons = [str(reason) for reason in blocked_row.get("reasons", []) if str(reason).strip()]
        if name and reasons:
            lines.append(f"- Blocked skill: {name} ({'; '.join(reasons[:1])})")

    overall_status = str(data_reliability.get("overallStatus", "")).strip()
    if overall_status:
        lines.append(f"- Data reliability: {overall_status}")

    if not lines:
        return ""

    return "## Capability & Data Notes\n" + "\n".join(lines)


def extract_market_heartbeat_spec(content: str, now: datetime | None = None) -> dict[str, object] | None:
    """Parse market heartbeat metadata and derive the current report session."""
    mode_match = _MARKET_MODE_RE.search(content)
    mode = (mode_match.group(1).strip().lower() if mode_match else "")

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

"""Skill-routing and prompt-formatting helpers for ContextBuilder."""

from typing import Any

from marketbot.market_routing import classify_market_request


def build_skill_routing(
    builder: Any,
    current_message: str,
    skill_names: list[str] | None = None,
) -> dict[str, Any]:
    """Resolve explicit and auto-detected skills plus structured routing diagnostics."""
    resolved = builder._normalize_skill_names(skill_names)
    route = classify_market_request(text=current_message)
    diagnostics: list[dict[str, Any]] = []
    selected: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []

    for name in resolved:
        info = {
            **builder.skills.explain_skill_compatibility(
                name,
                current_message,
                route=route,
                available_tools=builder.available_tools,
                runtime_profile=builder.market_runtime_profile,
            ),
            "status": "selected",
            "source": "explicit",
        }
        diagnostics.append(info)
        selected.append(info)

    suggested, suggested_diagnostics = suggest_skills_for_message(builder, current_message, route=route)
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
                    "requestProfile": builder.skills._build_request_profile(current_message, route=route),
                    "status": "selected",
                    "source": "auto",
                }
                diagnostics.append(info)
                selected.append(info)

    selected_names = []
    deduped_selected: list[dict[str, Any]] = []
    ordered_selected = sorted(
        selected,
        key=lambda item: (
            -float(item.get("finalScore", 0.0) or 0.0),
            -float(item.get("ruleScore", 0.0) or 0.0),
            str(item.get("name", "")),
        ),
    )
    for item in ordered_selected:
        name = str(item.get("name", "")).strip()
        if not name or name in selected_names:
            continue
        selected_names.append(name)
        deduped_selected.append(item)

    deduped_selected = filter_meta_queries(current_message, deduped_selected)
    deduped_selected = prune_shadowed_skills(builder, deduped_selected)
    deduped_selected, fallback_diagnostics = append_fallback_skills(
        builder,
        current_message=current_message,
        route=route,
        selected=deduped_selected,
    )
    diagnostics.extend(fallback_diagnostics)

    external_suggestions: list[dict[str, Any]] = []
    if not deduped_selected and should_search_external_skills(current_message, diagnostics):
        external_suggestions = builder.skills.search_external_skills(current_message, limit=5)

    return {
        "requestText": current_message,
        "requestProfile": builder.skills._build_request_profile(current_message, route=route),
        "selected": deduped_selected,
        "blocked": blocked,
        "diagnostics": diagnostics,
        "externalSuggestions": external_suggestions,
    }


def append_fallback_skills(
    builder: Any,
    *,
    current_message: str,
    route: dict[str, object] | None,
    selected: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Append compatible fallback skills after their primary selected skill."""
    if not selected:
        return selected, []

    result: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    seen = {str(item.get("name", "")).strip() for item in selected if str(item.get("name", "")).strip()}

    for item in selected:
        result.append(item)
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        capabilities = builder.skills.get_skill_capabilities(name)
        for fallback_name in capabilities.get("fallback_skills", []):
            fallback_name = str(fallback_name).strip()
            if not fallback_name or fallback_name in seen:
                continue
            info = builder.skills.explain_skill_compatibility(
                fallback_name,
                current_message,
                route=route,
                available_tools=builder.available_tools,
                runtime_profile=builder.market_runtime_profile,
            )
            if not info.get("compatible"):
                diagnostics.append({**info, "status": "blocked", "source": "fallback"})
                continue
            selected_info = {**info, "status": "selected", "source": "fallback", "parent": name}
            diagnostics.append(selected_info)
            result.append(selected_info)
            seen.add(fallback_name)
    return result, diagnostics


def filter_meta_queries(
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
    if not any(term in text for term in daily_opportunity_terms):
        return selected
    if not any(term in text for term in meta_terms):
        return selected
    return [item for item in selected if str(item.get("name", "")).strip() != "daily-market-opportunity"]


def prune_shadowed_skills(builder: Any, selected: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop broad auto-selected skills when a higher-priority specialist is present."""
    if not selected:
        return selected

    by_name = {str(item.get("name", "")).strip(): item for item in selected}
    specialist_names = {
        name for name in by_name if builder.skills.get_skill_capabilities(name).get("priority", 50) >= 70
    }
    if not specialist_names:
        return selected

    shadow_pairs = {
        "xiaohongshu-publisher": {"xiaohongshu-browser-research", "social-signal-browser", "sentiment-analysis"},
        "twitter-publisher": {
            "twitter-browser-research",
            "xiaohongshu-browser-research",
            "social-signal-browser",
            "sentiment-analysis",
        },
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


def suggest_skills_for_message(
    builder: Any,
    current_message: str,
    route: dict[str, object] | None = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Suggest built-in skills from common market-analysis intents."""
    text = current_message.lower()
    suggestions: list[str] = []
    diagnostics: list[dict[str, Any]] = []
    candidates: list[str] = []

    def consider(name: str) -> None:
        if builder.skills.load_skill(name) and name not in candidates:
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
    xiaohongshu_publish_terms = (
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
    twitter_publish_terms = (
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

    if ("xiaohongshu" in text or "小红书" in text or "rednote" in text) and any(
        term in text for term in xiaohongshu_publish_terms
    ):
        consider("xiaohongshu-publisher")
    if ("twitter" in text or " x " in f" {text} " or "tweet" in text or "推特" in text or "推文" in text) and any(
        term in text for term in twitter_publish_terms
    ):
        consider("twitter-publisher")

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

    for name in builder.skills.find_trigger_candidates(current_message, available_tools=builder.available_tools):
        consider(name)

    for name in candidates:
        info = builder.skills.explain_skill_compatibility(
            name,
            current_message,
            route=route,
            available_tools=builder.available_tools,
            runtime_profile=builder.market_runtime_profile,
        )
        status = "selected" if info["compatible"] else "blocked"
        diagnostics.append({**info, "status": status, "source": "auto"})
        if info["compatible"] and name not in suggestions:
            suggestions.append(name)

    return suggestions, diagnostics


def should_search_external_skills(current_message: str, diagnostics: list[dict[str, Any]] | None = None) -> bool:
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


def format_intel_scheduler_note(
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


def format_skill_diagnostics(skill_diagnostics: list[dict[str, Any]] | None) -> str:
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


def format_external_skill_suggestions(external_skill_suggestions: list[dict[str, Any]] | None) -> str:
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


def format_browser_adapter_catalog(browser_adapter_catalog: list[str]) -> str:
    """Render configured browser adapters as runtime guidance."""
    if not browser_adapter_catalog:
        return ""
    lines = [
        "# Browser Adapter Catalog",
        "These browser_site adapters are configured for this runtime. Prefer them over ad hoc adapter guesses.",
    ]
    for adapter in browser_adapter_catalog[:20]:
        lines.append(f"- {adapter}")
    if len(browser_adapter_catalog) > 20:
        lines.append(f"- ... and {len(browser_adapter_catalog) - 20} more")
    return "\n".join(lines)

"""Tests for cache-friendly prompt construction."""

from __future__ import annotations

from datetime import datetime as real_datetime
from pathlib import Path
import datetime as datetime_module

from marketbot.agent.context import ContextBuilder
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market import build_market_runtime_profile


class _FakeDatetime(real_datetime):
    current = real_datetime(2026, 2, 24, 13, 59)

    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return cls.current


def _make_workspace(tmp_path: Path) -> Path:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True)
    return workspace


def test_system_prompt_stays_stable_when_clock_changes(tmp_path, monkeypatch) -> None:
    """System prompt should not change just because wall clock minute changes."""
    monkeypatch.setattr(datetime_module, "datetime", _FakeDatetime)

    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    _FakeDatetime.current = real_datetime(2026, 2, 24, 13, 59)
    prompt1 = builder.build_system_prompt()

    _FakeDatetime.current = real_datetime(2026, 2, 24, 14, 0)
    prompt2 = builder.build_system_prompt()

    assert prompt1 == prompt2


def test_bootstrap_files_are_cached_until_workspace_files_change(tmp_path, monkeypatch) -> None:
    workspace = _make_workspace(tmp_path)
    (workspace / "AGENTS.md").write_text("agent rules", encoding="utf-8")
    builder = ContextBuilder(workspace)

    read_calls: list[str] = []
    original_read_text = Path.read_text

    def _tracked_read_text(self: Path, *args, **kwargs):
        if self == workspace / "AGENTS.md":
            read_calls.append(self.name)
        return original_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", _tracked_read_text)

    prompt1 = builder.build_system_prompt()
    prompt2 = builder.build_system_prompt()

    assert prompt1 == prompt2
    assert read_calls == ["AGENTS.md"]

    (workspace / "AGENTS.md").write_text("updated agent rules", encoding="utf-8")
    prompt3 = builder.build_system_prompt()

    assert "updated agent rules" in prompt3
    assert read_calls == ["AGENTS.md", "AGENTS.md"]


def test_runtime_context_is_separate_untrusted_user_message(tmp_path) -> None:
    """Runtime metadata should be merged with the user message."""
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Return exactly: OK",
        channel="cli",
        chat_id="direct",
    )

    assert messages[0]["role"] == "system"
    assert "## Current Session" not in messages[0]["content"]

    # Runtime context is now merged with user message into a single message
    assert messages[-1]["role"] == "user"
    user_content = messages[-1]["content"]
    assert isinstance(user_content, str)
    assert ContextBuilder._RUNTIME_CONTEXT_TAG in user_content
    assert "Current Time:" in user_content
    assert "Channel: cli" in user_content
    assert "Chat ID: direct" in user_content
    assert "Return exactly: OK" in user_content


def test_system_prompt_includes_market_analysis_playbook(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    prompt = builder.build_system_prompt()

    assert "# Market Analysis Playbook" in prompt
    assert "`market-report`" in prompt
    assert "`catalyst-tracker`" in prompt
    assert "`risk-checklist`" in prompt
    assert "`stock-data-sourcing`" in prompt
    assert "`market_source_plan`" in prompt
    assert "`market_chip_distribution`" in prompt
    assert "`market_fundamentals`" in prompt
    assert "`market_brief`" in prompt
    assert "`market_signal`" in prompt


def test_skill_routing_appends_fallback_skills_for_browser_research(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site", "market_news"})
    builder.set_market_runtime_profile(build_market_runtime_profile(MarketToolsConfig()))

    builder.build_messages(
        history=[],
        current_message="用雪球看看 NVDA 的讨论热度",
        channel="cli",
        chat_id="direct",
    )
    routing = builder.get_last_skill_routing()

    assert routing is not None
    names = [item["name"] for item in routing["selected"]]
    assert "xueqiu-research" in names
    assert "social-signal-browser" in names
    fallback_item = next(item for item in routing["selected"] if item["name"] == "social-signal-browser")
    assert fallback_item["source"] == "fallback"
    assert fallback_item["parent"] == "xueqiu-research"


def test_system_prompt_includes_browser_adapter_catalog_when_configured(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_browser_adapter_catalog(["xueqiu/hot-stock", "reddit/search"])

    prompt = builder.build_system_prompt()

    assert "# Browser Adapter Catalog" in prompt
    assert "- xueqiu/hot-stock" in prompt
    assert "- reddit/search" in prompt


def test_system_prompt_includes_lark_tool_playbook_when_lark_tools_available(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"lark_cli", "lark_base", "lark_im", "lark_doc", "lark_sheets", "lark_task"})

    prompt = builder.build_system_prompt()

    assert "# Lark Tool Playbook" in prompt
    assert "Use `lark_base`" in prompt
    assert "Use `lark_im`" in prompt
    assert "Use `lark_doc`" in prompt
    assert "Use `lark_sheets`" in prompt
    assert "Use `lark_task`" in prompt
    assert "Use `lark_cli` only as a fallback" in prompt


def test_system_prompt_skills_summary_includes_browser_adapter_catalog_when_no_skill_selected(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_browser_adapter_catalog(["xueqiu/hot-stock", "reddit/search"])

    messages = builder.build_messages(
        history=[],
        current_message="Help me brainstorm a release note title.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "\n# Skills\n" in prompt
    assert "<browserAdapters>" in prompt
    assert "<adapter>xueqiu/hot-stock</adapter>" in prompt
    assert "<adapter>reddit/search</adapter>" in prompt


def test_non_market_message_omits_market_playbook_from_runtime_prompt(tmp_path, monkeypatch) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    monkeypatch.setattr(builder.skills, "search_external_skills", lambda text, limit=5: [])

    messages = builder.build_messages(
        history=[],
        current_message="Draft a release note for the desktop app login fix.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "# Market Analysis Playbook" not in prompt


def test_explicit_skill_names_are_loaded_into_system_prompt(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    prompt = builder.build_system_prompt(["market-report", "risk-checklist"])

    assert "# Selected Skills" in prompt
    assert "### Skill: market-report" in prompt
    assert "### Skill: risk-checklist" in prompt
    assert "/marketbot/skills/{skill-name}/SKILL.md" in prompt
    assert "use that inlined content first" in prompt


def test_market_analysis_message_auto_injects_market_skills(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Analyze NVDA swing setup, include catalysts and risk checklist.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-report" in prompt
    assert "### Skill: catalyst-tracker" in prompt
    assert "### Skill: risk-checklist" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert routing["requestProfile"]["markets"] == ["us"]
    assert {item["name"] for item in routing["selected"]} >= {"market-report", "catalyst-tracker", "risk-checklist"}
    assert "\n# Skills\n" not in prompt


def test_watchlist_screening_message_auto_injects_daily_stock_screener(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Screen and rank my watchlist AAPL, NVDA, TSLA for today's top candidates.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: daily-stock-screener" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert any(item["name"] == "daily-stock-screener" for item in routing["selected"])


def test_ai_digest_message_auto_injects_ak_rss_digest_when_exec_available(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"exec", "web_fetch"})

    messages = builder.build_messages(
        history=[],
        current_message="请生成一份 AI 日报，从固定 RSS 里整理阅读摘要。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: ak-rss-digest" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert any(item["name"] == "ak-rss-digest" for item in routing["selected"])


def test_tech_news_digest_message_auto_injects_when_web_fetch_available(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"web_fetch", "read_file", "write_file"})

    messages = builder.build_messages(
        history=[],
        current_message="Generate a tech news digest with today's AI news and product updates.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: tech-news-digest" in prompt


def test_intel_digest_message_auto_injects_when_exec_available(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"exec"})

    messages = builder.build_messages(
        history=[],
        current_message="Please build an intel digest and schedule it every morning at 8.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: intel-daily-digest" in prompt
    assert "# Intel Scheduling Rules" in prompt
    assert 'marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai' in prompt
    assert 'marketbot intel schedule-collect --cron-expr "55 7 * * *" --tz Asia/Shanghai' in prompt
    assert 'marketbot intel schedule-daily --cron-expr "0 8 * * *" --tz Asia/Shanghai' in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert any(item["name"] == "intel-daily-digest" for item in routing["selected"])
    assert "schedule-latest-daily" in messages[-1]["content"]


def test_intel_collector_message_auto_injects_when_exec_available(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"exec"})

    messages = builder.build_messages(
        history=[],
        current_message="Please add an RSS source for OpenAI news and schedule collection every 30 minutes.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: intel-collector" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert any(item["name"] == "intel-collector" for item in routing["selected"])


def test_external_skill_suggestions_are_added_when_no_local_skill_matches(tmp_path, monkeypatch) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    monkeypatch.setattr(
        builder.skills,
        "search_external_skills",
        lambda text, limit=5: [
            {
                "name": "k8s-release",
                "title": "K8s Release",
                "description": "Deploy Kubernetes apps with Helm and ArgoCD.",
                "category": "DevOps",
                "url": "https://github.com/openclaw/skills/tree/main/skills/k8s-release",
            }
        ],
    )

    messages = builder.build_messages(
        history=[],
        current_message="Design a Kubernetes deployment pipeline with Helm and ArgoCD.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "# External Skill Suggestions" in prompt
    assert "k8s-release" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert routing["selected"] == []
    assert routing["externalSuggestions"][0]["name"] == "k8s-release"


def test_runtime_tool_availability_filters_auto_injected_skills(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"market_snapshot"})

    messages = builder.build_messages(
        history=[],
        current_message="Analyze NVDA swing setup, include catalysts and risk checklist.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-report" not in prompt
    assert "### Skill: risk-checklist" not in prompt
    assert "### Skill: catalyst-tracker" not in prompt
    assert "# Skill Routing Diagnostics" in prompt
    assert "- market-report: blocked (auto)" in prompt
    assert "reason: missing tools: market_signal" in prompt
    assert "Tool: market_signal" in prompt
    assert "Tool: market_news" in prompt
    routing = builder.get_last_skill_routing()
    assert routing is not None
    assert any(item["name"] == "market-report" for item in routing["blocked"])
    assert any("missing tools: market_signal" in reason for item in routing["blocked"] for reason in item["reasons"])


def test_runtime_market_profile_filters_us_analysis_when_quotes_are_a_share_only(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"market_snapshot", "market_signal", "market_news", "market_macro", "market_event_extract"})
    builder.set_market_runtime_profile(build_market_runtime_profile(MarketToolsConfig(quote_source="eastmoney")))

    messages = builder.build_messages(
        history=[],
        current_message="Analyze AAPL swing setup, include catalysts and risk checklist.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-report" not in prompt
    assert "### Skill: risk-checklist" not in prompt
    assert "### Skill: catalyst-tracker" in prompt
    assert "runtime market coverage mismatch: market_snapshot supports a-share; request=us" in prompt


def test_chart_and_monitor_messages_auto_inject_tool_skills(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    chart_messages = builder.build_messages(
        history=[],
        current_message="Show a BTC-USD RSI chart and MACD setup.",
        channel="cli",
        chat_id="direct",
    )
    monitor_messages = builder.build_messages(
        history=[],
        current_message="Monitor gold, silver, BTC and ETH for me.",
        channel="cli",
        chat_id="direct",
    )

    assert "### Skill: stock-info-explorer" in chart_messages[0]["content"]
    assert "### Skill: crypto-gold-monitor" in monitor_messages[0]["content"]


def test_equity_analysis_prefers_equity_skills_without_monitor_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Analyze AAPL earnings setup and map support, resistance, and risk.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-report" in prompt
    assert "### Skill: catalyst-tracker" in prompt
    assert "### Skill: risk-checklist" in prompt
    assert "### Skill: stock-info-explorer" in prompt
    assert "### Skill: crypto-gold-monitor" not in prompt
    assert "### Skill: portfolio-analyzer" not in prompt


def test_crypto_analysis_uses_chart_and_risk_skills_without_metals_monitor(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Analyze BTC-USD swing trade with RSI, MACD, stop loss, and invalidation.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-report" in prompt
    assert "### Skill: risk-checklist" in prompt
    assert "### Skill: stock-info-explorer" in prompt
    assert "### Skill: crypto-gold-monitor" not in prompt


def test_metals_macro_monitor_prefers_monitor_and_catalyst_skills(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="Monitor gold and silver into FOMC and CPI this week.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: crypto-gold-monitor" in prompt
    assert "### Skill: catalyst-tracker" in prompt
    assert "### Skill: stock-info-explorer" not in prompt


def test_data_source_message_auto_injects_stock_data_sourcing(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="分析 A股 和 美股 数据源选择，比较 tushare、akshare、yfinance 和新闻源回退链路。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: stock-data-sourcing" in prompt


def test_metadata_driven_monitor_and_portfolio_skills_are_injected(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    monitor_messages = builder.build_messages(
        history=[],
        current_message="Give me a market summary and surveillance overview for today.",
        channel="cli",
        chat_id="direct",
    )
    portfolio_messages = builder.build_messages(
        history=[],
        current_message="Analyze my portfolio allocation and diversification risk.",
        channel="cli",
        chat_id="direct",
    )

    assert "### Skill: market-monitor" in monitor_messages[0]["content"]
    assert "### Skill: portfolio-analyzer" in portfolio_messages[0]["content"]


def test_chinese_market_opportunity_message_injects_market_discovery(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="分析今日股票市场机会，给出美股、港股、A股值得关注的主题和代码。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-discovery" in prompt
    assert "### Skill: stock-data-sourcing" not in prompt
    assert "do not reuse stale provider failures" in prompt.lower()
    assert "do not mention provider names" in prompt.lower()


def test_general_message_does_not_crash_skill_routing(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="你好",
        channel="cli",
        chat_id="direct",
    )

    assert messages[0]["role"] == "system"
    assert messages[-1]["role"] == "user"


def test_etf_opportunity_message_can_route_market_discovery(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="分析今天ETF市场机会，重点看 SPY 和纳斯达克ETF。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: market-discovery" in prompt


def test_daily_opportunity_shortcut_routes_fixed_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="每日机会",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: daily-market-opportunity" in prompt
    assert "### Skill: market-discovery" not in prompt


def test_daily_opportunity_meta_query_does_not_route_fixed_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="每日机会保存地址在哪",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: daily-market-opportunity" not in prompt


def test_bb_browser_multi_llm_prompt_prefers_multi_llm_stock_panel(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="使用bb-browser打开Gemini、ChatGPT、Grok，分析美股港股未来一个月内大幅上涨的股票并综合总结",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: multi-llm-stock-panel" in prompt
    assert "### Skill: stock-info-explorer" not in prompt


def test_live_market_request_drops_stale_history(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    history = [
        {"role": "assistant", "content": "A股数据不可用 due to Yahoo 429."},
        {"role": "user", "content": "记住这个结论。"},
    ]

    messages = builder.build_messages(
        history=history,
        current_message="分析今日股票市场机会，给出美股、港股、A股的方向。",
        channel="cli",
        chat_id="direct",
    )

    assert len(messages) == 2
    assert messages[1]["role"] == "user"


def test_broad_market_scan_omits_memory_context(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    memory_dir = workspace / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    (memory_dir / "MEMORY.md").write_text("User holdings: NVDA, 07709, 513310", encoding="utf-8")
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="分析今日全市场机会，给出美股、港股、A股值得关注的方向。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "# Memory (" not in prompt
    assert "User holdings: NVDA, 07709, 513310" not in prompt
    assert "### Skill: daily-stock-screener" not in prompt
    assert "### Skill: stock-data-sourcing" not in prompt


def test_portfolio_request_keeps_memory_context(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    memory_dir = workspace / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    (memory_dir / "MEMORY.md").write_text("User holdings: NVDA, 07709, 513310", encoding="utf-8")
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="根据我的持仓分析今日机会。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "# Memory (" in prompt
    assert "User holdings: NVDA, 07709, 513310" in prompt


def test_specialist_earnings_skill_shadows_auto_market_report(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools(
        {"market_snapshot", "market_news", "market_event_extract", "market_fundamentals", "market_signal"}
    )

    messages = builder.build_messages(
        history=[],
        current_message="Analyze NVDA earnings results and guidance after the quarterly report.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: earnings-readout" in prompt
    assert "### Skill: market-report" not in prompt


def test_specialist_options_skill_shadows_auto_market_report(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"market_snapshot"})

    messages = builder.build_messages(
        history=[],
        current_message="Show the payoff curve and breakeven for this iron condor on SPY.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: options-payoff" in prompt
    assert "### Skill: market-report" not in prompt


def test_browser_research_message_auto_injects_xueqiu_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Use Xueqiu hot stock discussion heat to assess this A-share setup.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: xueqiu-research" in prompt


def test_browser_research_message_auto_injects_eastmoney_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check Eastmoney and 股吧 live context for this A-share name.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: eastmoney-live" in prompt


def test_browser_social_message_auto_injects_social_signal_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check discussion heat and retail attention across forum pages for this ticker.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: social-signal-browser" in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_browser_reddit_message_auto_injects_reddit_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Search Reddit and wallstreetbets discussion for this stock.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: reddit-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_browser_youtube_message_auto_injects_transcript_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Pull the YouTube transcript from this market interview video.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: youtube-transcript-browser" in prompt


def test_browser_youtube_interview_message_auto_injects_transcript_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Pull the YouTube interview transcript and summarize the claims.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: youtube-transcript-browser" in prompt


def test_browser_github_message_auto_injects_github_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Use GitHub issue and repo context to research this project.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: github-browser-research" in prompt


def test_browser_zhihu_message_auto_injects_zhihu_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check Zhihu heat and narrative framing for this China theme.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: zhihu-browser-research" in prompt


def test_browser_news_verifier_message_auto_injects_verifier_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Cross-check this headline and verify news source consistency.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: browser-news-verifier" in prompt
    assert "### Skill: news-intelligence" not in prompt


def test_browser_weibo_message_auto_injects_weibo_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check Weibo topic heat around this market event.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: weibo-browser-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_browser_bilibili_message_auto_injects_bilibili_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Look at B站 creator discussion and comments for this theme.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: bilibili-browser-research" in prompt


def test_browser_xiaohongshu_message_auto_injects_xiaohongshu_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"xiaohongshu_cli"})

    messages = builder.build_messages(
        history=[],
        current_message="Check 小红书 consumer sentiment and note heat for this brand.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: xiaohongshu-browser-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_publish_xiaohongshu_message_auto_injects_publisher_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"xiaohongshu_cli"})

    messages = builder.build_messages(
        history=[],
        current_message="请直接发送小红书，标题是测试标题，正文是测试正文。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: xiaohongshu-publisher" in prompt
    assert "### Skill: xiaohongshu-browser-research" not in prompt


def test_browser_twitter_message_auto_injects_twitter_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Search Twitter thread discussion and FinTwit commentary for this ticker.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: twitter-browser-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_twitter_cli_message_auto_injects_twitter_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"twitter_cli"})

    messages = builder.build_messages(
        history=[],
        current_message="Search Twitter thread discussion and FinTwit commentary for this ticker.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: twitter-browser-research" in prompt


def test_publish_twitter_message_auto_injects_publisher_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"twitter_cli"})

    messages = builder.build_messages(
        history=[],
        current_message="Please post to Twitter: NVDA demand still looks strong.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: twitter-publisher" in prompt
    assert "### Skill: twitter-browser-research" not in prompt


def test_publish_twitter_message_with_xiaohongshu_content_still_injects_twitter_publisher(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"twitter_cli", "xiaohongshu_cli"})

    messages = builder.build_messages(
        history=[],
        current_message=(
            "发布一条推特，大概内容如下：\n\n"
            "MarketBot + 小红书 CLI\n"
            "总结：高价值场景聚焦"
        ),
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: twitter-publisher" in prompt
    assert "### Skill: xiaohongshu-browser-research" not in prompt


def test_browser_x_thread_message_auto_injects_twitter_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Review this X thread and FinTwit reaction to the earnings guide.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: twitter-browser-research" in prompt


def test_browser_hackernews_message_auto_injects_hn_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check Hacker News thread reaction to this AI product launch.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: hackernews-browser-research" in prompt


def test_browser_douban_message_auto_injects_douban_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check 豆瓣 rating and culture heat for this movie-related company.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: douban-browser-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_browser_linkedin_message_auto_injects_linkedin_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Use LinkedIn company page and hiring signal context for this firm.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: linkedin-browser-research" in prompt
    assert "### Skill: social-signal-browser" not in prompt
    assert "### Skill: sentiment-analysis" not in prompt


def test_browser_linkedin_hiring_signal_message_auto_injects_linkedin_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Check hiring signal and company page changes on LinkedIn for this startup.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: linkedin-browser-research" in prompt


def test_browser_stackoverflow_message_auto_injects_stackoverflow_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Search Stack Overflow for implementation friction around this API.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: stackoverflow-browser-research" in prompt


def test_browser_wikipedia_message_auto_injects_wikipedia_skill(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"browser_site"})

    messages = builder.build_messages(
        history=[],
        current_message="Get a Wikipedia summary and background research for this historical event.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: wikipedia-browser-research" in prompt


def test_runtime_tool_availability_allows_monitor_when_required_tools_exist(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"market_snapshot", "market_macro", "market_brief"})

    messages = builder.build_messages(
        history=[],
        current_message="Give me a market summary and surveillance overview for today.",
        channel="cli",
        chat_id="direct",
    )

    assert "### Skill: market-monitor" in messages[0]["content"]


def test_runtime_market_profile_filters_us_news_skill_when_provider_is_cn_only(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)
    builder.set_available_tools({"market_news", "market_event_extract", "market_macro"})
    cfg = MarketToolsConfig()
    cfg.news_sources = ["bocha"]
    cfg.bocha_api_key = "bocha-key"
    builder.set_market_runtime_profile(build_market_runtime_profile(cfg))

    messages = builder.build_messages(
        history=[],
        current_message="Analyze AAPL headline impact and media narrative.",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: news-intelligence" not in prompt
    assert "runtime market coverage mismatch: market_news supports a-share, hong-kong, mixed; request=us" in prompt


def test_source_routing_message_uses_structured_skill_metadata(tmp_path) -> None:
    workspace = _make_workspace(tmp_path)
    builder = ContextBuilder(workspace)

    messages = builder.build_messages(
        history=[],
        current_message="分析 A股 600519 和 美股 NVDA 的数据源覆盖与 fallback 路由。",
        channel="cli",
        chat_id="direct",
    )

    prompt = messages[0]["content"]
    assert "### Skill: stock-data-sourcing" in prompt
    assert "### Skill: portfolio-analyzer" not in prompt

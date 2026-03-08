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

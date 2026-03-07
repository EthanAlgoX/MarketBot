"""Tests for cache-friendly prompt construction."""

from __future__ import annotations

from datetime import datetime as real_datetime
from pathlib import Path
import datetime as datetime_module

from marketbot.agent.context import ContextBuilder


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

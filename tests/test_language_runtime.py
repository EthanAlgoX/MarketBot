"""Language policies must change presentation without altering financial facts."""

import asyncio
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from marketbot.agent.context import ContextBuilder
from marketbot.agent.loop import AgentLoop
from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.domain.intel.digest import render_digest_markdown
from marketbot.domain.intel.models import IntelRawItem
from marketbot.market_reporting import (
    render_chat_explainability_footer_for_channel,
    render_market_report_document,
    render_market_report_notification,
)


@pytest.mark.parametrize("language,name", [("en", "English"), ("zh", "Simplified Chinese")])
def test_language_policy_keeps_user_input_and_custom_workspace(tmp_path, language, name):
    custom = "# Custom rules\nPreserve this user rule: 持仓 600519, cost 123.45 CNY.\n"
    path = tmp_path / "AGENTS.md"
    path.write_text(custom, encoding="utf-8")
    builder = ContextBuilder(tmp_path, language=language)
    request = "请研究 600519，并引用原文。"
    messages = builder.build_messages(history=[], current_message=request)
    system = messages[0]["content"]
    assert f"Default response language: {name} ({language})" in system
    assert "Honor an explicit user request to use another language" in system
    assert "Do not infer a different default solely" in system
    assert custom in system
    assert messages[-1]["content"].startswith(request)
    assert path.read_text(encoding="utf-8") == custom


def test_agent_bootstrap_propagates_language_to_tools_and_subagents(tmp_path):
    provider = SimpleNamespace(get_default_model=lambda: "local-fixture")
    agent = AgentLoop(bus=MessageBus(), provider=provider, workspace=tmp_path, language="zh")
    assert (
        "Default response language: Simplified Chinese (zh)" in agent.context.build_system_prompt()
    )
    assert (
        "Default response language: Simplified Chinese (zh)"
        in agent.subagents._build_subagent_prompt()
    )
    brief = agent.tools.get("market_brief")
    assert brief._tool.language == "zh"


@pytest.mark.asyncio
async def test_agent_request_language_override_restores_default_between_turns(tmp_path):
    from marketbot.agent.response_language import effective_response_language

    agent = AgentLoop.__new__(AgentLoop)
    agent._turn_lock = asyncio.Lock()
    agent.language = "en"
    received = []

    async def local_turn(message, session_key, on_progress):
        received.append(effective_response_language(agent.language))
        response = agent._append_saved_report_path("Original content", tmp_path / "report.md")
        await asyncio.sleep(0)
        return OutboundMessage(channel=message.channel, chat_id=message.chat_id, content=response)

    agent._process_message_unlocked = local_turn
    chinese = await agent._process_message(
        InboundMessage(channel="cli", sender_id="user", chat_id="one", content="请用中文回答")
    )
    english = await agent._process_message(
        InboundMessage(channel="cli", sender_id="user", chat_id="two", content="请分析这个投资组合")
    )
    assert "已保存到本地" in chinese.content
    assert "Saved locally" in english.content
    assert received == ["zh", "en"]
    assert agent.language == "en"
    assert effective_response_language(agent.language) == "en"


@pytest.mark.parametrize("language,title", [("en", "Market Report"), ("zh", "市场研究报告")])
def test_report_and_notifications_localize_labels_but_preserve_evidence(language, title):
    payload = {
        "asOf": "2026-10-02T14:00:00Z",
        "marketState": "neutral",
        "marketSentimentIndex": 0.55,
        "macro": {"regime": "unknown", "macroRisk": 0.50},
        "snapshot": {"warnings": ["Source warning 原始文本: delayed quote"]},
        "news": {
            "items": [{"title": "Original 标题 123.45 CNY", "url": "https://example.com/fact"}]
        },
        "signals": [{"symbol": "600519", "action": "watch", "confidence": 0.58, "score": 0.25}],
        "evidenceRecordId": "ev_original_123",
        "dataReliability": {
            "overallStatus": "fallback",
            "components": {"news": {"status": "missing"}},
        },
        "skillRouting": {"selected": [{"name": "market-report"}]},
    }
    original = deepcopy(payload)
    doc = render_market_report_document(
        payload,
        symbols=["600519"],
        headline="原始催化事件",
        session="intraday",
        timezone_name="Asia/Shanghai",
        language=language,
    )
    assert doc.startswith(f"# {title}\n")
    assert "risk=0.50" not in doc
    assert ("非观测数据" if language == "zh" else "not observed data") in doc
    for fact in (
        "600519",
        "123.45 CNY",
        "https://example.com/fact",
        "ev_original_123",
        "0.58",
        "2026-10-02T14:00:00Z",
        "Source warning 原始文本: delayed quote",
        "原始催化事件",
    ):
        assert fact in doc
    for channel in ("slack", "telegram", "generic"):
        text = render_market_report_notification(
            payload,
            symbols=["600519"],
            session="intraday",
            timezone_name="Asia/Shanghai",
            report_path=Path("/tmp/report.md"),
            channel=channel,
            language=language,
        )
        assert ("市场报告提醒" if language == "zh" else "Market Report Alert") in text
        assert "600519: WATCH (0.58)" in text
        assert "report.md" in text
        assert "risk=0.50" not in text
        footer = render_chat_explainability_footer_for_channel(
            payload, channel=channel, language=language
        )
        assert ("能力与数据" if language == "zh" else "Capability & Data") in footer
        assert "market-report" in footer and "fallback" in footer
    assert payload == original


def test_missing_report_metrics_remain_unavailable_instead_of_zero():
    text = render_market_report_notification(
        {},
        symbols=["SPY"],
        session="intraday",
        timezone_name="UTC",
        report_path=Path("/tmp/report.md"),
    )
    assert "Market Sentiment Index: unavailable" in text
    assert "risk=0.50" not in text


@pytest.mark.parametrize("language,heading", [("en", "Top Items"), ("zh", "主要条目")])
def test_digest_preserves_titles_and_sources_across_languages(language, heading):
    item = IntelRawItem(
        title="原始公告 AAPL",
        summary_text="Original evidence 123.45 USD",
        url="https://example.com/source",
        quality_score=8.5,
    )
    text = render_digest_markdown(
        title="Custom Title",
        items=[item],
        window_start="2026-10-01T00:00:00Z",
        window_end="2026-10-02T00:00:00Z",
        language=language,
    )
    assert f"## {heading}" in text
    for fact in (item.title, item.summary_text, item.url, "8.5", "2026-10-01T00:00:00Z"):
        assert fact in text
    assert item.title == "原始公告 AAPL"

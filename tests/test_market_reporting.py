from datetime import datetime
from zoneinfo import ZoneInfo

from pathlib import Path

from marketbot.market_reporting import (
    extract_market_heartbeat_spec,
    infer_market_report_session,
    render_analysis_explainability,
    render_analysis_explainability_summary,
    render_chat_explainability_footer,
    render_chat_explainability_footer_for_channel,
    render_market_report_notification,
    render_market_report_document,
)


def test_infer_market_report_session_distinguishes_intraday_windows() -> None:
    tz = ZoneInfo("America/New_York")

    assert infer_market_report_session(datetime(2026, 3, 9, 8, 45, tzinfo=tz)) == "premarket"
    assert infer_market_report_session(datetime(2026, 3, 9, 10, 15, tzinfo=tz)) == "intraday"
    assert infer_market_report_session(datetime(2026, 3, 9, 16, 30, tzinfo=tz)) == "close"


def test_extract_market_heartbeat_spec_parses_directives() -> None:
    content = """
<!-- marketbot:mode market-report -->
<!-- marketbot:timezone America/New_York -->
<!-- marketbot:symbols NVDA,SPY -->
"""

    spec = extract_market_heartbeat_spec(
        content,
        now=datetime(2026, 3, 9, 8, 55, tzinfo=ZoneInfo("America/New_York")),
    )

    assert spec is not None
    assert spec["mode"] == "market-report"
    assert spec["symbols"] == ["NVDA", "SPY"]
    assert spec["timezone"] == "America/New_York"
    assert spec["session"] == "premarket"
    assert spec["marketRoute"]["primary"] == "equity"
    assert "NVDA, SPY" in str(spec["task"])


def test_extract_market_heartbeat_spec_supports_legacy_active_symbols_line() -> None:
    content = """
# Market Report Tasks
<!-- marketbot:timezone America/New_York -->
Active symbols: QQQ, IWM, GLD
"""

    spec = extract_market_heartbeat_spec(
        content,
        now=datetime(2026, 3, 9, 15, 0, tzinfo=ZoneInfo("America/New_York")),
    )

    assert spec is not None
    assert spec["symbols"] == ["QQQ", "IWM", "GLD"]
    assert spec["session"] == "intraday"


def test_render_market_report_notification_includes_summary_and_path() -> None:
    payload = {
        "marketState": "bullish",
        "marketSentimentIndex": 0.68,
        "marketRoute": {"primary": "equity"},
        "macro": {"regime": "risk-on", "macroRisk": 0.29},
        "signals": [
            {"symbol": "NVDA", "action": "buy", "confidence": 0.84},
            {"symbol": "SPY", "action": "watch", "confidence": 0.57},
        ],
    }

    text = render_market_report_notification(
        payload,
        symbols=["NVDA", "SPY"],
        session="premarket",
        timezone_name="America/New_York",
        report_path=Path("/tmp/market_report_premarket.md"),
    )

    assert "# Market Report Alert (premarket)" in text
    assert "Market Focus: equity" in text
    assert "NVDA: BUY (0.84)" in text
    assert "Attachment: market_report_premarket.md" in text


def test_render_market_report_notification_uses_channel_specific_format() -> None:
    payload = {
        "marketState": "neutral",
        "marketSentimentIndex": 0.51,
        "marketRoute": {"primary": "equity"},
        "macro": {"regime": "neutral", "macroRisk": 0.44},
        "signals": [{"symbol": "QQQ", "action": "watch", "confidence": 0.58}],
    }

    slack_text = render_market_report_notification(
        payload,
        symbols=["QQQ"],
        session="intraday",
        timezone_name="America/New_York",
        report_path=Path("/tmp/market_report_intraday.md"),
        channel="slack",
    )
    telegram_text = render_market_report_notification(
        payload,
        symbols=["QQQ"],
        session="intraday",
        timezone_name="America/New_York",
        report_path=Path("/tmp/market_report_intraday.md"),
        channel="telegram",
    )

    assert slack_text.startswith("*Market Report Alert (intraday)*")
    assert telegram_text.startswith("Market Report Alert (intraday)")


def test_render_market_report_document_includes_market_focus() -> None:
    payload = {
        "asOf": "2026-03-07T01:23:45Z",
        "marketState": "neutral",
        "marketSentimentIndex": 0.55,
        "marketRoute": {"primary": "crypto"},
        "macro": {"regime": "neutral", "macroRisk": 0.41, "warnings": []},
        "social": {"overallSentiment": 0.12, "perSymbol": [], "warnings": []},
        "signals": [],
        "scenarios": {},
        "snapshot": {"warnings": []},
        "news": {"items": [], "warnings": []},
    }

    doc = render_market_report_document(
        payload,
        symbols=["BTC-USD"],
        headline="",
        session="intraday",
        timezone_name="America/New_York",
    )

    assert "- Market Focus: crypto" in doc


def test_render_market_report_document_includes_explainability_notes() -> None:
    payload = {
        "asOf": "2026-03-07T01:23:45Z",
        "marketState": "bullish",
        "marketSentimentIndex": 0.67,
        "marketRoute": {"primary": "equity"},
        "macro": {"regime": "risk-on", "macroRisk": 0.31, "warnings": []},
        "social": {"overallSentiment": 0.22, "perSymbol": [], "warnings": []},
        "signals": [],
        "scenarios": {},
        "snapshot": {"warnings": []},
        "news": {"items": [], "warnings": []},
        "dataReliability": {
            "overallStatus": "fallback",
            "components": {
                "snapshot": {"status": "ok", "sourceHealth": {"mock": {"status": "ok"}}},
                "news": {"status": "fallback", "sourceHealth": {"mock": {"status": "fallback"}}},
                "macro": {"status": "ok", "sourceHealth": {"manual": {"status": "ok"}}},
            },
        },
    }
    skill_routing = {
        "requestProfile": {"markets": ["us"], "asset_classes": ["equity"]},
        "selected": [{"name": "market-report"}],
        "blocked": [{"name": "risk-checklist", "reasons": ["missing tools: market_signal"]}],
    }

    doc = render_market_report_document(
        payload,
        symbols=["NVDA"],
        headline="",
        session="intraday",
        timezone_name="America/New_York",
        skill_routing=skill_routing,
    )

    assert "## Capability & Data Notes" in doc
    assert "Selected Skills: market-report" in doc
    assert "Blocked Skill: risk-checklist | missing tools: market_signal" in doc
    assert "Data Reliability: fallback" in doc
    assert "News Coverage: mock=fallback" in doc


def test_render_market_report_notification_includes_explainability_summary() -> None:
    payload = {
        "marketState": "bullish",
        "marketSentimentIndex": 0.68,
        "marketRoute": {"primary": "equity"},
        "macro": {"regime": "risk-on", "macroRisk": 0.29},
        "signals": [{"symbol": "NVDA", "action": "buy", "confidence": 0.84}],
        "dataReliability": {"overallStatus": "ok"},
    }
    skill_routing = {"selected": [{"name": "market-report"}, {"name": "catalyst-tracker"}]}

    text = render_market_report_notification(
        payload,
        symbols=["NVDA"],
        session="premarket",
        timezone_name="America/New_York",
        report_path=Path("/tmp/market_report_premarket.md"),
        skill_routing=skill_routing,
    )

    assert "Skills: market-report, catalyst-tracker | Reliability: ok" in text


def test_render_analysis_explainability_helpers_are_stable() -> None:
    payload = {"dataReliability": {"overallStatus": "ok", "components": {}}}
    skill_routing = {"selected": [{"name": "market-report"}], "blocked": []}

    block = render_analysis_explainability(payload, skill_routing=skill_routing)
    summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing)
    footer = render_chat_explainability_footer(payload, skill_routing=skill_routing)

    assert "Selected Skills: market-report" in block
    assert summary == "Skills: market-report | Reliability: ok"
    assert "## Capability & Data Notes" in footer
    assert "Skills used: market-report" in footer


def test_render_analysis_explainability_helpers_include_fallback_summary() -> None:
    payload = {"dataReliability": {"overallStatus": "ok", "components": {}}}
    skill_routing = {
        "selected": [{"name": "social-signal-browser"}],
        "blocked": [],
        "fallbackExecution": {
            "used": True,
            "primarySkill": "xueqiu-research",
            "selectedFallback": "social-signal-browser",
            "finalSkill": "social-signal-browser",
        },
    }

    block = render_analysis_explainability(payload, skill_routing=skill_routing)
    summary = render_analysis_explainability_summary(payload, skill_routing=skill_routing)
    footer = render_chat_explainability_footer(payload, skill_routing=skill_routing)

    assert "Skill Fallback: xueqiu-research -> social-signal-browser" in block
    assert summary == "Skills: social-signal-browser | Fallback: xueqiu-research->social-signal-browser | Reliability: ok"
    assert "Fallback: xueqiu-research->social-signal-browser" in footer


def test_render_chat_explainability_footer_is_channel_aware() -> None:
    payload = {"dataReliability": {"overallStatus": "ok", "components": {}}}
    skill_routing = {"selected": [{"name": "market-report"}, {"name": "catalyst-tracker"}], "blocked": []}

    generic = render_chat_explainability_footer_for_channel(payload, skill_routing=skill_routing, channel="cli")
    telegram = render_chat_explainability_footer_for_channel(payload, skill_routing=skill_routing, channel="telegram")

    assert "## Capability & Data Notes" in generic
    assert telegram == "_Capability & Data_: Skills: market-report, catalyst-tracker | Reliability: ok"


def test_render_chat_explainability_footer_respects_explicit_mode() -> None:
    payload = {"dataReliability": {"overallStatus": "ok", "components": {}}}
    skill_routing = {"selected": [{"name": "market-report"}, {"name": "catalyst-tracker"}], "blocked": []}

    full = render_chat_explainability_footer_for_channel(
        payload,
        skill_routing=skill_routing,
        channel="telegram",
        mode="full",
    )
    summary = render_chat_explainability_footer_for_channel(
        payload,
        skill_routing=skill_routing,
        channel="cli",
        mode="summary",
    )
    disabled = render_chat_explainability_footer_for_channel(
        payload,
        skill_routing=skill_routing,
        channel="cli",
        mode="off",
    )

    assert "## Capability & Data Notes" in full
    assert "Skills used: market-report, catalyst-tracker" in full
    assert summary == "_Capability & Data_: Skills: market-report, catalyst-tracker | Reliability: ok"
    assert disabled == ""

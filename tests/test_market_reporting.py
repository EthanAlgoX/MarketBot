from datetime import datetime
from zoneinfo import ZoneInfo

from pathlib import Path

from marketbot.market_reporting import (
    extract_market_heartbeat_spec,
    infer_market_report_session,
    render_market_report_notification,
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
    assert "NVDA: BUY (0.84)" in text
    assert "Attachment: market_report_premarket.md" in text


def test_render_market_report_notification_uses_channel_specific_format() -> None:
    payload = {
        "marketState": "neutral",
        "marketSentimentIndex": 0.51,
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

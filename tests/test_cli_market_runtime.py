from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import typer

from marketbot.cli.market_runtime import normalize_market_report_session, run_market_report


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="") -> None:
        self.lines.append(str(text))

    def print_json(self, data=None) -> None:
        self.lines.append(str(data))


def test_normalize_market_report_session_rejects_invalid_value() -> None:
    with pytest.raises(typer.BadParameter):
        normalize_market_report_session("overnight")


def test_run_market_report_sends_notification_with_saved_report(tmp_path) -> None:
    console = _Console()
    send_mock = AsyncMock()
    config = SimpleNamespace(
        workspace_path=tmp_path,
        tools=SimpleNamespace(
            market=SimpleNamespace(default_symbols=["NVDA"]),
        ),
    )
    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "marketState": "bullish",
        "signals": [{"symbol": "NVDA", "action": "buy"}],
        "macro": {"regime": "risk-on", "macroRisk": 0.2},
    }

    class _Tool:
        async def execute(self, **kwargs):
            return (
                '{"briefMarkdown":"## Market Brief\\n\\n- NVDA: BUY",'
                '"marketState":"bullish","signals":[{"symbol":"NVDA","action":"buy"}],'
                '"macro":{"regime":"risk-on","macroRisk":0.2}}'
            )

    def _default_report_path(workspace: Path, session: str, timezone: str) -> Path:
        return workspace / "reports" / f"market_report_{session}_{timezone.replace('/', '_')}.md"

    run_market_report(
        config=config,
        symbols="NVDA",
        headline="",
        body="",
        timezone="America/New_York",
        session="premarket",
        json_output=False,
        save=False,
        notify=True,
        notify_channel="telegram",
        chat_id="10001",
        console=console,
        parse_symbol_csv=lambda raw: [item for item in raw.split(",") if item],
        pick_notify_target=lambda *_args, **_kwargs: ("telegram", "10001"),
        send_message_once=send_mock,
        market_brief_tool_factory=lambda _cfg: _Tool(),
        infer_market_report_session=lambda _dt: "intraday",
        resolve_market_timezone=lambda _tz: None,
        render_market_report_document=lambda *_args, **_kwargs: "# Market Report",
        default_market_report_path=_default_report_path,
        render_market_report_notification=lambda *_args, **_kwargs: "Market Report Alert",
    )

    report_path = tmp_path / "reports" / "market_report_premarket_America_New_York.md"
    assert report_path.exists()
    send_mock.assert_awaited_once()
    assert send_mock.await_args.args[1] == "telegram"
    assert send_mock.await_args.args[2] == "10001"
    assert send_mock.await_args.args[3] == "Market Report Alert"
    assert send_mock.await_args.args[4] == [str(report_path)]
    assert any("Sent report to telegram:10001" in line for line in console.lines)
    assert any("No market brief generated." not in line for line in console.lines)

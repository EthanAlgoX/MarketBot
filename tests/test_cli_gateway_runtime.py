import asyncio
from pathlib import Path

from marketbot.cli.gateway_runtime import (
    create_heartbeat_notify_handler,
    pick_heartbeat_target,
    run_gateway_services,
)


def test_pick_heartbeat_target_prefers_recent_external_enabled_session() -> None:
    class _Channels:
        enabled_channels = ["telegram"]

    class _Sessions:
        @staticmethod
        def list_sessions():
            return [
                {"key": "cli:direct"},
                {"key": "telegram:chat-123"},
            ]

    assert pick_heartbeat_target(channels=_Channels(), session_manager=_Sessions()) == ("telegram", "chat-123")


def test_pick_heartbeat_target_falls_back_to_cli_direct() -> None:
    class _Channels:
        enabled_channels = []

    class _Sessions:
        @staticmethod
        def list_sessions():
            return [{"key": "cli:direct"}]

    assert pick_heartbeat_target(channels=_Channels(), session_manager=_Sessions()) == ("cli", "direct")


def test_create_heartbeat_notify_handler_publishes_market_report_summary(tmp_path) -> None:
    published = []
    report_path = tmp_path / "report.md"
    report_path.write_text("ok", encoding="utf-8")

    class _Bus:
        @staticmethod
        async def publish_outbound(msg):
            published.append(msg)

    handler = create_heartbeat_notify_handler(
        bus=_Bus(),
        heartbeat_delivery={
            "kind": "market-report",
            "payload": {"marketState": "bullish"},
            "symbols": ["NVDA"],
            "session": "premarket",
            "timezone": "America/New_York",
            "report_path": str(report_path),
        },
        pick_target=lambda: ("telegram", "chat-1"),
        render_market_report_notification=lambda *args, **kwargs: "summary body",
    )

    asyncio.run(handler("ignored"))

    assert len(published) == 1
    assert published[0].channel == "telegram"
    assert published[0].chat_id == "chat-1"
    assert published[0].content == "summary body"
    assert published[0].media == [str(report_path)]
    assert published[0].metadata["market_report"]["session"] == "premarket"


def test_run_gateway_services_stops_everything_cleanly() -> None:
    events = []

    class _Agent:
        async def run(self):
            events.append("agent.run")
            await asyncio.sleep(0.01)

        async def close_mcp(self):
            events.append("agent.close_mcp")

        def stop(self):
            events.append("agent.stop")

    class _Channels:
        async def start_all(self):
            events.append("channels.start_all")
            await asyncio.sleep(0.01)

        async def stop_all(self):
            events.append("channels.stop_all")

    class _Cron:
        async def start(self):
            events.append("cron.start")

        def stop(self):
            events.append("cron.stop")

    class _Heartbeat:
        async def start(self):
            events.append("heartbeat.start")

        def stop(self):
            events.append("heartbeat.stop")

    class _Console:
        @staticmethod
        def print(_msg):
            events.append("console.print")

    asyncio.run(
        run_gateway_services(
            agent=_Agent(),
            channels=_Channels(),
            cron=_Cron(),
            heartbeat=_Heartbeat(),
            console=_Console(),
        )
    )

    assert events == [
        "cron.start",
        "heartbeat.start",
        "agent.run",
        "channels.start_all",
        "agent.close_mcp",
        "heartbeat.stop",
        "cron.stop",
        "agent.stop",
        "channels.stop_all",
    ]

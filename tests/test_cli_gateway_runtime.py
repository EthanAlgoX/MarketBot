import asyncio
from pathlib import Path

from marketbot.cli.gateway_runtime import (
    build_runtime_delivery_metadata,
    create_heartbeat_notify_handler,
    format_bus_runtime_summary,
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

        @staticmethod
        def stats():
            return {
                "inbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.5},
                "outbound": {"size": 0, "maxsize": 10, "published": 3, "publish_wait_s": 0.25},
            }

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
        session_manager=None,
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
    assert published[0].metadata["bus"]["inbound"]["published"] == 2


def test_create_heartbeat_notify_handler_attaches_bus_stats_for_plain_messages() -> None:
    published = []

    class _Bus:
        @staticmethod
        async def publish_outbound(msg):
            published.append(msg)

        @staticmethod
        def stats():
            return {
                "inbound": {"size": 0, "maxsize": 10, "published": 1, "publish_wait_s": 0.1},
                "outbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.2},
            }

    class _Sessions:
        @staticmethod
        def stats():
            return {"storedSessions": 2, "cachedSessions": 1, "cachedMessages": 5}

    handler = create_heartbeat_notify_handler(
        bus=_Bus(),
        heartbeat_delivery={},
        session_manager=_Sessions(),
        pick_target=lambda: ("telegram", "chat-1"),
        render_market_report_notification=lambda *args, **kwargs: "unused",
    )

    asyncio.run(handler("plain response"))

    assert len(published) == 1
    assert published[0].content == "plain response"
    assert published[0].metadata["bus"]["outbound"]["published"] == 2
    assert published[0].metadata["sessions"]["storedSessions"] == 2


def test_run_gateway_services_stops_everything_cleanly() -> None:
    events = []
    printed = []

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
        def print(msg):
            printed.append(msg)
            events.append("console.print")

    class _Bus:
        @staticmethod
        def stats():
            return {
                "inbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.5},
                "outbound": {"size": 0, "maxsize": 10, "published": 3, "publish_wait_s": 0.25},
            }

    asyncio.run(
        run_gateway_services(
            agent=_Agent(),
            bus=_Bus(),
            channels=_Channels(),
            cron=_Cron(),
            heartbeat=_Heartbeat(),
            console=_Console(),
        )
    )

    assert printed[0] == "[dim]Bus: in=1/10 published=2 wait=0.500s | out=0/10 published=3 wait=0.250s[/dim]"
    assert events == [
        "console.print",
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


def test_format_bus_runtime_summary_handles_missing_stats() -> None:
    assert format_bus_runtime_summary(None) == "Bus: unavailable"


def test_build_runtime_delivery_metadata_handles_missing_stats() -> None:
    assert build_runtime_delivery_metadata() == {}

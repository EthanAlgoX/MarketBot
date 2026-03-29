import asyncio

from marketbot.bus.events import InboundMessage, OutboundMessage
from marketbot.bus.queue import MessageBus


async def test_message_bus_stats_track_publish_counts() -> None:
    bus = MessageBus(inbound_maxsize=2, outbound_maxsize=3)

    await bus.publish_inbound(InboundMessage(channel="cli", sender_id="u", chat_id="c", content="hello"))
    await bus.publish_outbound(OutboundMessage(channel="cli", chat_id="c", content="world"))

    stats = bus.stats()

    assert stats["inbound"]["size"] == 1
    assert stats["inbound"]["maxsize"] == 2
    assert stats["inbound"]["published"] == 1
    assert stats["outbound"]["size"] == 1
    assert stats["outbound"]["maxsize"] == 3
    assert stats["outbound"]["published"] == 1


async def test_message_bus_publish_wait_time_increases_when_queue_is_full() -> None:
    bus = MessageBus(inbound_maxsize=1)
    await bus.publish_inbound(InboundMessage(channel="cli", sender_id="u", chat_id="c", content="first"))

    blocked = asyncio.create_task(
        bus.publish_inbound(InboundMessage(channel="cli", sender_id="u", chat_id="c", content="second"))
    )
    await asyncio.sleep(0.02)
    assert not blocked.done()

    consumed = await bus.consume_inbound()
    assert consumed.content == "first"
    await blocked

    stats = bus.stats()
    assert stats["inbound"]["published"] == 2
    assert stats["inbound"]["publish_wait_s"] > 0

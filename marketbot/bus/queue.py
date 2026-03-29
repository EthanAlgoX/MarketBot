"""Async message queue for decoupled channel-agent communication."""

import asyncio
import time
from typing import Any

from marketbot.bus.events import InboundMessage, OutboundMessage


class MessageBus:
    """
    Async message bus that decouples chat channels from the agent core.

    Channels push messages to the inbound queue, and the agent processes
    them and pushes responses to the outbound queue.
    """

    def __init__(self, *, inbound_maxsize: int = 1000, outbound_maxsize: int = 1000):
        self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue(maxsize=inbound_maxsize)
        self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue(maxsize=outbound_maxsize)
        self._publish_counts = {"inbound": 0, "outbound": 0}
        self._wait_time_s = {"inbound": 0.0, "outbound": 0.0}

    async def publish_inbound(self, msg: InboundMessage) -> None:
        """Publish a message from a channel to the agent."""
        started = time.perf_counter()
        await self.inbound.put(msg)
        self._wait_time_s["inbound"] += max(0.0, time.perf_counter() - started)
        self._publish_counts["inbound"] += 1

    async def consume_inbound(self) -> InboundMessage:
        """Consume the next inbound message (blocks until available)."""
        return await self.inbound.get()

    async def publish_outbound(self, msg: OutboundMessage) -> None:
        """Publish a response from the agent to channels."""
        started = time.perf_counter()
        await self.outbound.put(msg)
        self._wait_time_s["outbound"] += max(0.0, time.perf_counter() - started)
        self._publish_counts["outbound"] += 1

    async def consume_outbound(self) -> OutboundMessage:
        """Consume the next outbound message (blocks until available)."""
        return await self.outbound.get()

    @property
    def inbound_size(self) -> int:
        """Number of pending inbound messages."""
        return self.inbound.qsize()

    @property
    def outbound_size(self) -> int:
        """Number of pending outbound messages."""
        return self.outbound.qsize()

    def stats(self) -> dict[str, Any]:
        """Return queue sizes, capacity, and cumulative publish backpressure metrics."""
        return {
            "inbound": {
                "size": self.inbound.qsize(),
                "maxsize": self.inbound.maxsize,
                "published": self._publish_counts["inbound"],
                "publish_wait_s": self._wait_time_s["inbound"],
            },
            "outbound": {
                "size": self.outbound.qsize(),
                "maxsize": self.outbound.maxsize,
                "published": self._publish_counts["outbound"],
                "publish_wait_s": self._wait_time_s["outbound"],
            },
        }

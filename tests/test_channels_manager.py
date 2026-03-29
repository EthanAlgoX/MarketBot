from __future__ import annotations

from types import SimpleNamespace

from marketbot.bus.queue import MessageBus
from marketbot.bus.events import OutboundMessage
from marketbot.channels.base import BaseChannel
from marketbot.channels.manager import ChannelManager
from marketbot.config.schema import Config


class _FakeChannel(BaseChannel):
    def __init__(self, config, bus, **kwargs):
        super().__init__(config, bus)
        self.extra_kwargs = kwargs

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False

    async def send(self, msg) -> None:
        return None


def test_channel_manager_initializes_enabled_channels_via_registry(monkeypatch) -> None:
    config = Config()
    config.channels.telegram.enabled = True
    config.channels.telegram.allow_from = ["*"]
    config.providers.groq.api_key = "groq-key"

    modules = {
        "marketbot.channels.telegram": SimpleNamespace(TelegramChannel=_FakeChannel),
    }

    monkeypatch.setattr(
        "marketbot.channels.manager.importlib.import_module",
        lambda module_name: modules[module_name],
    )

    manager = ChannelManager(config, MessageBus())

    channel = manager.channels["telegram"]
    assert isinstance(channel, _FakeChannel)
    assert channel.extra_kwargs == {"groq_api_key": "groq-key"}


def test_channel_manager_rejects_enabled_channel_with_empty_allow_list(monkeypatch) -> None:
    config = Config()
    config.channels.telegram.enabled = True

    monkeypatch.setattr(
        "marketbot.channels.manager.importlib.import_module",
        lambda module_name: SimpleNamespace(TelegramChannel=_FakeChannel),
    )

    try:
        ChannelManager(config, MessageBus())
    except SystemExit as exc:
        assert "empty allowFrom" in str(exc)
    else:  # pragma: no cover - defensive
        raise AssertionError("Expected ChannelManager to reject empty allow_from")


def test_base_channel_render_outbound_content_skips_publish_footer() -> None:
    channel = _FakeChannel(SimpleNamespace(allow_from=["*"]), MessageBus())

    text = channel.render_outbound_content(
        OutboundMessage(
            channel="feishu",
            chat_id="chat",
            content="推特发送失败：Twitter API error (HTTP 0): Tweet needs to be a bit shorter. (186)",
            metadata={
                "explainability": {
                    "delivery": "inline",
                    "inline_footer": "_Capability & Data_: Skills: xiaohongshu-browser-research",
                }
            },
        )
    )

    assert text == "推特发送失败：Twitter API error (HTTP 0): Tweet needs to be a bit shorter. (186)"

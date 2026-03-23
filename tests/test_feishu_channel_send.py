import asyncio
from unittest.mock import Mock

from marketbot.bus.events import OutboundMessage
from marketbot.channels.feishu import FeishuChannel


def test_split_text_fallback_chunks_preserves_content() -> None:
    text = "A" * 1600 + "\n" + "B" * 100

    chunks = FeishuChannel._split_text_fallback_chunks(text, chunk_size=1500)

    assert len(chunks) == 2
    assert "".join(chunk.replace("\n", "") for chunk in chunks) == text.replace("\n", "")


def test_feishu_send_falls_back_to_text_when_interactive_fails() -> None:
    channel = FeishuChannel.__new__(FeishuChannel)
    channel._client = object()
    channel.render_outbound_content = Mock(return_value="| A | B |\n|---|---|\n| 1 | 2 |")
    sent: list[tuple[str, str]] = []

    def fake_send(receive_id_type: str, receive_id: str, msg_type: str, content: str) -> bool:
        sent.append((msg_type, content))
        return msg_type == "text"

    channel._send_message_sync = fake_send
    channel._send_text_fallback_sync = FeishuChannel._send_text_fallback_sync.__get__(channel, FeishuChannel)
    channel._build_card_elements = Mock(return_value=[{"tag": "table", "columns": [], "rows": [], "page_size": 1}])
    channel._split_elements_by_table_limit = Mock(return_value=[[{"tag": "table", "columns": [], "rows": [], "page_size": 1}]])

    asyncio.run(channel.send(OutboundMessage(channel="feishu", chat_id="ou_test", content="ignored")))

    assert sent[0][0] == "interactive"
    assert any(msg_type == "text" for msg_type, _ in sent[1:])

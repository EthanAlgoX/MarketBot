from marketbot.agent.processor import MessageProcessor


def test_rewrite_sensitive_market_shortcuts_expands_daily_opportunity_prompt() -> None:
    rewritten = MessageProcessor.rewrite_sensitive_market_shortcuts("每日机会分析")

    assert rewritten != "每日机会分析"
    assert "今日市场机会扫描" in rewritten
    assert "公开市场数据" in rewritten
    assert "无高置信机会" in rewritten
    assert "market_snapshot" in rewritten
    assert "不要优先使用 exec" in rewritten
    assert "web_search" in rewritten
    assert "周末" in rewritten
    assert "直接输出最终答案" in rewritten


def test_rewrite_sensitive_market_shortcuts_maps_daily_opportunity_alias() -> None:
    rewritten = MessageProcessor.rewrite_sensitive_market_shortcuts("每日机会")

    assert rewritten != "每日机会"
    assert "今日市场机会扫描" in rewritten
    assert "market_news" in rewritten
    assert "尽量同时纳入 market_brief" in rewritten
    assert "不要把 <minimax:tool_call>" in rewritten
    assert "# 📅 每日机会扫描" in rewritten
    assert "不要输出 confidence=0.54" in rewritten
    assert "Watchlist 最多保留 2 个" in rewritten
    assert "FRED API Key" in rewritten


def test_rewrite_sensitive_market_shortcuts_keeps_unrelated_message() -> None:
    original = "hi"

    rewritten = MessageProcessor.rewrite_sensitive_market_shortcuts(original)

    assert rewritten == original


def test_build_messages_routes_daily_opportunity_using_original_message() -> None:
    captured: dict[str, object] = {}

    class _FakeContext:
        def build_messages(self, **kwargs):
            captured.update(kwargs)
            return [{"role": "system", "content": "ok"}]

        @staticmethod
        def get_last_skill_routing():
            return None

    class _FakeSession:
        metadata = {}

    processor = MessageProcessor.__new__(MessageProcessor)
    processor.context = _FakeContext()
    processor.get_recent_history = lambda session: []

    messages = MessageProcessor.build_messages(
        processor,
        session=_FakeSession(),
        current_message="每日机会",
        channel="cli",
        chat_id="direct",
    )

    assert messages == [{"role": "system", "content": "ok"}]
    assert captured["routing_message"] == "每日机会"
    assert captured["current_message"] != "每日机会"

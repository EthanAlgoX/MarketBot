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


def test_rewrite_sensitive_market_shortcuts_keeps_unrelated_message() -> None:
    original = "hi"

    rewritten = MessageProcessor.rewrite_sensitive_market_shortcuts(original)

    assert rewritten == original

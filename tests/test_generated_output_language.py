"""Language choices preserve user content, source text, and protocol identifiers."""

import json
from collections import OrderedDict
from pathlib import Path
from types import SimpleNamespace

import pytest

from marketbot.agent import request_policy, response_postprocess, tool_runtime
from marketbot.bus.queue import MessageBus
from marketbot.channels.base import BaseChannel
from marketbot.channels.feishu import FeishuChannel
from marketbot.config.schema import FeishuConfig


def _loop(language="en", **kwargs):
    return SimpleNamespace(
        language=language,
        _DAILY_OPPORTUNITY_SKILL="daily-market-opportunity",
        _selected_skill_names=lambda: ["daily-market-opportunity"],
        **kwargs,
    )


@pytest.mark.parametrize("language,title,section", [
    ("en", "# 📅 Daily Market Opportunity Scan", "## 3. Watchlist"),
    ("zh", "# 📅 每日机会扫描", "## 3. 观察名单"),
])
def test_daily_report_uses_selected_language_without_translating_content(language, title, section):
    original = "用户提供的原文: AAPL 0.02 USD; do not translate."
    report = request_policy.normalize_daily_opportunity_report(_loop(language), "# Existing title\n\n" + original)
    assert report.startswith(title)
    assert section in report and original in report
    fallback = request_policy.normalize_daily_opportunity_report(_loop(language), "<minimax:tool_call><invoke name='market_brief'/>")
    assert fallback.startswith(title) and section in fallback
    assert "<invoke" not in fallback
    assert ("No high-conviction setup" if language == "en" else "今日无高置信机会") in fallback


def test_daily_query_and_saved_notice_default_to_english_and_support_chinese(tmp_path):
    report_dir = tmp_path / "reports" / "daily-market-opportunity"
    report_dir.mkdir(parents=True)
    path = report_dir / "原始名称.md"
    path.write_text("original user content")
    for language, heading, saved in [("en", "Recent reports:", "Saved locally:"), ("zh", "最近文档:", "已保存到本地:")]:
        result = request_policy.build_daily_opportunity_report_query_response(_loop(language, workspace=tmp_path))
        assert heading in result and str(path) in result
        notice = response_postprocess.append_saved_report_path("原文 unchanged", path, language=language)
        assert notice.startswith("原文 unchanged") and saved in notice and str(path) in notice
        assert response_postprocess.append_saved_report_path(notice, path, language=language) == notice
    assert "Saved locally:" in response_postprocess.append_saved_report_path("report", Path("original.md"))


@pytest.mark.parametrize("language", ["en", "zh"])
def test_publish_status_keeps_ids_urls_and_third_party_errors(language):
    payload = json.dumps({"ok": True, "data": {"id": "literal-id", "url": "https://example.invalid/原文", "score": 2.5}})
    twitter = tool_runtime._format_twitter_publish_result(payload, language=language)
    note = tool_runtime._format_xiaohongshu_publish_result(payload, language=language)
    assert "literal-id" in twitter and "https://example.invalid/原文" in twitter
    assert "literal-id" in note and "2.5" in note
    assert response_postprocess.is_publish_result_message(twitter)
    assert response_postprocess.is_publish_result_message(note)
    assert ("posted successfully" if language == "en" else "已发送成功") in twitter
    detail = "Original API error: 保留原文 (186)"
    failure = tool_runtime._format_twitter_publish_result(json.dumps({"ok": False, "error": {"message": detail}}), language=language)
    assert failure.endswith(detail) and response_postprocess.is_publish_result_message(failure)


def test_research_headers_are_localized_but_sample_titles_are_preserved():
    title = "股票风险与仓位复盘 2026"
    payload = json.dumps({"ok": True, "data": {"notes": [{"title": title}], "engagement": {"sample_size": 1, "avg_likes": 42}}})
    english = tool_runtime._format_xiaohongshu_research_result("金融", payload)
    chinese = tool_runtime._format_xiaohongshu_research_result("金融", payload, language="zh")
    assert "Sample titles:" in english and "Sample size: 1" in english
    assert "样本标题：" in chinese and "样本量: 1" in chinese
    assert title in english and title in chinese
    assert "not an analysis of the full content" in english


def test_english_publish_content_header_keeps_supplied_chinese_body():
    original = "Original title\n说明如下但必须保持原文。\nUSD 0.02"
    tweet = tool_runtime._extract_twitter_publish_text("Tweet this. Content below:\n" + original)
    assert all(line in tweet for line in original.splitlines())
    assert "Content below:" not in tweet
    assert tool_runtime._extract_xiaohongshu_publish_payload("Post to Xiaohongshu. Content below:\n" + original) == ("Original title", "说明如下但必须保持原文。\nUSD 0.02")


@pytest.mark.parametrize("language,text,ack", [
    ("en", "用户原文 AAPL 0.02 USD", "Received. Analyzing your request; please wait."),
    ("zh", "用户原文 AAPL 0.02 USD", "已收到，正在分析，请稍等。"),
    ("en", "请以中文提供研究结论: AAPL 0.02 USD", "已收到，正在分析，请稍等。"),
    ("zh", "Please reply in English: AAPL 0.02 USD", "Received. Analyzing your request; please wait."),
])
@pytest.mark.asyncio
async def test_feishu_ack_uses_language_and_leaves_inbound_text_unchanged(language, text, ack):
    bus = MessageBus()
    channel = FeishuChannel.__new__(FeishuChannel)
    BaseChannel.__init__(channel, FeishuConfig(allow_from=["*"]), bus)
    channel.language = language
    channel._processed_message_ids = OrderedDict()
    sent = []

    async def reaction(*_args):
        pass

    channel._add_reaction = reaction
    channel._send_message_sync = lambda *_args: sent.append(json.loads(_args[-1]))
    event = SimpleNamespace(event=SimpleNamespace(
        message=SimpleNamespace(message_id="fixture", chat_id="oc_fixture", chat_type="p2p", message_type="text", content=json.dumps({"text": text})),
        sender=SimpleNamespace(sender_type="user", sender_id=SimpleNamespace(open_id="ou_fixture")),
    ))
    await channel._on_message(event)
    assert sent == [{"text": ack}]
    assert (await bus.consume_inbound()).content == text

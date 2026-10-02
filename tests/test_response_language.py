"""Explicit language choices are scoped and never inferred from input text."""

import asyncio
from types import SimpleNamespace

import pytest

from marketbot.agent.request_policy import normalize_daily_opportunity_report
from marketbot.agent.response_language import (
    effective_response_language,
    resolve_response_language,
    response_language_scope,
)
from marketbot.agent.response_postprocess import append_saved_report_path


@pytest.mark.parametrize("text,default,expected", [
    ("Please reply in Chinese.", "en", "zh"),
    ("Please respond in English.", "zh", "en"),
    ("请用中文写报告", "en", "zh"),
    ("请以中文提供研究结论", "en", "zh"),
    ("请用英语做这个报告", "zh", "en"),
    ("英文回答", "zh", "en"),
    ("请不要用中文回答", "en", "en"),
    ("请不要使用中文回复", "en", "en"),
    ("无需以英文回答", "zh", "zh"),
    ("别用英语回复", "zh", "zh"),
    ("Don't reply in Chinese.", "en", "en"),
    ("Do not use English for the report.", "zh", "zh"),
    ("Reply in Chinese. Actually, answer in English.", "zh", "en"),
    ("请用英文回复。最后请用中文回答。", "en", "zh"),
    ("研究一下 AAPL 的最新财报", "en", "en"),
    ("Research the latest AAPL earnings.", "zh", "zh"),
    ("Research Chinese equities and English-language disclosures.", "en", "en"),
    (None, "zh", "zh"),
])
def test_explicit_language_directives(text, default, expected):
    assert resolve_response_language(text, default) == expected


def test_nested_scope_and_exception_restore_configured_default():
    assert effective_response_language("zh") == "zh"
    with response_language_scope("Reply in Chinese.", "en") as selected:
        assert selected == "zh"
        assert effective_response_language("en") == "zh"
        with pytest.raises(ValueError), response_language_scope("Reply in English.", "zh"):
            assert effective_response_language("zh") == "en"
            raise ValueError("fixture exception")
        assert effective_response_language("en") == "zh"
    assert effective_response_language("en") == "en"


@pytest.mark.asyncio
async def test_concurrent_request_preferences_are_isolated():
    ready = [asyncio.Event(), asyncio.Event()]
    release = asyncio.Event()

    async def request(index, text, default):
        with response_language_scope(text, default):
            ready[index].set()
            await release.wait()
            await asyncio.sleep(0)
            return effective_response_language(default)

    tasks = [
        asyncio.create_task(request(0, "请用中文回答", "en")),
        asyncio.create_task(request(1, "Please reply in English.", "zh")),
    ]
    try:
        await asyncio.gather(*(event.wait() for event in ready))
        assert effective_response_language("en") == "en"
        release.set()
        assert await asyncio.gather(*tasks) == ["zh", "en"]
    finally:
        release.set()
        await asyncio.gather(*tasks, return_exceptions=True)
    assert effective_response_language("zh") == "zh"


def test_generated_report_and_notice_honor_request_over_configured_language(tmp_path):
    loop = SimpleNamespace(
        language="en",
        _DAILY_OPPORTUNITY_SKILL="daily-market-opportunity",
        _selected_skill_names=lambda: ["daily-market-opportunity"],
    )
    original = "Original source text 原始来源 AAPL 0.02 USD"
    with response_language_scope("请以中文提供研究结论", default="en"):
        result = normalize_daily_opportunity_report(loop, original)
        notice = append_saved_report_path(original, tmp_path / "report.md", language="en")
    assert result.startswith("# 📅 每日机会扫描") and original in result
    assert "已保存到本地:" in notice and original in notice
    assert normalize_daily_opportunity_report(loop, original).startswith("# 📅 Daily Market Opportunity Scan")

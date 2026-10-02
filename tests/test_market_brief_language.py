"""Bilingual brief rendering leaves finance inputs and calculations unchanged."""

import json
from datetime import UTC, datetime

import pytest

from marketbot.agent.response_language import response_language_scope
from marketbot.agent.tools import market as market_module
from marketbot.agent.tools.market import MarketBriefTool


class _FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 10, 3, 8, tzinfo=UTC).astimezone(tz)


def _fixture_tool(monkeypatch, *, language="en"):
    monkeypatch.setattr(market_module, "datetime", _FixedDateTime)
    tool = MarketBriefTool(language=language)

    async def snapshot(**_kwargs):
        return json.dumps({"asOf": "2026-10-03T08:00:00Z", "source": "fixture-source", "quotes": [{"symbol": "AAPL", "price": 0.2, "currency": "USD", "changePct": -0.5, "provider": "fixture-source", "observedAt": "2026-10-02T08:00:00Z", "retrievedAt": "2026-10-03T08:00:00Z"}], "warnings": ["Original warning 保持原文"]})

    async def signal(**_kwargs):
        return json.dumps({"action": "watch", "confidence": 0.64, "score": -0.21, "signalCard": "Original English Signal Card"})

    async def news(**_kwargs):
        return json.dumps({"items": [{"title": "原始新闻标题 without translation", "url": "https://example.invalid/source"}], "warnings": ["Provider error 保留原文"], "providerBySymbol": {"AAPL": "unavailable"}})

    async def macro(**_kwargs):
        return json.dumps({"regime": "unknown", "macroRisk": 0.5, "macroRiskDataStatus": "insufficient_data", "warnings": ["Original macro warning"]})

    monkeypatch.setattr(tool._snapshot, "execute", snapshot)
    monkeypatch.setattr(tool._signal, "execute", signal)
    monkeypatch.setattr(tool._news, "execute", news)
    monkeypatch.setattr(tool._macro, "execute", macro)
    return tool


@pytest.mark.asyncio
async def test_brief_language_only_changes_human_text(monkeypatch):
    tool = _fixture_tool(monkeypatch)
    kwargs = {"symbols": ["AAPL"], "includeSocial": False, "includeChips": False, "includeFundamentals": False, "includeIntelContext": False, "includeLogicChain": False}
    english = json.loads(await tool.execute(**kwargs))
    chinese = json.loads(await tool.execute(**kwargs, language="zh"))
    assert english["language"] == "en" and chinese["language"] == "zh"
    assert set(english) == set(chinese)
    for key in english.keys() - {"briefMarkdown", "language", "scenarios"}:
        assert english[key] == chinese[key], key
    assert "## Market Brief" in english["briefMarkdown"]
    assert "### Quote Observations" in english["briefMarkdown"]
    assert "macroRisk unavailable (0.50 is a neutral compatibility default)" in english["briefMarkdown"]
    assert "## 市场简报" in chinese["briefMarkdown"]
    assert "### 行情观察" in chinese["briefMarkdown"]
    assert "新鲜度=已过期" in chinese["briefMarkdown"]
    assert "0.50 仅为兼容性的中性默认值" in chinese["briefMarkdown"]
    assert "过期或时间未知的数据不能支持当前投资结论" in chinese["briefMarkdown"]
    assert chinese["signals"][0]["signalCard"] == "Original English Signal Card"
    assert chinese["news"]["items"][0]["title"] == "原始新闻标题 without translation"
    assert chinese["snapshot"]["warnings"] == ["Original warning 保持原文"]
    assert chinese["scenarios"]["aggressive"] == ["没有高置信做多机会"]


@pytest.mark.asyncio
async def test_brief_uses_constructor_language_and_allows_explicit_override(monkeypatch):
    tool = _fixture_tool(monkeypatch, language="zh")
    kwargs = {"symbols": [], "includeNews": False, "includeMacro": False, "includeSocial": False, "includeChips": False, "includeFundamentals": False, "includeIntelContext": False, "includeLogicChain": False}
    assert json.loads(await tool.execute(**kwargs))["briefMarkdown"].startswith("## 市场简报")
    assert json.loads(await tool.execute(**kwargs, language="en"))["briefMarkdown"].startswith("## Market Brief")


@pytest.mark.asyncio
async def test_brief_request_scope_overrides_default_and_restores_afterwards(monkeypatch):
    tool = _fixture_tool(monkeypatch)
    kwargs = {"symbols": [], "includeNews": False, "includeMacro": False, "includeSocial": False, "includeChips": False, "includeFundamentals": False, "includeIntelContext": False, "includeLogicChain": False}
    with response_language_scope("请以中文提供研究结论", default="en"):
        assert json.loads(await tool.execute(**kwargs))["language"] == "zh"
        assert json.loads(await tool.execute(**kwargs, language="en"))["language"] == "en"
    assert json.loads(await tool.execute(**kwargs))["language"] == "en"


@pytest.mark.asyncio
async def test_brief_localizes_generated_logic_chain_and_preserves_original_headline(monkeypatch):
    tool = _fixture_tool(monkeypatch, language="zh")
    headline = "Original 用户标题: AAPL earnings improve"
    result = json.loads(await tool.execute(
        symbols=["AAPL"], headline=headline,
        includeNews=False, includeSocial=False, includeChips=False,
        includeFundamentals=False, includeIntelContext=False,
    ))
    chain = result["logicChain"]
    assert chain["title"] == headline and chain["nodes"][0] == headline
    assert chain["nodes"][1:] == [
        "财报改变市场预期", "AAPL的持仓与情绪发生变化", "市场在未知环境下重新定价",
    ]
    assert "## 步骤" in chain["markdown"] and "## 图示" in chain["markdown"]
    assert chain["mermaid"] in chain["markdown"]
    assert chain["markdown"] in result["briefMarkdown"]
    assert result["event"]["eventType"] == "earnings"


@pytest.mark.parametrize("language", ["de", False, [], {}])
@pytest.mark.asyncio
async def test_invalid_brief_language_fails_before_fetch(monkeypatch, language):
    tool = MarketBriefTool()

    async def forbidden(**_kwargs):
        raise AssertionError("Invalid language must not fetch data")

    monkeypatch.setattr(tool._snapshot, "execute", forbidden)
    result = json.loads(await tool.execute(language=language))
    assert result["ok"] is False and result["error"]["type"] == "invalid_language"

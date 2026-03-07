import asyncio
import json

from marketbot.agent.loop import AgentLoop
from marketbot.agent.tools.market import (
    MarketBriefTool,
    MarketEventExtractTool,
    MarketMacroTool,
    MarketNewsTool,
    MarketSignalTool,
    MarketSnapshotTool,
)
from marketbot.bus.queue import MessageBus
from marketbot.config.schema import MarketToolsConfig
from marketbot.providers.base import LLMProvider, LLMResponse


class _DummyProvider(LLMProvider):
    async def chat(self, **kwargs) -> LLMResponse:  # pragma: no cover
        return LLMResponse(content="ok")

    def get_default_model(self) -> str:
        return "test-model"


def test_market_tools_config_defaults() -> None:
    cfg = MarketToolsConfig()
    assert cfg.enabled is True
    assert cfg.quote_source == "yahoo"
    assert "SPY" in cfg.default_symbols
    assert cfg.risk.min_confidence > 0


def _run(coro):
    return asyncio.run(coro)


def test_market_snapshot_mock_source() -> None:
    cfg = MarketToolsConfig(quote_source="mock", default_symbols=["NVDA"])
    tool = MarketSnapshotTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"])))
    assert payload["source"] == "mock"
    assert payload["quotes"][0]["symbol"] == "NVDA"
    assert "changePct" in payload["quotes"][0]


def test_market_event_extract_geopolitical_case() -> None:
    tool = MarketEventExtractTool()
    payload = json.loads(
        _run(tool.execute(headline="Iran launches strike; sanctions likely", body="regional tension rises"))
    )
    assert payload["eventType"] == "geopolitical_conflict"
    assert payload["confidence"] >= 0.60
    assets = [x["asset"] for x in payload["affectedAssets"]]
    assert "gold" in assets


def test_market_signal_respects_min_confidence() -> None:
    cfg = MarketToolsConfig()
    cfg.risk.min_confidence = 0.90
    tool = MarketSignalTool(config=cfg)
    payload = json.loads(
        _run(tool.execute(symbol="NVDA", priceChangePct=0.2, evidence=["single weak signal"]))
    )
    assert payload["action"] == "watch"
    assert payload["confidence"] < 0.90


def test_market_signal_buy_when_inputs_are_strong() -> None:
    cfg = MarketToolsConfig()
    cfg.risk.min_confidence = 0.50
    tool = MarketSignalTool(config=cfg)
    payload = json.loads(
        _run(
            tool.execute(
                symbol="NVDA",
                priceChangePct=4.5,
                newsSentiment=0.8,
                socialSentiment=0.7,
                macroRisk=0.1,
                evidence=["earnings beat", "guidance raised", "sector inflow"],
            )
        )
    )
    assert payload["action"] == "buy"
    assert payload["positionPct"] > 0
    assert "Signal Card" in payload["signalCard"]


def test_market_news_mock_source() -> None:
    cfg = MarketToolsConfig()
    cfg.news_sources = ["mock"]
    tool = MarketNewsTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"], limit=3)))
    assert payload["sources"] == ["mock"]
    assert len(payload["items"]) == 3
    assert payload["items"][0]["symbol"] == "NVDA"


def test_market_macro_manual_mode() -> None:
    cfg = MarketToolsConfig()
    cfg.macro_source = "manual"
    tool = MarketMacroTool(config=cfg)
    payload = json.loads(_run(tool.execute(indicators=["fedFunds", "cpi"])))
    assert payload["source"] == "manual"
    assert 0.0 <= payload["macroRisk"] <= 1.0


def test_market_brief_composes_outputs() -> None:
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA", "SPY"], headline="NVIDIA launches new AI chip")))
    assert len(payload["signals"]) == 2
    assert "briefMarkdown" in payload
    assert "Scenario Playbook" in payload["briefMarkdown"]


def test_agent_loop_registers_market_tools_by_default(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    assert "market_snapshot" in loop.tools.tool_names
    assert "market_event_extract" in loop.tools.tool_names
    assert "market_signal" in loop.tools.tool_names
    assert "market_news" in loop.tools.tool_names
    assert "market_macro" in loop.tools.tool_names
    assert "market_brief" in loop.tools.tool_names


def test_agent_loop_skips_market_tools_when_disabled(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        market_config=MarketToolsConfig(enabled=False),
    )
    assert "market_snapshot" not in loop.tools.tool_names
    assert "market_event_extract" not in loop.tools.tool_names
    assert "market_signal" not in loop.tools.tool_names
    assert "market_news" not in loop.tools.tool_names
    assert "market_macro" not in loop.tools.tool_names
    assert "market_brief" not in loop.tools.tool_names

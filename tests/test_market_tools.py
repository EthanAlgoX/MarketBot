import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock

from marketbot.agent.loop import AgentLoop
from marketbot.bus.events import InboundMessage
from marketbot.agent.tools.market import (
    IntelSearchTool,
    LogicChainVisualizerTool,
    MarketBriefTool,
    MarketChipDistributionTool,
    MarketEventExtractTool,
    MarketFundamentalsTool,
    MarketMacroTool,
    MarketNewsTool,
    MarketSocialSentimentTool,
    MarketSignalTool,
    MarketSnapshotTool,
    MarketSourcePlanTool,
    ThesisTrackerTool,
)
from marketbot.bus.queue import MessageBus
from marketbot.config.schema import ChannelsConfig, MarketToolsConfig
from marketbot.domain.market import build_market_runtime_profile
from marketbot.domain.market.services import MarketSnapshotService
from marketbot.domain.intel.collector import make_dedup_key
from marketbot.domain.intel.models import IntelRawItem, IntelSource
from marketbot.domain.intel.storage import add_source, connect_intel_db, init_intel_schema, insert_raw_items
from marketbot.providers.base import LLMProvider, LLMResponse, ToolCallRequest


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
    assert cfg.policy.mode == "heuristic"
    assert cfg.sentiment_backend == "lexicon"
    assert cfg.intel_search_enabled is True


def _run(coro):
    return asyncio.run(coro)


def test_market_snapshot_mock_source_is_disabled() -> None:
    cfg = MarketToolsConfig(quote_source="mock", default_symbols=["NVDA"])
    tool = MarketSnapshotTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"])))
    assert payload["source"] == "mock"
    assert payload["quotes"] == []
    assert "mock quote source is disabled" in payload["warnings"]
    assert payload["sourceHealth"]["mock"]["status"] == "fallback"
    assert payload["routeTrace"][0]["source"] == "mock"


def test_market_event_extract_reports_sentiment_backend() -> None:
    cfg = MarketToolsConfig(sentiment_backend="lexicon")
    tool = MarketEventExtractTool(config=cfg)
    payload = json.loads(_run(tool.execute(headline="NVDA posts strong beat and raises guidance")))
    assert payload["eventType"] == "earnings"
    assert payload["sentimentBackend"] == "lexicon"
    assert payload["sentimentLabel"] == "positive"


def test_intel_search_tool_returns_workspace_hits(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    conn = connect_intel_db(workspace)
    init_intel_schema(conn)
    try:
        source_id = add_source(
            conn,
            IntelSource(
                name="OpenAI Blog",
                source_type="rss",
                config_json=json.dumps({"url": "https://example.com/feed.xml"}),
            ),
        )
        inserted = insert_raw_items(
            conn,
            [
                IntelRawItem(
                    source_id=source_id,
                    title="OpenAI ships new agent runtime",
                    url="https://example.com/post-1",
                    published_at="2026-03-20T02:00:00Z",
                    collected_at="2026-03-20T02:10:00Z",
                    content_text="The runtime adds stronger agent orchestration and tool control.",
                    summary_text="Agent runtime update",
                    dedup_key=make_dedup_key(
                        "https://example.com/post-1",
                        "OpenAI ships new agent runtime",
                        "2026-03-20T02:00:00Z",
                    ),
                )
            ],
        )
        assert inserted == 1
    finally:
        conn.close()

    tool = IntelSearchTool(config=MarketToolsConfig(), workspace=workspace)
    payload = json.loads(_run(tool.execute(query="agent runtime", days=365, limit=3)))
    assert payload["hitCount"] == 1
    assert payload["hits"][0]["title"] == "OpenAI ships new agent runtime"


def test_thesis_tracker_tool_create_update_and_list(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    tool = ThesisTrackerTool(config=MarketToolsConfig(), workspace=workspace)

    created = json.loads(
        _run(
            tool.execute(
                action="create",
                symbol="NVDA",
                thesis="AI capex remains strong through the next two quarters",
                confidence=0.7,
                tags=["ai", "capex"],
            )
        )
    )
    thesis_id = created["thesis"]["id"]
    assert created["thesis"]["status"] == "active"
    assert created["thesis"]["symbol"] == "NVDA"

    updated = json.loads(
        _run(
            tool.execute(
                action="update",
                thesisId=thesis_id,
                evidence="Supplier orders are strong and management raised guidance",
                note="post-earnings review",
            )
        )
    )
    assert updated["verdict"] == "strengthened"
    assert updated["derivedSentiment"]["backend"] == "lexicon"
    assert updated["thesis"]["history"][-1]["note"] == "post-earnings review"

    listed = json.loads(_run(tool.execute(action="list", limit=10)))
    assert listed["count"] == 1
    assert listed["theses"][0]["id"] == thesis_id


def test_logic_chain_visualizer_renders_mermaid_from_steps() -> None:
    tool = LogicChainVisualizerTool()
    payload = json.loads(
        _run(
            tool.execute(
                title="Gold Selloff to A-Share Impact",
                steps=[
                    "Gold price drops",
                    "Gold miners revenue expectations weaken",
                    "Precious metal sector sentiment weakens",
                ],
            )
        )
    )
    assert payload["title"] == "Gold Selloff to A-Share Impact"
    assert "graph TD" in payload["mermaid"]
    assert 'N1["Gold price drops"]' in payload["mermaid"]
    assert "```mermaid" in payload["markdown"]


def test_logic_chain_visualizer_renders_labeled_edges() -> None:
    tool = LogicChainVisualizerTool()
    payload = json.loads(
        _run(
            tool.execute(
                title="Fed Cut Transmission",
                nodes=["Fed cuts rates", "Discount rate falls", "Growth stocks rerate"],
                edges=[
                    {"from": "Fed cuts rates", "to": "Discount rate falls", "label": "policy easing"},
                    {"from": "Discount rate falls", "to": "Growth stocks rerate", "label": "valuation support"},
                ],
                direction="LR",
            )
        )
    )
    assert payload["direction"] == "LR"
    assert '"policy easing"' in payload["mermaid"]
    assert payload["edges"][0]["from"] == "Fed cuts rates"


def test_market_snapshot_eastmoney_source(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="eastmoney", default_symbols=["600519"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch(symbols):
        assert symbols == ["600519"]
        return (
            [
                {
                    "symbol": "600519",
                    "name": "贵州茅台",
                    "price": 1688.0,
                    "changePct": 1.26,
                    "volume": 123456,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "up",
                    "currency": "CNY",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_eastmoney", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["600519"])))
    assert payload["source"] == "eastmoney"
    assert payload["quotes"][0]["symbol"] == "600519"
    assert payload["quotes"][0]["currency"] == "CNY"


def test_market_snapshot_tickflow_source(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="tickflow", default_symbols=["600519"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch(symbols):
        assert symbols == ["600519"]
        return (
            [
                {
                    "symbol": "600519",
                    "name": "贵州茅台",
                    "price": 1688.0,
                    "changePct": 1.26,
                    "volume": 123456,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "up",
                    "currency": "CNY",
                    "marketState": "REGULAR",
                    "provider": "tickflow",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_tickflow", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["600519"])))
    assert payload["source"] == "tickflow"
    assert payload["quotes"][0]["symbol"] == "600519"
    assert payload["quotes"][0]["provider"] == "tickflow"


def test_market_snapshot_tickflow_source_keeps_suffixed_input(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="tickflow", default_symbols=["600519.SH"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch(symbols):
        assert symbols == ["600519.SH"]
        return (
            [
                {
                    "symbol": "600519.SH",
                    "name": "贵州茅台",
                    "price": 1688.0,
                    "changePct": 1.26,
                    "volume": 123456,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "up",
                    "currency": "CNY",
                    "marketState": "REGULAR",
                    "provider": "tickflow",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_tickflow", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["600519.SH"])))
    assert payload["source"] == "tickflow"
    assert payload["quotes"][0]["symbol"] == "600519.SH"


def test_market_snapshot_tencent_hk_source(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="yahoo", default_symbols=["07709.HK"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_tencent_hk(symbols):
        assert symbols == ["07709.HK"]
        return (
            [
                {
                    "symbol": "07709",
                    "name": "XL二南方海力士",
                    "price": 26.4,
                    "changePct": -7.37,
                    "volume": 71692640,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "down",
                    "currency": "HKD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    async def _fake_fetch_yahoo(symbols):
        raise AssertionError("yahoo should not run for HK symbols when tencent hk fallback is available")

    monkeypatch.setattr(tool, "_fetch_tencent_hk", _fake_fetch_tencent_hk)
    monkeypatch.setattr(tool, "_fetch_yahoo", _fake_fetch_yahoo)
    payload = json.loads(_run(tool.execute(symbols=["07709.HK"])))
    assert payload["source"] == "tencent_hk"
    assert payload["quotes"][0]["symbol"] == "07709"
    assert payload["quotes"][0]["currency"] == "HKD"


def test_market_snapshot_tencent_hk_source_accepts_4_digit_symbol(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="yahoo", default_symbols=["9961.HK"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_tencent_hk(symbols):
        assert symbols == ["9961.HK"]
        return (
            [
                {
                    "symbol": "09961",
                    "name": "携程集团-S",
                    "price": 401.6,
                    "changePct": -1.38,
                    "volume": 1359257,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "down",
                    "currency": "HKD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    async def _fake_fetch_yahoo(symbols):
        raise AssertionError("yahoo should not run for 4-digit HK symbols when tencent hk fallback is available")

    monkeypatch.setattr(tool, "_fetch_tencent_hk", _fake_fetch_tencent_hk)
    monkeypatch.setattr(tool, "_fetch_yahoo", _fake_fetch_yahoo)
    payload = json.loads(_run(tool.execute(symbols=["9961.HK"])))
    assert payload["source"] == "tencent_hk"
    assert payload["quotes"][0]["symbol"] == "09961"
    assert payload["quotes"][0]["currency"] == "HKD"


def test_market_snapshot_yfinance_source(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="yfinance", default_symbols=["NVDA"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch(symbols):
        assert symbols == ["NVDA"]
        return (
            [
                {
                    "symbol": "NVDA",
                    "price": 901.25,
                    "changePct": 2.16,
                    "volume": 12345678,
                    "avgVolume": 9988776,
                    "flowRatio": 1.236,
                    "flowHint": "neutral",
                    "momentum": "up",
                    "currency": "USD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_yfinance", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"])))
    assert payload["source"] == "yfinance"
    assert payload["quotes"][0]["symbol"] == "NVDA"
    assert payload["quotes"][0]["currency"] == "USD"


def test_market_snapshot_tradingview_source(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="tradingview", default_symbols=["AAPL"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch(symbols):
        assert symbols == ["AAPL"]
        return (
            [
                {
                    "symbol": "AAPL",
                    "price": 233.4,
                    "changePct": 0.84,
                    "volume": 4567890,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "flat",
                    "currency": "USD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_tradingview", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["AAPL"])))
    assert payload["source"] == "tradingview"
    assert payload["quotes"][0]["symbol"] == "AAPL"


def test_market_snapshot_auto_routes_hk_to_tencent(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="auto", default_symbols=["07709.HK"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_auto(symbols):
        assert symbols == ["07709.HK"]
        return (
            [
                {
                    "symbol": "07709",
                    "price": 26.4,
                    "changePct": -7.37,
                    "volume": 71692640,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "down",
                    "currency": "HKD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_auto", _fake_fetch_auto)
    payload = json.loads(_run(tool.execute(symbols=["07709.HK"])))
    assert payload["source"] == "auto"
    assert payload["quotes"][0]["symbol"] == "07709"
    assert payload["quotes"][0]["currency"] == "HKD"


def test_market_snapshot_auto_routes_cn_to_tencent(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="auto", default_symbols=["513100"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_auto(symbols):
        assert symbols == ["513100"]
        return (
            [
                {
                    "symbol": "513100",
                    "price": 1.767,
                    "changePct": -0.95,
                    "volume": 1399438,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "flat",
                    "currency": "CNY",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_auto", _fake_fetch_auto)
    payload = json.loads(_run(tool.execute(symbols=["513100"])))
    assert payload["source"] == "auto"
    assert payload["quotes"][0]["symbol"] == "513100"
    assert payload["quotes"][0]["currency"] == "CNY"


def test_market_snapshot_yahoo_source_routes_us_to_tencent(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="yahoo", default_symbols=["NVDA"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_tencent_us(symbols):
        assert symbols == ["NVDA"]
        return (
            [
                {
                    "symbol": "NVDA",
                    "price": 180.25,
                    "changePct": -1.58,
                    "volume": 160988424,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "down",
                    "currency": "USD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    async def _fake_fetch_yahoo(symbols):
        raise AssertionError("yahoo should not run for US symbols when tencent us fallback is available")

    monkeypatch.setattr(tool, "_fetch_tencent_us", _fake_fetch_tencent_us)
    monkeypatch.setattr(tool, "_fetch_yahoo", _fake_fetch_yahoo)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"])))
    assert payload["source"] == "tencent_us"
    assert payload["quotes"][0]["symbol"] == "NVDA"
    assert payload["quotes"][0]["currency"] == "USD"


def test_market_snapshot_yahoo_source_routes_hk_to_tencent(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="yahoo", default_symbols=["07709.HK"])
    tool = MarketSnapshotTool(config=cfg)

    async def _fake_fetch_tencent_hk(symbols):
        assert symbols == ["07709.HK"]
        return (
            [
                {
                    "symbol": "07709",
                    "price": 26.4,
                    "changePct": -7.37,
                    "volume": 71692640,
                    "avgVolume": None,
                    "flowRatio": None,
                    "flowHint": "neutral",
                    "momentum": "down",
                    "currency": "HKD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    async def _fake_fetch_yahoo(symbols):
        raise AssertionError("yahoo should not run for HK symbols when tencent hk fallback is available")

    monkeypatch.setattr(tool, "_fetch_tencent_hk", _fake_fetch_tencent_hk)
    monkeypatch.setattr(tool, "_fetch_yahoo", _fake_fetch_yahoo)
    payload = json.loads(_run(tool.execute(symbols=["07709.HK"])))
    assert payload["source"] == "tencent_hk"
    assert payload["quotes"][0]["symbol"] == "07709"
    assert payload["quotes"][0]["currency"] == "HKD"


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


def test_market_source_plan_for_a_share_news_and_quote() -> None:
    tool = MarketSourcePlanTool()
    payload = json.loads(_run(tool.execute(symbols=["600519"], tasks=["quote", "news", "chips", "fundamentals"])))

    assert payload["market"] == "a-share"
    assert payload["tasks"][0]["providers"][0] == "tickflow"
    assert payload["tasks"][1]["providers"][0] == "bocha"
    assert payload["tasks"][2]["providers"][0] == "eastmoney-kline-local-cyq"
    assert payload["tasks"][3]["providers"][0] == "tickflow"
    assert "market_snapshot (current)" in payload["tasks"][0]["currentMarketbotTools"]
    assert "market_news (current cross-market search)" in payload["tasks"][1]["currentMarketbotTools"]
    assert "market_chip_distribution (current)" in payload["tasks"][2]["currentMarketbotTools"]
    assert "market_fundamentals (current)" in payload["tasks"][3]["currentMarketbotTools"]
    assert payload["tasks"][1]["futureConnectors"] == []
    assert payload["tasks"][2]["futureConnectors"] == []
    assert payload["tasks"][3]["futureConnectors"] == []
    assert payload["recommendedSkills"] == ["stock-data-sourcing"]
    assert payload["tasks"][0]["routingTelemetry"]["tool"] == "market_source_plan"
    assert "stock-data-sourcing" in payload["tasks"][0]["recommendedSkills"]


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
    assert payload["structuredAction"]["action"] == "buy"
    assert payload["structuredAction"]["take_profit_pct"] == 0.06
    assert payload["policy"]["effectiveMode"] == "heuristic"


def test_market_signal_records_rollout_and_falls_back_when_rl_mode_requested(tmp_path) -> None:
    cfg = MarketToolsConfig()
    cfg.policy.mode = "rl_hybrid"
    cfg.policy.rollout_log_path = "rl/test_market_signal.jsonl"
    cfg.risk.min_confidence = 0.50
    tool = MarketSignalTool(config=cfg, workspace=tmp_path)

    payload = json.loads(
        _run(
            tool.execute(
                symbol="NVDA",
                priceChangePct=3.2,
                newsSentiment=0.6,
                socialSentiment=0.5,
                macroRisk=0.2,
                evidence=["snapshot=strong", "news=positive", "macro=stable"],
            )
        )
    )

    assert payload["policy"]["requestedMode"] == "rl_hybrid"
    assert payload["policy"]["effectiveMode"] == "heuristic"
    assert payload["policy"]["diagnostics"]["fallbackUsed"] is True
    assert payload["structuredAction"]["evidence_keys"] == ["snapshot", "news", "macro"]
    assert payload["rolloutLog"].endswith("rl/test_market_signal.jsonl")

    log_path = tmp_path / "rl" / "test_market_signal.jsonl"
    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    event = json.loads(lines[0])
    assert event["event"] == "market_signal_decision"
    assert event["features"]["symbol"] == "NVDA"
    assert event["decision"]["structured_action"]["action"] == payload["action"]


def test_market_news_mock_source() -> None:
    cfg = MarketToolsConfig()
    cfg.news_sources = ["mock"]
    tool = MarketNewsTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"], limit=3)))
    assert payload["sources"] == ["mock"]
    assert len(payload["items"]) == 3
    assert payload["items"][0]["symbol"] == "NVDA"
    assert payload["sourceHealth"]["mock"]["status"] == "ok"
    assert payload["sourceHealth"]["mock"]["providerChain"] == ["mock"]


def test_market_news_does_not_fallback_to_mock_when_live_sources_fail(monkeypatch) -> None:
    cfg = MarketToolsConfig()
    cfg.news_sources = ["google"]
    tool = MarketNewsTool(config=cfg)

    async def _fail_provider(source: str, symbol: str, limit: int, days: int):
        tool._service.record_health(
            source,
            warnings=[f"{symbol}: provider failure"],
            reason=f"News routing for {symbol} via {source}.",
            provider_chain=[source],
        )
        return [], [f"{symbol}: provider failure"]

    monkeypatch.setattr(tool, "_fetch_provider_news", _fail_provider)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"], limit=3)))

    assert payload["providerBySymbol"]["NVDA"] == "unavailable"
    assert payload["items"] == []
    assert "NVDA: news source returned no usable items" in payload["warnings"]
    assert "mock" not in payload["sourceHealth"]


def test_market_snapshot_service_uses_cache(tmp_path, monkeypatch) -> None:
    cfg = MarketToolsConfig()
    service = MarketSnapshotService(config=cfg, workspace=tmp_path)
    calls: list[tuple[str, ...]] = []

    async def _fake_fetch(symbols: list[str]):
        calls.append(tuple(symbols))
        return (
            [
                {
                    "symbol": "NVDA",
                    "price": 1.0,
                    "changePct": 0.0,
                    "volume": 1,
                    "avgVolume": 1,
                    "flowRatio": 1.0,
                    "flowHint": "neutral",
                    "momentum": "flat",
                    "currency": "USD",
                    "marketState": "REGULAR",
                }
            ],
            [],
        )

    monkeypatch.setattr(service, "_fetch_yahoo_uncached", _fake_fetch)

    first_rows, _ = _run(service.fetch_yahoo(["NVDA"]))
    second_rows, _ = _run(service.fetch_yahoo(["NVDA"]))

    assert len(calls) == 1
    assert first_rows == second_rows
    assert service.health_snapshot()["yahoo"]["cached"] is True
    assert service.route_trace()[-1]["status"] == "cached"


def test_market_news_auto_routes_by_market(monkeypatch) -> None:
    cfg = MarketToolsConfig()
    cfg.news_sources = ["auto"]
    cfg.bocha_api_key = "bocha-key"
    cfg.brave_api_key = "brave-key"
    tool = MarketNewsTool(config=cfg)
    calls: list[tuple[str, str]] = []

    async def _fake_fetch(source: str, symbol: str, limit: int, days: int):
        calls.append((source, symbol))
        if source == "bocha" and symbol == "600519":
            return (
                [
                    {
                        "symbol": "600519",
                        "title": "茅台 最新消息",
                        "source": "财联社",
                        "provider": "bocha",
                        "publishedAt": "2026-03-07",
                        "url": "https://example.com/600519",
                    }
                ],
                [],
            )
        if source == "brave" and symbol == "AAPL":
            return (
                [
                    {
                        "symbol": "AAPL",
                        "title": "Apple latest news",
                        "source": "Reuters",
                        "provider": "brave",
                        "publishedAt": "2026-03-07",
                        "url": "https://example.com/aapl",
                    }
                ],
                [],
            )
        return [], [f"{symbol}: no results"]

    monkeypatch.setattr(tool, "_fetch_provider_news", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["600519", "AAPL"], limit=2)))

    assert payload["providerBySymbol"]["600519"] == "bocha"
    assert payload["providerBySymbol"]["AAPL"] == "brave"
    assert ("bocha", "600519") in calls
    assert ("brave", "AAPL") in calls


def test_market_chip_distribution_local_estimate(monkeypatch) -> None:
    tool = MarketChipDistributionTool()

    async def _fake_fetch(symbol: str, lookback_days: int):
        assert symbol == "600519"
        assert lookback_days == 90
        return (
            [
                "2026-03-03,100,101,102,99,1000,101000,3.0,1.0,1.0,5.0",
                "2026-03-04,101,102,103,100,1200,122400,3.0,1.0,1.0,8.0",
                "2026-03-05,102,104,105,101,1500,156000,4.0,2.0,2.0,12.0",
            ]
            * 10,
            None,
        )

    monkeypatch.setattr(tool, "_fetch_kline", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbol="600519", lookbackDays=90)))

    assert payload["symbol"] == "600519"
    assert payload["source"] == "eastmoney-kline-local-cyq"
    assert 0.0 <= payload["profitRatio"] <= 1.0
    assert payload["cost90Low"] <= payload["cost90High"]
    assert payload["barsUsed"] >= 20


def test_market_fundamentals_eastmoney(monkeypatch) -> None:
    tool = MarketFundamentalsTool()

    async def _fake_fetch(symbol: str):
        assert symbol == "600519"
        return (
            {
                "symbol": "600519",
                "name": "贵州茅台",
                "marketCap": 1755682841430.0,
                "floatMarketCap": 1755682841430.0,
                "sharesOutstanding": 1252270215.0,
                "floatShares": 1252270215.0,
                "trailingPE": 20.37,
                "priceToBook": 6.83,
                "currency": "CNY",
                "provider": "eastmoney",
            },
            None,
        )

    monkeypatch.setattr(tool, "_fetch_eastmoney", _fake_fetch)
    payload = json.loads(_run(tool.execute(symbols=["600519"])))

    assert payload["items"][0]["symbol"] == "600519"
    assert payload["items"][0]["provider"] == "eastmoney"
    assert payload["items"][0]["trailingPE"] == 20.37


def test_market_fundamentals_prefers_yfinance_for_global_symbols(monkeypatch) -> None:
    tool = MarketFundamentalsTool(config=MarketToolsConfig(quote_source="yfinance"))

    async def _fake_yfinance(symbols: list[str]):
        assert symbols == ["AAPL"]
        return (
            [
                {
                    "symbol": "AAPL",
                    "name": "Apple Inc.",
                    "marketCap": 100.0,
                    "floatMarketCap": 100.0,
                    "sharesOutstanding": 10.0,
                    "floatShares": 9.0,
                    "trailingPE": 30.0,
                    "priceToBook": 20.0,
                    "currency": "USD",
                    "provider": "yfinance",
                }
            ],
            [],
        )

    async def _fail_yahoo(symbols: list[str]):
        raise AssertionError("yahoo fallback should not run when yfinance succeeds")

    monkeypatch.setattr(tool, "_fetch_yfinance", _fake_yfinance)
    monkeypatch.setattr(tool, "_fetch_yahoo", _fail_yahoo)
    payload = json.loads(_run(tool.execute(symbols=["AAPL"])))

    assert payload["items"][0]["symbol"] == "AAPL"
    assert payload["items"][0]["provider"] == "yfinance"


def test_market_fundamentals_uses_tickflow_for_a_share(monkeypatch) -> None:
    tool = MarketFundamentalsTool(config=MarketToolsConfig(quote_source="tickflow", tickflow_api_key="test-key"))

    async def _fake_tickflow(symbols: list[str]):
        assert symbols == ["600519"]
        return (
            [
                {
                    "symbol": "600519",
                    "name": "贵州茅台",
                    "marketCap": 200.0,
                    "floatMarketCap": 150.0,
                    "sharesOutstanding": 20.0,
                    "floatShares": 15.0,
                    "trailingPE": None,
                    "priceToBook": None,
                    "currency": "CNY",
                    "provider": "tickflow",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_tickflow", _fake_tickflow)
    payload = json.loads(_run(tool.execute(symbols=["600519"])))

    assert payload["items"][0]["symbol"] == "600519"
    assert payload["items"][0]["provider"] == "tickflow"
    assert payload["items"][0]["marketCap"] == 200.0


def test_market_fundamentals_tickflow_keeps_suffixed_input(monkeypatch) -> None:
    tool = MarketFundamentalsTool(config=MarketToolsConfig(quote_source="tickflow", tickflow_api_key="test-key"))

    async def _fake_tickflow(symbols: list[str]):
        assert symbols == ["600519.SH"]
        return (
            [
                {
                    "symbol": "600519.SH",
                    "name": "贵州茅台",
                    "marketCap": 200.0,
                    "floatMarketCap": 150.0,
                    "sharesOutstanding": 20.0,
                    "floatShares": 15.0,
                    "trailingPE": None,
                    "priceToBook": None,
                    "currency": "CNY",
                    "provider": "tickflow",
                }
            ],
            [],
        )

    monkeypatch.setattr(tool, "_fetch_tickflow", _fake_tickflow)
    payload = json.loads(_run(tool.execute(symbols=["600519.SH"])))

    assert payload["items"][0]["symbol"] == "600519.SH"
    assert payload["items"][0]["provider"] == "tickflow"


def test_market_macro_manual_mode() -> None:
    cfg = MarketToolsConfig()
    cfg.macro_source = "manual"
    tool = MarketMacroTool(config=cfg)
    payload = json.loads(_run(tool.execute(indicators=["fedFunds", "cpi"])))
    assert payload["source"] == "manual"
    assert 0.0 <= payload["macroRisk"] <= 1.0
    assert payload["sourceHealth"]["manual"]["status"] == "ok"
    assert payload["routeTrace"][0]["reason"] == "Manual macro fallback mode is active."


def test_market_macro_missing_fred_key_uses_manual_fallback_health() -> None:
    cfg = MarketToolsConfig()
    cfg.macro_source = "fred"
    cfg.fred_api_key = ""
    tool = MarketMacroTool(config=cfg)
    payload = json.loads(_run(tool.execute(indicators=["fedFunds", "cpi"])))

    assert payload["source"] == "manual"
    assert payload["sourceHealth"]["manual"]["status"] == "fallback"
    assert payload["sourceHealth"]["manual"]["providerChain"] == ["fred", "manual"]
    assert "fedFunds: missing FRED api key" in payload["warnings"]
    assert "cpi: missing FRED api key" in payload["warnings"]


def test_market_social_sentiment_mock_source() -> None:
    cfg = MarketToolsConfig()
    cfg.social_sources = ["mock"]
    tool = MarketSocialSentimentTool(config=cfg)
    payload = json.loads(_run(tool.execute(symbols=["NVDA", "SPY"], limit=12)))
    assert payload["sources"] == ["mock"]
    assert len(payload["perSymbol"]) == 2
    assert "overallSentiment" in payload
    assert payload["totalMentions"] >= 2


def test_market_social_sentiment_a_share_defaults_to_mock_without_reddit(monkeypatch) -> None:
    cfg = MarketToolsConfig()
    tool = MarketSocialSentimentTool(config=cfg)

    async def _fail_reddit(symbol: str, limit: int):
        raise AssertionError("reddit should not run for A-share social sentiment by default")

    monkeypatch.setattr(tool, "_fetch_reddit", _fail_reddit)
    payload = json.loads(_run(tool.execute(symbols=["600000.SH"], limit=12)))

    assert payload["perSymbol"][0]["symbol"] == "600000.SH"
    assert payload["warnings"] == []
    assert payload["totalMentions"] >= 1


def test_market_brief_composes_outputs() -> None:
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.social_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg)

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "mock-brief-fixture",
                "symbols": ["NVDA", "SPY"],
                "quotes": [
                    {
                        "symbol": "NVDA",
                        "price": 100.0,
                        "changePct": 1.5,
                        "volume": 1000,
                        "avgVolume": 900,
                        "flowRatio": 1.1,
                        "flowHint": "inflow",
                        "momentum": "up",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    },
                    {
                        "symbol": "SPY",
                        "price": 500.0,
                        "changePct": -0.4,
                        "volume": 2000,
                        "avgVolume": 2100,
                        "flowRatio": 0.95,
                        "flowHint": "neutral",
                        "momentum": "flat",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    },
                ],
                "warnings": [],
                "sourceHealth": {"mock-brief-fixture": {"status": "ok"}},
                "routeTrace": [],
            }
        )

    tool._snapshot.execute = _fake_snapshot
    payload = json.loads(_run(tool.execute(symbols=["NVDA", "SPY"], headline="NVIDIA launches new AI chip")))
    assert len(payload["signals"]) == 2
    assert "social" in payload
    assert payload["marketRoute"]["primary"] == "equity"
    assert payload["dataReliability"]["overallStatus"] == "ok"
    assert payload["dataReliability"]["components"]["snapshot"]["status"] == "ok"
    assert "briefMarkdown" in payload
    assert "Market Focus: equity" in payload["briefMarkdown"]
    assert "Scenario Playbook" in payload["briefMarkdown"]
    assert "Data Reliability" in payload["briefMarkdown"]
    assert "snapshot: mock-brief-fixture=ok" in payload["briefMarkdown"]
    assert "macro: manual=ok" in payload["briefMarkdown"]
    assert payload["logicChain"] is not None
    assert "Logic Chain Appendix" in payload["briefMarkdown"]


def test_market_brief_includes_intel_context_hits(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.social_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg)

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "mock",
                "symbols": ["NVDA"],
                "quotes": [
                    {
                        "symbol": "NVDA",
                        "price": 100.0,
                        "changePct": 1.5,
                        "volume": 1000,
                        "avgVolume": 900,
                        "flowRatio": 1.1,
                        "flowHint": "inflow",
                        "momentum": "up",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    }
                ],
                "warnings": [],
                "sourceHealth": {"mock": {"status": "ok"}},
                "routeTrace": [],
            }
        )

    async def _fake_intel_search(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "query": "NVDA AI demand",
                "hitCount": 1,
                "hits": [
                    {
                        "itemId": 1,
                        "sourceId": 1,
                        "sourceName": "Workspace Feed",
                        "title": "Earlier NVDA supply-chain note",
                        "url": "https://example.com/intel",
                        "publishedAt": "2026-03-06T10:00:00Z",
                        "collectedAt": "2026-03-06T10:05:00Z",
                        "summaryText": "Earlier note",
                        "contentPreview": "preview",
                        "score": 1.23,
                    }
                ],
            }
        )

    monkeypatch.setattr(tool._snapshot, "execute", _fake_snapshot)
    monkeypatch.setattr(tool._intel_search, "execute", _fake_intel_search)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"], headline="NVDA AI demand stays strong")))

    assert payload["intelContext"]["hitCount"] == 1
    assert "Prior Intel Context" in payload["briefMarkdown"]
    assert "Earlier NVDA supply-chain note" in payload["briefMarkdown"]


def test_market_brief_can_create_thesis(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.social_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg, workspace=workspace)

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "mock",
                "symbols": ["NVDA"],
                "quotes": [
                    {
                        "symbol": "NVDA",
                        "price": 100.0,
                        "changePct": 2.0,
                        "volume": 1000,
                        "avgVolume": 900,
                        "flowRatio": 1.1,
                        "flowHint": "inflow",
                        "momentum": "up",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    }
                ],
                "warnings": [],
            }
        )

    tool._snapshot.execute = _fake_snapshot
    payload = json.loads(
        _run(
            tool.execute(
                symbols=["NVDA"],
                headline="NVDA launches new AI chip",
                thesisMode="create",
                thesisText="AI chip cycle remains strong",
            )
        )
    )
    assert payload["thesisTracking"] is not None
    assert payload["thesisTracking"]["action"] == "create"
    assert payload["thesisTracking"]["thesis"]["symbol"] == "NVDA"
    assert "Thesis Tracking" in payload["briefMarkdown"]


def test_market_brief_can_update_existing_thesis(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.social_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg, workspace=workspace)

    created = json.loads(
        _run(
            tool._thesis_tracker.execute(
                action="create",
                symbol="NVDA",
                thesis="AI chip cycle remains strong",
                confidence=0.65,
            )
        )
    )
    thesis_id = created["thesis"]["id"]

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "mock",
                "symbols": ["NVDA"],
                "quotes": [
                    {
                        "symbol": "NVDA",
                        "price": 98.0,
                        "changePct": -3.5,
                        "volume": 1200,
                        "avgVolume": 900,
                        "flowRatio": 0.9,
                        "flowHint": "outflow",
                        "momentum": "down",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    }
                ],
                "warnings": [],
            }
        )

    tool._snapshot.execute = _fake_snapshot
    payload = json.loads(
        _run(
            tool.execute(
                symbols=["NVDA"],
                headline="NVDA faces weak demand and cuts guidance",
                thesisMode="update",
                thesisId=thesis_id,
            )
        )
    )
    assert payload["thesisTracking"] is not None
    assert payload["thesisTracking"]["action"] == "update"
    assert payload["thesisTracking"]["verdict"] in {"weakened", "falsified"}
    assert payload["thesisTracking"]["thesis"]["id"] == thesis_id


def test_market_brief_calls_out_unavailable_live_news_without_mock(monkeypatch) -> None:
    cfg = MarketToolsConfig()
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg)

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "tencent_us",
                "symbols": ["NVDA"],
                "quotes": [
                    {
                        "symbol": "NVDA",
                        "price": 100.0,
                        "changePct": 1.0,
                        "volume": 1000,
                        "avgVolume": 900,
                        "flowRatio": 1.1,
                        "flowHint": "inflow",
                        "momentum": "up",
                        "currency": "USD",
                        "marketState": "REGULAR",
                    }
                ],
                "warnings": [],
                "sourceHealth": {"tencent_us": {"status": "ok"}},
                "routeTrace": [],
            }
        )

    async def _fake_news(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "sources": ["google"],
                "providerBySymbol": {"NVDA": "unavailable"},
                "items": [],
                "warnings": ["NVDA: news source returned no usable items"],
                "sourceHealth": {"google": {"status": "degraded"}},
                "routeTrace": [],
            }
        )

    monkeypatch.setattr(tool._snapshot, "execute", _fake_snapshot)
    monkeypatch.setattr(tool._news, "execute", _fake_news)
    payload = json.loads(_run(tool.execute(symbols=["NVDA"], includeSocial=False, includeChips=False, includeFundamentals=False)))

    assert "### News Availability" in payload["briefMarkdown"]
    assert "No mock news was used" in payload["briefMarkdown"]
    assert "- NVDA: live news unavailable" in payload["briefMarkdown"]


def test_market_brief_includes_chip_distribution_for_a_share(monkeypatch) -> None:
    cfg = MarketToolsConfig(quote_source="mock")
    cfg.news_sources = ["mock"]
    cfg.social_sources = ["mock"]
    cfg.macro_source = "manual"
    tool = MarketBriefTool(config=cfg)

    async def _fake_snapshot(*args, **kwargs):
        return json.dumps(
            {
                "asOf": "2026-03-07T00:00:00Z",
                "source": "mock",
                "symbols": ["600519"],
                "quotes": [
                    {
                        "symbol": "600519",
                        "price": 1402.0,
                        "changePct": 1.5,
                        "volume": 1000,
                        "avgVolume": 900,
                        "flowRatio": 1.1,
                        "flowHint": "inflow",
                        "momentum": "up",
                        "currency": "CNY",
                        "marketState": "REGULAR",
                    }
                ],
                "warnings": [],
            }
        )

    async def _fake_chips(*args, **kwargs):
        return json.dumps(
            {
                "symbol": "600519",
                "source": "eastmoney-kline-local-cyq",
                "profitRatio": 0.68,
                "avgCost": 1320.0,
                "cost90Low": 1200.0,
                "cost90High": 1380.0,
                "concentration90": 0.86,
                "cost70Low": 1260.0,
                "cost70High": 1360.0,
                "concentration70": 0.92,
            }
        )

    async def _fake_fundamentals(*args, **kwargs):
        return json.dumps(
            {
                "items": [
                    {
                        "symbol": "600519",
                        "provider": "eastmoney",
                        "trailingPE": 20.37,
                        "priceToBook": 6.83,
                        "marketCap": 1755682841430.0,
                    }
                ],
                "warnings": [],
            }
        )

    monkeypatch.setattr(tool._snapshot, "execute", _fake_snapshot)
    monkeypatch.setattr(tool._chips, "execute", _fake_chips)
    monkeypatch.setattr(tool._fundamentals, "execute", _fake_fundamentals)
    payload = json.loads(_run(tool.execute(symbols=["600519"], headline="白酒板块回暖")))

    assert "chips" in payload
    assert "fundamentals" in payload
    assert "600519" in payload["chips"]["perSymbol"]
    assert "Chips: profit=0.68" in payload["briefMarkdown"]
    assert "Fundamentals: PE=20.37 | PB=6.83" in payload["briefMarkdown"]
    assert payload["dataReliability"]["components"]["news"]["status"] == "ok"


def test_agent_loop_registers_market_tools_by_default(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    assert "market_snapshot" in loop.tools.tool_names
    assert "market_event_extract" in loop.tools.tool_names
    assert "market_source_plan" in loop.tools.tool_names
    assert "market_signal" in loop.tools.tool_names
    assert "market_chip_distribution" in loop.tools.tool_names
    assert "market_fundamentals" in loop.tools.tool_names
    assert "market_news" in loop.tools.tool_names
    assert "market_social_sentiment" in loop.tools.tool_names
    assert "market_macro" in loop.tools.tool_names
    assert "market_brief" in loop.tools.tool_names
    assert set(loop.context.available_tools or set()).issuperset({"market_snapshot", "market_signal", "market_brief"})


def test_agent_loop_registers_browser_tools_when_enabled(tmp_path) -> None:
    from marketbot.config.schema import BrowserToolsConfig

    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        browser_config=BrowserToolsConfig(enabled=True),
    )
    assert {"browser_site", "browser_page", "browser_network"}.issubset(loop.tools.tool_names)


def test_agent_loop_registers_xiaohongshu_cli_tool_when_enabled(tmp_path) -> None:
    from marketbot.config.schema import XiaohongshuCliToolsConfig

    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        xiaohongshu_cli_config=XiaohongshuCliToolsConfig(enabled=True),
    )
    assert "xiaohongshu_cli" in loop.tools.tool_names


def test_agent_loop_registers_twitter_cli_tool_when_enabled(tmp_path) -> None:
    from marketbot.config.schema import TwitterCliToolsConfig

    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        twitter_cli_config=TwitterCliToolsConfig(enabled=True),
    )
    assert "twitter_cli" in loop.tools.tool_names


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
    assert "market_source_plan" not in loop.tools.tool_names
    assert "market_signal" not in loop.tools.tool_names
    assert "market_chip_distribution" not in loop.tools.tool_names
    assert "market_fundamentals" not in loop.tools.tool_names
    assert "market_news" not in loop.tools.tool_names
    assert "market_social_sentiment" not in loop.tools.tool_names
    assert "market_macro" not in loop.tools.tool_names
    assert "market_brief" not in loop.tools.tool_names
    assert "market_snapshot" not in (loop.context.available_tools or set())


def test_agent_loop_sets_market_runtime_profile_from_config(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        market_config=MarketToolsConfig(quote_source="eastmoney"),
    )

    assert loop.context.market_runtime_profile is not None
    assert loop.context.market_runtime_profile["tool_markets"]["market_snapshot"] == ["a-share"]


def test_market_runtime_profile_supports_yfinance_and_tradingview() -> None:
    yfinance_profile = build_market_runtime_profile(MarketToolsConfig(quote_source="yfinance"))
    tradingview_profile = build_market_runtime_profile(MarketToolsConfig(quote_source="tradingview"))
    tickflow_profile = build_market_runtime_profile(MarketToolsConfig(quote_source="tickflow"))

    assert yfinance_profile["tool_markets"]["market_snapshot"] == ["global", "hong-kong", "mixed", "us"]
    assert tradingview_profile["tool_markets"]["market_snapshot"] == ["global", "hong-kong", "mixed", "us"]
    assert tickflow_profile["tool_markets"]["market_snapshot"] == ["a-share"]


def test_agent_loop_exposes_last_skill_routing(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    session = loop.sessions.get_or_create("cli:direct")

    loop.processor.build_messages(
        session=session,
        current_message="Analyze NVDA swing setup, include catalysts and risk checklist.",
        channel="cli",
        chat_id="direct",
    )

    routing = loop.get_last_skill_routing()
    assert routing is not None
    assert routing["requestProfile"]["markets"] == ["us"]
    assert {item["name"] for item in routing["selected"]} >= {"market-report", "catalyst-tracker", "risk-checklist"}


def test_agent_loop_attaches_skill_routing_to_response_and_session(tmp_path) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="Analyze NVDA swing setup.")

    response = _run(loop._process_message(msg))

    assert response is not None
    assert "skill_routing" in response.metadata
    assert response.metadata["skill_routing"]["requestProfile"]["markets"] == ["us"]
    session = loop.sessions.get_or_create("cli:direct")
    assert session.metadata["last_skill_routing"]["requestProfile"]["markets"] == ["us"]


def test_agent_loop_appends_chat_explainability_footer_for_market_brief(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    tool_call = ToolCallRequest(
        id="call1",
        name="market_brief",
        arguments={"symbols": ["NVDA"]},
    )
    responses = iter([
        LLMResponse(content="", tool_calls=[tool_call]),
        LLMResponse(content="Here is the analysis.", tool_calls=[]),
    ])
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))

    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "dataReliability": {"overallStatus": "ok"},
    }
    monkeypatch.setattr(loop.tools.get("market_brief"), "execute", AsyncMock(return_value=json.dumps(payload)))

    result = _run(loop._process_message(InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="Analyze NVDA swing setup.")))

    assert result is not None
    assert result.content.startswith("Here is the analysis.")
    assert "## Capability & Data Notes" in result.content
    assert "Skills used:" in result.content
    assert "Data reliability: ok" in result.content
    assert result.metadata["explainability"]["delivery"] == "inline"
    assert "## Capability & Data Notes" in result.metadata["explainability"]["inline_footer"]


def test_agent_loop_uses_compact_chat_explainability_for_telegram(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    tool_call = ToolCallRequest(
        id="call1",
        name="market_brief",
        arguments={"symbols": ["NVDA"]},
    )
    responses = iter([
        LLMResponse(content="", tool_calls=[tool_call]),
        LLMResponse(content="Telegram analysis.", tool_calls=[]),
    ])
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))

    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "dataReliability": {"overallStatus": "ok"},
    }
    monkeypatch.setattr(loop.tools.get("market_brief"), "execute", AsyncMock(return_value=json.dumps(payload)))

    result = _run(
        loop._process_message(InboundMessage(channel="telegram", sender_id="user", chat_id="10001", content="Analyze NVDA swing setup."))
    )

    assert result is not None
    assert result.content == "Telegram analysis."
    assert result.metadata["explainability"]["delivery"] == "inline"
    assert result.metadata["explainability"]["mode"] == "auto"
    assert result.metadata["explainability"]["inline_footer"] == "_Capability & Data_: Skills: market-report | Reliability: ok"


def test_agent_loop_respects_global_explainability_off(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        channels_config=ChannelsConfig(explainability_mode="off"),
    )
    tool_call = ToolCallRequest(
        id="call1",
        name="market_brief",
        arguments={"symbols": ["NVDA"]},
    )
    responses = iter([
        LLMResponse(content="", tool_calls=[tool_call]),
        LLMResponse(content="No footer, please.", tool_calls=[]),
    ])
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))

    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "dataReliability": {"overallStatus": "ok"},
    }
    monkeypatch.setattr(loop.tools.get("market_brief"), "execute", AsyncMock(return_value=json.dumps(payload)))

    result = _run(loop._process_message(InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="Analyze NVDA swing setup.")))

    assert result is not None
    assert result.content == "No footer, please."
    assert result.metadata["explainability"]["mode"] == "off"


def test_agent_loop_respects_channel_explainability_override(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        channels_config=ChannelsConfig(
            explainability_mode="off",
            explainability_overrides={"telegram": "full"},
        ),
    )
    tool_call = ToolCallRequest(
        id="call1",
        name="market_brief",
        arguments={"symbols": ["NVDA"]},
    )
    responses = iter([
        LLMResponse(content="", tool_calls=[tool_call]),
        LLMResponse(content="Telegram analysis with override.", tool_calls=[]),
    ])
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))

    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "dataReliability": {"overallStatus": "ok"},
    }
    monkeypatch.setattr(loop.tools.get("market_brief"), "execute", AsyncMock(return_value=json.dumps(payload)))

    result = _run(
        loop._process_message(
            InboundMessage(
                channel="telegram",
                sender_id="user",
                chat_id="10001",
                content="Analyze NVDA swing setup.",
            )
        )
    )

    assert result is not None
    assert result.content == "Telegram analysis with override."
    assert result.metadata["explainability"]["mode"] == "full"
    assert "## Capability & Data Notes" in result.metadata["explainability"]["inline_footer"]
    assert "_Capability & Data_:" not in result.metadata["explainability"]["inline_footer"]


def test_agent_loop_respects_metadata_only_explainability_delivery(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
        channels_config=ChannelsConfig(explainability_delivery="metadata"),
    )
    tool_call = ToolCallRequest(
        id="call1",
        name="market_brief",
        arguments={"symbols": ["NVDA"]},
    )
    responses = iter([
        LLMResponse(content="", tool_calls=[tool_call]),
        LLMResponse(content="Telegram analysis with metadata delivery.", tool_calls=[]),
    ])
    loop.provider.chat = AsyncMock(side_effect=lambda *args, **kwargs: next(responses))

    payload = {
        "briefMarkdown": "## Market Brief\n\n- NVDA: BUY",
        "dataReliability": {"overallStatus": "ok"},
    }
    monkeypatch.setattr(loop.tools.get("market_brief"), "execute", AsyncMock(return_value=json.dumps(payload)))

    result = _run(
        loop._process_message(
            InboundMessage(
                channel="telegram",
                sender_id="user",
                chat_id="10001",
                content="Analyze NVDA swing setup.",
            )
        )
    )

    assert result is not None
    assert result.content == "Telegram analysis with metadata delivery."
    assert result.metadata["explainability"]["delivery"] == "metadata"
    assert result.metadata["explainability"]["inline_footer"] == "_Capability & Data_: Skills: market-report | Reliability: ok"


def test_agent_loop_appends_external_skill_install_suggestions(tmp_path, monkeypatch) -> None:
    loop = AgentLoop(
        bus=MessageBus(),
        provider=_DummyProvider(),
        workspace=tmp_path,
        model="test-model",
    )
    loop.provider.chat = AsyncMock(return_value=LLMResponse(content="Here is a deployment plan.", tool_calls=[]))
    monkeypatch.setattr(
        loop.context.skills,
        "search_external_skills",
        lambda text, limit=5: [
            {
                "name": "k8s-release",
                "title": "K8s Release",
                "description": "Deploy Kubernetes apps with Helm and ArgoCD.",
                "category": "DevOps",
                "url": "https://github.com/openclaw/skills/tree/main/skills/k8s-release",
            }
        ],
    )

    result = _run(
        loop._process_message(
            InboundMessage(
                channel="cli",
                sender_id="user",
                chat_id="direct",
                content="Design a Kubernetes deployment pipeline with Helm and ArgoCD.",
            )
        )
    )

    assert result is not None
    assert "## External Skill Suggestions" in result.content
    assert "`k8s-release`" in result.content
    assert "`marketbot skills install k8s-release`" in result.content
    assert result.metadata["skill_install_suggestions"][0]["name"] == "k8s-release"
    assert result.metadata["skill_install_suggestions"][0]["install_command"] == "marketbot skills install k8s-release"

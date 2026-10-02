"""Reports disclose observation age, and cross-market plans retain market boundaries."""

import asyncio
import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from marketbot.agent.tools.market import (
    MarketBriefTool,
    MarketChipDistributionTool,
    MarketFundamentalsTool,
    MarketSourcePlanTool,
)
from marketbot.config.schema import MarketToolsConfig


def test_cross_market_provider_plans_are_separate_and_chips_are_not_global():
    result = json.loads(asyncio.run(MarketSourcePlanTool().execute(symbols=["600519", "0700.HK", "SPY"], tasks=["quote", "fundamentals", "chips"])))
    assert result["market"] == "mixed"
    assert result["marketGroups"] == {"a-share": ["600519"], "hong-kong": ["0700.HK"], "us": ["SPY"]}
    assert len(result["tasks"]) == 9
    assert all(row["symbols"] == result["marketGroups"][row["market"]] for row in result["tasks"])
    for row in result["tasks"]:
        if row["task"] == "fundamentals" and row["market"] != "a-share":
            assert row["providers"] == ["yahoo"]
        if row["task"] == "chips" and row["market"] != "a-share":
            assert row["providers"] == [] and row["currentMarketbotTools"] == []
    assert not any("mock" in row["providers"] for row in result["tasks"])


def test_hong_kong_numeric_alias_and_empty_symbol_plans():
    tool = MarketSourcePlanTool()
    hk = json.loads(asyncio.run(tool.execute(symbols=["700", "hk00700", "0700.HK"])))
    assert hk["market"] == "hong-kong"
    assert hk["marketGroups"]["hong-kong"] == ["700", "HK00700", "0700.HK"]
    empty = json.loads(asyncio.run(tool.execute()))
    assert empty["tasks"] and empty["marketGroups"]


@pytest.mark.parametrize("age,state", [(30, "fresh"), (7200, "stale"), (None, "unknown"), (-60, "future")])
def test_brief_uses_source_observation_age_not_retrieval_time(tmp_path, age, state):
    now = datetime.now(UTC)
    observed = (now - timedelta(seconds=age)).isoformat() if age is not None else None
    tool = MarketBriefTool(config=MarketToolsConfig(), workspace=tmp_path)

    async def snapshot(**kwargs):
        return json.dumps({"asOf": now.isoformat(), "source": "fixture-provider", "quotes": [{"symbol": "600519", "price": 100, "changePct": 1, "currency": "CNY", "observedAt": observed}], "sourceHealth": {"fixture-provider": {"status": "ok"}}})

    tool._snapshot.execute = snapshot
    result = json.loads(asyncio.run(tool.execute(symbols=["600519"], includeNews=False, includeMacro=False, includeSocial=False, includeChips=False, includeFundamentals=False, includeIntelContext=False, includeLogicChain=False)))
    row = result["quoteFreshness"][0]
    assert row["freshness"] == state and row["observedAt"] == (observed.replace("+00:00", "Z") if observed else None)
    assert row["retrievedAt"] == now.isoformat()
    assert result["dataReliability"]["overallStatus"] == ("ok" if state == "fresh" else "stale" if state == "stale" else "unknown")
    assert result["dataReliability"]["components"]["snapshot"]["transportStatus"] == "ok"
    assert f"freshness={state}" in result["briefMarkdown"]
    assert "observedAt=unknown" in result["briefMarkdown"] if age is None else observed.replace("+00:00", "Z") in result["briefMarkdown"]
    assert "macroRisk unavailable" in result["briefMarkdown"]
    assert "heuristic estimate" in result["briefMarkdown"]
    assert "not source observation time" in result["briefMarkdown"]


def test_report_freshness_can_use_explicit_user_cutoff_but_missing_quote_remains_unavailable(tmp_path):
    now = datetime.now(UTC)
    tool = MarketBriefTool(config=MarketToolsConfig(), workspace=tmp_path)

    async def snapshot(**kwargs):
        return json.dumps({"source": "fixture-provider", "quotes": [{"symbol": "SPY", "price": 100, "currency": "USD", "observedAt": (now - timedelta(seconds=7200)).isoformat()}]})

    flags = dict(includeNews=False, includeMacro=False, includeSocial=False, includeChips=False, includeFundamentals=False, includeIntelContext=False, includeLogicChain=False)
    tool._snapshot.execute = snapshot
    report = json.loads(asyncio.run(tool.execute(maxQuoteAgeSeconds=86400, **flags)))
    assert report["quoteFreshness"][0]["freshness"] == "fresh"
    assert report["quoteFreshness"][0]["maxAgeSeconds"] == 86400

    async def empty(**kwargs):
        return json.dumps({"quotes": [], "warnings": ["unavailable"]})

    tool._snapshot.execute = empty
    missing = json.loads(asyncio.run(tool.execute(**flags)))
    assert missing["dataReliability"]["overallStatus"] == "unavailable"
    assert missing["signals"] == []


@pytest.mark.parametrize("fetcher", ["chips", "eastmoney", "yahoo"])
def test_provider_errors_do_not_echo_request_urls_or_credentials(monkeypatch, fetcher):
    client_class = httpx.AsyncClient

    def handler(request):
        raise httpx.ReadTimeout("failed at https://provider.invalid/?api_key=fixture-secret", request=request)

    # Other test modules isolate market.py in sys.modules; patch the class's
    # actual HTTP dependency rather than a possibly replaced import alias.
    fetch_method = (MarketChipDistributionTool._fetch_kline if fetcher == "chips" else
                    MarketFundamentalsTool._fetch_eastmoney if fetcher == "eastmoney" else
                    MarketFundamentalsTool._fetch_yahoo)
    monkeypatch.setattr(fetch_method.__globals__["httpx"], "AsyncClient", lambda **kwargs: client_class(**kwargs, transport=httpx.MockTransport(handler)))
    if fetcher == "chips":
        rows, error = asyncio.run(MarketChipDistributionTool()._fetch_kline("600519", 20))
    elif fetcher == "eastmoney":
        rows, error = asyncio.run(MarketFundamentalsTool()._fetch_eastmoney("600519"))
    else:
        rows, errors = asyncio.run(MarketFundamentalsTool()._fetch_yahoo(["SPY"]))
        error = errors[0]
    assert not rows and error == "ReadTimeout"

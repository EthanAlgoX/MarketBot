"""Bundled finance MCP contracts, validated without live market services."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client

from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market.plugin import MarketSourcePlanTool, create_market_tools
from marketbot.mcp.finance import (
    FINANCE_CONFIG_ENV,
    create_finance_server,
    load_finance_settings,
    load_market_config,
)

READ_ONLY_TOOLS = {
    "market_source_plan",
    "market_snapshot",
    "market_fundamentals",
    "market_news",
    "market_macro",
    "market_event_extract",
    "market_social_sentiment",
    "market_chip_distribution",
    "portfolio_risk",
    "evidence_get",
    "evidence_list",
    "logic_chain_visualizer",
}


async def _call(server, name, arguments):
    response = await server.request_handlers[types.CallToolRequest](
        types.CallToolRequest(params=types.CallToolRequestParams(name=name, arguments=arguments))
    )
    return response.root


@pytest.mark.asyncio
async def test_finance_mcp_preserves_native_schema_and_limits_surface(tmp_path):
    config = MarketToolsConfig(sentiment_backend="finbert", sentiment_model="local-test-model")
    native = {tool.name: tool for tool in create_market_tools(config, tmp_path, read_only=True)}
    server = create_finance_server(tmp_path, config)
    result = await server.request_handlers[types.ListToolsRequest](types.ListToolsRequest())

    assert {tool.name for tool in result.root.tools} == READ_ONLY_TOOLS
    for tool in result.root.tools:
        assert tool.inputSchema == native[tool.name].parameters
        assert tool.description == native[tool.name].description
        assert tool.annotations.readOnlyHint is True
        assert tool.annotations.destructiveHint is False
    assert native["market_event_extract"]._sentiment.backend == "finbert"
    assert native["market_event_extract"]._sentiment.model == "local-test-model"


@pytest.mark.asyncio
async def test_finance_mcp_keeps_registry_validation_and_error_payloads(tmp_path):
    server = create_finance_server(tmp_path, MarketToolsConfig())
    invalid = await _call(server, "market_event_extract", {})
    assert invalid.isError is True
    assert invalid.structuredContent["error"]["type"] == "invalid_parameters"
    assert json.loads(invalid.content[0].text) == invalid.structuredContent

    unknown = await _call(server, "market_signal", {"symbol": "AAPL"})
    assert unknown.isError is True
    assert unknown.structuredContent["error"]["type"] == "tool_not_found"

    domain_error = await _call(server, "market_chip_distribution", {"symbol": "AAPL"})
    assert domain_error.isError is True
    assert "A-share" in domain_error.structuredContent["error"]


@pytest.mark.asyncio
async def test_finance_mcp_portfolio_calculation_and_missing_fx_contract(tmp_path):
    server = create_finance_server(tmp_path, MarketToolsConfig())
    arguments = {
        "baseCurrency": "CNY",
        "holdings": [
            {"symbol": "AAPL", "quantity": "10", "price": "200", "currency": "USD"},
            {"symbol": "0700.HK", "quantity": "100", "price": "400", "currency": "HKD"},
        ],
        "cash": [{"currency": "CNY", "amount": "10000"}],
        "fxRates": {"USD": {"rate": "7"}, "HKD": {"rate": "0.9"}},
    }
    calculated = await _call(server, "portfolio_risk", arguments)
    assert calculated.isError is False
    assert calculated.structuredContent["totalValue"] == "60000"
    assert json.loads(calculated.content[0].text) == calculated.structuredContent
    missing = await _call(server, "portfolio_risk", {**arguments, "fxRates": {}})
    assert missing.isError is True
    assert "totalValue" not in missing.structuredContent


@pytest.mark.asyncio
async def test_finance_mcp_applies_native_casts_and_reports_exceptions(tmp_path, monkeypatch):
    server = create_finance_server(tmp_path, MarketToolsConfig())
    result = await _call(
        server,
        "market_source_plan",
        {"symbols": ["600519"], "tasks": ["quote"], "includeCurrentTools": "false"},
    )
    assert result.isError is False
    assert result.structuredContent["market"] == "a-share"
    assert "currentMarketbotTools" not in result.structuredContent["tasks"][0]

    async def fail(self, **kwargs):
        raise RuntimeError("source plan failed")

    monkeypatch.setattr(MarketSourcePlanTool, "execute", fail)
    failed = await _call(server, "market_source_plan", {})
    assert failed.isError is True
    assert failed.structuredContent["error"]["type"] == "tool_exception"
    assert failed.structuredContent["error"]["message"] == "source plan failed"


def test_finance_mcp_uses_active_market_config_or_explicit_file(tmp_path, monkeypatch):
    monkeypatch.delenv(FINANCE_CONFIG_ENV, raising=False)
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps({"tools": {"market": {"enabled": False, "quoteSource": "mock"}}}),
        encoding="utf-8",
    )
    assert load_market_config(path).enabled is False
    assert load_market_config(path).quote_source == "mock"

    active = MarketToolsConfig(default_symbols=["600519"], quote_source="auto")
    monkeypatch.setenv(FINANCE_CONFIG_ENV, active.model_dump_json())
    assert load_market_config(path) == active

    monkeypatch.setenv(FINANCE_CONFIG_ENV, "invalid JSON")
    with pytest.raises(ValueError):
        load_market_config(path)


def test_finance_mcp_rejects_invalid_explicit_config(tmp_path, monkeypatch):
    monkeypatch.delenv(FINANCE_CONFIG_ENV, raising=False)
    with pytest.raises(ValueError, match="does not exist"):
        load_market_config(tmp_path / "missing.json")
    path = tmp_path / "invalid.json"
    path.write_text('{"tools": {"market": {"enabled": "bad"}}}', encoding="utf-8")
    with pytest.raises(ValueError):
        load_market_config(path)


def test_finance_mcp_derives_workspace_from_config_once(tmp_path, monkeypatch):
    monkeypatch.delenv(FINANCE_CONFIG_ENV, raising=False)
    configured_workspace = tmp_path / "research"
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps({
            "agents": {"defaults": {"workspace": str(configured_workspace)}},
            "tools": {"market": {"quoteSource": "mock"}},
        }),
        encoding="utf-8",
    )
    from marketbot.mcp import finance

    original_load = finance.load_config
    calls = []

    def record_load(config_path, **kwargs):
        calls.append(config_path)
        return original_load(config_path, **kwargs)

    monkeypatch.setattr(finance, "load_config", record_load)
    workspace, market_config = load_finance_settings(path)
    assert workspace == configured_workspace
    assert market_config.quote_source == "mock"
    assert calls == [path]

    active = MarketToolsConfig(enabled=False)
    monkeypatch.setenv(FINANCE_CONFIG_ENV, active.model_dump_json())
    overridden_workspace, market_config = load_finance_settings(path, tmp_path / "override")
    assert overridden_workspace == tmp_path / "override"
    assert market_config == active
    default_workspace, _ = load_finance_settings()
    assert default_workspace == (Path.home() / ".marketbot" / "workspace")


def test_finance_mcp_startup_error_keeps_stdout_and_settings_private(tmp_path):
    invalid_settings = json.dumps({"requestTimeoutS": "private-setting-value"})
    result = subprocess.run(
        [sys.executable, "-m", "marketbot.mcp.finance", "--workspace", str(tmp_path)],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, FINANCE_CONFIG_ENV: invalid_settings},
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 2
    assert result.stdout == ""
    assert FINANCE_CONFIG_ENV in result.stderr
    assert "private-setting-value" not in result.stderr


@pytest.mark.asyncio
@pytest.mark.parametrize("enabled", [True, False])
async def test_finance_mcp_stdio_initialize_list_and_offline_call(tmp_path, enabled):
    repo = Path(__file__).resolve().parents[1]
    config = MarketToolsConfig(
        enabled=enabled,
        quote_source="mock",
        news_sources=["mock"],
        social_sources=["mock"],
        macro_source="manual",
    )
    path = tmp_path / "client-config.json"
    path.write_text(
        json.dumps({"agents": {"defaults": {"workspace": str(tmp_path)}}}),
        encoding="utf-8",
    )
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "marketbot.mcp.finance", "--config", str(path)],
        env={FINANCE_CONFIG_ENV: config.model_dump_json(), "PYTHONPATH": str(repo)},
        cwd=tmp_path,
    )
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            initialized = await session.initialize()
            assert initialized.serverInfo.name == "marketbot-finance"
            listed = await session.list_tools()
            assert {tool.name for tool in listed.tools} == (READ_ONLY_TOOLS if enabled else set())
            result = await session.call_tool(
                "market_source_plan",
                {"symbols": ["600519"], "tasks": ["quote", "news"]},
            )
            assert result.isError is not enabled
            payload = json.loads(result.content[0].text)
            assert payload == result.structuredContent
            if enabled:
                assert payload["market"] == "a-share"
                assert [item["task"] for item in payload["tasks"]] == ["quote", "news"]
                assert payload["routingTelemetry"]["tool"] == "market_source_plan"
            else:
                assert payload["error"]["type"] == "tool_not_found"

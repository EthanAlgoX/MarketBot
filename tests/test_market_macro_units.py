"""Macro units and missing-data decisions must match the source observations."""

import json

import httpx
import pytest

from marketbot.agent.tools.market import MarketMacroTool
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market.services import MarketMacroService


def _transport(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def _response(request, values):
    return httpx.Response(200, json={"units": request.url.params["units"],
                                   "observations": [{"date": date, "value": value} for date, value in values]})


@pytest.mark.asyncio
async def test_cpi_requests_year_over_year_percent_change_instead_of_price_index(monkeypatch):
    requests = []

    def handler(request):
        requests.append(dict(request.url.params))
        value = "2.5" if request.url.params["units"] == "pc1" else "325.0"
        return _response(request, [("2026-08-01", value), ("2026-07-01", "2.7")])

    _transport(monkeypatch, handler)
    service = MarketMacroService(MarketToolsConfig(fred_api_key="fixture-key"))
    latest, delta, error = await service.fetch_fred_series("CPIAUCSL")
    assert requests[0]["units"] == "pc1"
    assert latest == 2.5
    assert delta == pytest.approx(-.2)
    assert error is None
    metadata = service.series_metadata("CPIAUCSL")
    assert metadata["units"] == "percent"
    assert metadata["transform"] == "pc1"
    assert metadata["deltaUnits"] == "percentage_points"
    assert metadata["observationDate"] == "2026-08-01"
    assert metadata["observedAt"] is None
    assert metadata["retrievedAt"] is not None


@pytest.mark.asyncio
async def test_complete_macro_risk_uses_transformed_cpi_and_explicit_units(monkeypatch):
    def handler(request):
        values = {"FEDFUNDS": "4.0", "CPIAUCSL": "2.5", "DGS10": "4.0"}
        return _response(request, [("2026-08-01", values[request.url.params["series_id"]])])

    _transport(monkeypatch, handler)
    tool = MarketMacroTool(MarketToolsConfig(fred_api_key="fixture-key"))
    result = json.loads(await tool.execute(indicators=["fedFunds", "cpi", "us10y"]))
    assert result["macroRisk"] == pytest.approx(.4861)
    assert result["regime"] == "neutral"
    assert result["macroRiskDataStatus"] == "complete"
    assert result["methodology"]["kind"] == "heuristic"
    cpi = next(row for row in result["indicators"] if row["name"] == "cpi")
    assert cpi["value"] == 2.5
    assert cpi["transform"] == "pc1"
    assert cpi["observationDate"] == "2026-08-01"
    assert cpi["delta"] is None  # one observation does not establish a zero change


@pytest.mark.asyncio
async def test_missing_risk_indicator_does_not_invent_constants(monkeypatch):
    def handler(request):
        value = "." if request.url.params["series_id"] == "DGS10" else "2.5"
        return _response(request, [("2026-08-01", value)])

    _transport(monkeypatch, handler)
    result = json.loads(await MarketMacroTool(MarketToolsConfig(fred_api_key="fixture-key")).execute(indicators=["fedFunds", "cpi", "us10y"]))
    assert result["macroRisk"] == .5
    assert result["regime"] == "unknown"
    assert result["macroRiskDataStatus"] == "insufficient_data"
    assert result["methodology"]["missingIndicators"] == ["us10y"]
    assert next(row for row in result["indicators"] if row["name"] == "us10y")["value"] is None


@pytest.mark.asyncio
async def test_partial_requested_indicators_do_not_imply_complete_macro_risk(monkeypatch):
    _transport(monkeypatch, lambda request: _response(request, [("2026-08-01", "4.0")]))
    result = json.loads(await MarketMacroTool(MarketToolsConfig(fred_api_key="fixture-key")).execute(indicators=["fedFunds"]))
    assert result["macroRisk"] == .5
    assert result["regime"] == "unknown"
    assert result["methodology"]["missingIndicators"] == ["cpi", "us10y"]


@pytest.mark.asyncio
@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", True, "1e400"])
async def test_nonfinite_fred_values_never_become_risk_inputs(monkeypatch, value):
    _transport(monkeypatch, lambda request: _response(request, [("2026-08-01", value)]))
    result = json.loads(await MarketMacroTool(MarketToolsConfig(fred_api_key="fixture-key")).execute(indicators=["fedFunds", "cpi", "us10y"]))
    assert result["regime"] == "unknown"
    assert result["macroRisk"] == .5
    assert all(row["value"] is None for row in result["indicators"])
    json.dumps(result, allow_nan=False)


@pytest.mark.asyncio
async def test_incorrect_fred_transformation_response_fails_closed(monkeypatch):
    _transport(monkeypatch, lambda request: httpx.Response(200, json={"units": "lin", "observations": [{"date": "2026-08-01", "value": "325.0"}]}))
    service = MarketMacroService(MarketToolsConfig(fred_api_key="fixture-key"))
    latest, delta, error = await service.fetch_fred_series("CPIAUCSL")
    assert latest is None and delta is None
    assert "transformation" in error


@pytest.mark.asyncio
async def test_cached_macro_metadata_and_transformation_survive_reconstruction(tmp_path, monkeypatch):
    requests = []

    def handler(request):
        requests.append(request)
        return _response(request, [("2026-08-01", "2.5"), ("2026-07-01", "2.7")])

    _transport(monkeypatch, handler)
    config = MarketToolsConfig(fred_api_key="fixture-key")
    first = MarketMacroService(config, tmp_path)
    await first.fetch_fred_series("CPIAUCSL")
    second = MarketMacroService(config, tmp_path)
    assert (await second.fetch_fred_series("CPIAUCSL"))[0] == 2.5
    assert second.series_metadata("CPIAUCSL") == first.series_metadata("CPIAUCSL")
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_invalid_patched_macro_values_do_not_escape_as_nan(monkeypatch):
    tool = MarketMacroTool(MarketToolsConfig(fred_api_key="fixture-key"))

    async def invalid(series_id):
        return float("nan"), float("inf"), None

    monkeypatch.setattr(tool, "_fetch_fred_series", invalid)
    result = json.loads(await tool.execute())
    assert result["regime"] == "unknown"
    assert result["macroRisk"] == .5
    json.dumps(result, allow_nan=False)

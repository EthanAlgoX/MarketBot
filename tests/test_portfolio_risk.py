"""Financial value, concentration, FX, and scenario invariants."""

import copy
import json
from decimal import Decimal, localcontext

import pytest

from marketbot.agent.tools.portfolio import PortfolioRiskTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.domain.market.portfolio import calculate_portfolio_risk

OBSERVED_AT = "2026-10-02T15:00:00+08:00"


def _holding(symbol="AAPL", quantity=10, price=200, currency="USD", **kwargs):
    return {
        "symbol": symbol, "quantity": quantity, "price": price, "currency": currency,
        "source": "supplied market snapshot", "observedAt": OBSERVED_AT,
        "priceType": "last", **kwargs,
    }


def _portfolio(**kwargs):
    inputs = {
        "holdings": [_holding(), _holding("0700.HK", 100, 400, "HKD")],
        "base_currency": "CNY",
        "cash": [{"currency": "CNY", "amount": 10000}],
        "fx_rates": {"USD": {"rate": "7", "source": "FX observation", "observedAt": OBSERVED_AT}, "HKD": {"rate": "0.9", "source": "FX observation", "observedAt": OBSERVED_AT}},
        **kwargs,
    }
    return calculate_portfolio_risk(**inputs)


def test_cross_currency_valuation_cash_and_concentration():
    result = _portfolio()

    assert result["ok"] is True
    assert result["totalValue"] == "60000"
    assert result["investedValue"] == "50000"
    assert result["cashValue"] == "10000"
    assert [row["valueBase"] for row in result["holdings"]] == ["14000", "36000"]
    assert [row["securityWeightPct"] for row in result["holdings"]] == ["28", "72"]
    assert result["concentration"]["securityHHI"] == "5968"
    assert result["concentration"]["largestHoldingSymbol"] == "00700.HK"
    assert result["concentration"]["largestHoldingWeightPct"] == "60"
    assert result["concentration"]["cashWeightPct"] == "16.666667"
    exposure = {row["currency"]: row["valueBase"] for row in result["concentration"]["currencyExposure"]}
    assert exposure == {"CNY": "10000", "HKD": "36000", "USD": "14000"}
    assert result["warnings"] == []


def test_missing_fx_never_returns_a_partial_total():
    result = _portfolio(fx_rates={"USD": {"rate": 7}})

    assert result["ok"] is False
    assert "totalValue" not in result
    assert "holdings" not in result
    assert any(issue["code"] == "missing_fx_rate" and issue["path"] == "fxRates.HKD" for issue in result["error"]["issues"])


@pytest.mark.parametrize("left,right", [
    ("AAPL", "aapl.US"), ("600519", "SH600519"), ("600519.SH", "600519.SS"),
    ("510300", "510300.SH"), ("513310", "513310.SS"),
    ("HK00700", "0700.HK"), ("BRK.B", "BRK-B"),
])
def test_duplicate_ticker_aliases_are_rejected(left, right):
    result = calculate_portfolio_risk([_holding(left), _holding(right)], "USD")

    assert result["ok"] is False
    assert "totalValue" not in result
    assert any(issue["code"] == "duplicate_symbol" for issue in result["error"]["issues"])


def test_decimal_values_are_exact_and_inputs_unchanged():
    holdings = [_holding(quantity="0.1", price="0.2")]
    original = copy.deepcopy(holdings)

    result = calculate_portfolio_risk(holdings, "USD")

    assert result["totalValue"] == "0.02"
    assert holdings == original
    assert result["holdings"][0]["source"] == "supplied market snapshot"
    assert result["holdings"][0]["observedAt"] == OBSERVED_AT
    assert result["holdings"][0]["priceType"] == "last"
    assert result["scenarios"] == []


def test_shock_is_an_explicit_assumption_and_cash_is_not_shocked():
    result = _portfolio(scenarios=[{"name": "Equity selloff", "shockPct": "-20"}, {"name": "Recovery assumption", "shockPct": 10}])

    downturn, upturn = result["scenarios"]
    assert downturn["stressedTotalValue"] == "50000"
    assert downturn["profitLoss"] == "-10000"
    assert downturn["loss"] == "10000"
    assert downturn["lossPct"] == "16.666667"
    assert downturn["hypothetical"] is True
    assert downturn["isForecast"] is False
    assert upturn["stressedTotalValue"] == "65000"
    assert upturn["loss"] == "0"
    assert result["cashValue"] == "10000"


def test_cash_only_portfolio_has_no_security_concentration_or_invented_statistics():
    result = calculate_portfolio_risk([], "CNY", cash=[{"currency": "CNY", "amount": "100"}])

    assert result["ok"] is True
    assert result["totalValue"] == "100"
    assert result["concentration"]["securityHHI"] is None
    assert result["concentration"]["effectiveSecurityCount"] is None
    assert result["concentration"]["cashWeightPct"] == "100"
    assert {"sharpeRatio", "correlation", "expectedReturn", "maxDrawdown"} <= set(result["unavailableMetrics"])
    assert "sharpeRatio" not in result


def test_zero_prices_require_a_positive_portfolio_value_and_are_disclosed():
    zero = calculate_portfolio_risk([_holding(price=0)], "USD")
    with_cash = calculate_portfolio_risk([_holding(price=0)], "USD", cash=[{"currency": "USD", "amount": 100}])

    assert zero["ok"] is False
    assert zero["error"]["issues"][0]["code"] == "zero_total_value"
    assert "totalValue" not in zero
    assert with_cash["totalValue"] == "100"
    assert with_cash["holdings"][0]["valueBase"] == "0"
    assert any("price is zero" in warning for warning in with_cash["warnings"])


@pytest.mark.parametrize("field,value", [
    ("quantity", 0), ("quantity", -1), ("quantity", True),
    ("price", float("nan")), ("price", float("inf")), ("price", "-Infinity"),
    ("price", "not a price"), ("price", None), ("priceType", []), ("priceType", {}),
    ("observedAt", "2026-10-02T15:00:00"), ("observedAt", "yesterday"),
])
def test_invalid_financial_inputs_fail_without_partial_results(field, value):
    result = calculate_portfolio_risk([_holding(**{field: value})], "USD")

    assert result["ok"] is False
    assert result["error"]["issues"]
    assert "totalValue" not in result
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("rate", [0, -1, True, float("nan"), "Infinity"])
def test_invalid_fx_rates_fail_without_a_total(rate):
    result = calculate_portfolio_risk([_holding()], "CNY", fx_rates={"USD": {"rate": rate}})

    assert result["ok"] is False
    assert "totalValue" not in result
    json.dumps(result, allow_nan=False)


def test_inverted_base_currency_rate_is_rejected():
    result = calculate_portfolio_risk([_holding()], "USD", fx_rates={"USD": {"rate": "0.9"}})

    assert result["ok"] is False
    assert any(issue["code"] == "invalid_base_fx_rate" for issue in result["error"]["issues"])


@pytest.mark.parametrize("shock", [None, -101, 101, True, "NaN", "0.12345678901234567890123456789"])
def test_invalid_shocks_fail_instead_of_dropping_a_scenario(shock):
    result = _portfolio(scenarios=[{"name": "bad assumption", "shockPct": shock}])

    assert result["ok"] is False
    assert "totalValue" not in result
    assert any(issue["code"] == "invalid_shock" for issue in result["error"]["issues"])


def test_missing_provenance_is_disclosed_and_no_timestamp_is_fabricated():
    result = calculate_portfolio_risk([{"symbol": "AAPL", "quantity": 1, "price": 10, "currency": "USD"}], "USD")

    assert result["ok"] is True
    assert result["holdings"][0]["source"] is None
    assert result["holdings"][0]["observedAt"] is None
    assert {"holdings[0].source", "holdings[0].observedAt"} <= set(result["missingData"])
    assert any("freshness is unknown" in warning for warning in result["warnings"])


def test_extreme_supported_decimals_are_stable_and_do_not_overflow():
    big = "9999999999999999999999999999E28"
    tiny = "1E-28"
    result = calculate_portfolio_risk(
        [_holding("AAPL", big, big, "USD"), _holding("0700.HK", tiny, tiny, "HKD")],
        "CNY", cash=[{"currency": "CNY", "amount": tiny}],
        fx_rates={"USD": {"rate": big}, "HKD": {"rate": tiny}},
        scenarios=[{"name": "explicit precise shock", "shockPct": "-0.1234567890123456789012345678"}],
    )

    assert result["ok"] is True
    with localcontext() as context:
        context.prec = 400
        expected = Decimal(big) ** 3 + Decimal(tiny) ** 3 + Decimal(tiny)
        assert Decimal(result["totalValue"]) == expected
    assert result["scenarios"][0]["loss"] != "0"
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("value", ["1E100", "1E-100", "9" * 29])
def test_unsupported_decimal_range_is_a_structured_error(value):
    result = calculate_portfolio_risk([_holding(price=value)], "USD")

    assert result["ok"] is False
    assert any(issue["code"] == "number_out_of_range" for issue in result["error"]["issues"])
    assert "totalValue" not in result


async def test_tool_registry_keeps_decimal_strings_and_returns_structured_errors():
    registry = ToolRegistry()
    registry.register(PortfolioRiskTool(config=object()))

    valid = json.loads(await registry.execute("portfolio_risk", {"holdings": [_holding(quantity="0.1", price="0.2")], "baseCurrency": "USD"}))
    invalid = json.loads(await registry.execute("portfolio_risk", {"holdings": [_holding(price="NaN")], "baseCurrency": "USD"}))

    assert valid["totalValue"] == "0.02"
    assert invalid["ok"] is False
    assert "totalValue" not in invalid

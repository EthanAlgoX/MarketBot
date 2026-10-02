"""Deterministic long-only portfolio valuation and scenario sensitivity.

Inputs are supplied observations, not market data fetched or verified here.
Money uses Decimal throughout; no time-series risk statistics are inferred.
"""

from __future__ import annotations

import re
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
from typing import Any

ZERO = Decimal("0")
ONE = Decimal("1")
HUNDRED = Decimal("100")
HHI_SCALE = Decimal("10000")
DISPLAY_PRECISION = Decimal("0.000001")
PRICE_TYPES = {"market", "last", "close", "estimate", "manual", "unspecified"}


def canonical_symbol(symbol: str) -> str:
    """Resolve common A-share/HK/US aliases without guessing company names."""
    value = symbol.strip().upper()
    prefix = re.fullmatch(r"(SH|SZ|BJ)(\d{6})", value)
    if prefix:
        return f"{prefix[2]}.{prefix[1]}"
    suffix = re.fullmatch(r"(\d{6})\.(SH|SS|SZ|BJ)", value)
    if suffix:
        return f"{suffix[1]}.{'SH' if suffix[2] == 'SS' else suffix[2]}"
    if re.fullmatch(r"\d{6}", value):
        # Match the Shanghai ETF prefixes supported by the native quote service.
        shanghai_etf = ("510", "511", "512", "513", "515", "518", "520", "560", "580")
        exchange = "SH" if value.startswith(("6", *shanghai_etf)) else "BJ" if value.startswith(("4", "8", "9")) else "SZ"
        return f"{value}.{exchange}"
    hong_kong = re.fullmatch(r"(?:HK)?(\d{1,5})(?:\.HK)?", value)
    if hong_kong:
        return f"{hong_kong[1].zfill(5)}.HK"
    if re.fullmatch(r"[A-Z]{1,6}\.US", value):
        return value[:-3]
    if value in {"BRK-B", "BRK/B"}:
        return "BRK.B"
    if value in {"BRK-A", "BRK/A"}:
        return "BRK.A"
    return value


def _money(value: Decimal) -> str:
    """Serialize a decimal without binary floats or rounding monetary values."""
    if not value:
        return "0"
    return format(value, "f").rstrip("0").rstrip(".") if value.as_tuple().exponent < 0 else format(value, "f")


def _metric(value: Decimal) -> str:
    return _money(value.quantize(DISPLAY_PRECISION, rounding=ROUND_HALF_UP))


class _Inputs:
    def __init__(self) -> None:
        self.issues: list[dict[str, str]] = []
        self.warnings: list[str] = []
        self.missing_data: list[str] = []

    def issue(self, code: str, path: str, message: str) -> None:
        self.issues.append({"code": code, "path": path, "message": message})

    def number(self, value: Any, path: str, *, positive: bool = False) -> Decimal | None:
        if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
            self.issue("invalid_number", path, "Use a finite number or decimal string.")
            return None
        try:
            text = str(value).strip()
            number = Decimal(text)
        except (InvalidOperation, ValueError):
            self.issue("invalid_number", path, "Use a finite number or decimal string.")
            return None
        if not number.is_finite():
            self.issue("invalid_number", path, "NaN and infinity are not valid financial inputs.")
            return None
        if len(number.as_tuple().digits) > 28 or abs(number.as_tuple().exponent) > 28:
            self.issue("number_out_of_range", path, "Use at most 28 significant digits and an exponent between -28 and 28.")
            return None
        if number < ZERO or (positive and number == ZERO):
            self.issue("invalid_number", path, "Value must be positive." if positive else "Value cannot be negative.")
            return None
        return number

    def currency(self, value: Any, path: str) -> str | None:
        if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z]{3}", value.strip()):
            self.issue("invalid_currency", path, "Use a three-letter currency code, such as CNY or USD.")
            return None
        return value.strip().upper()

    def provenance(self, row: dict[str, Any], path: str, label: str) -> dict[str, Any]:
        source = row.get("source")
        observed_at = row.get("observedAt")
        if source is not None and not isinstance(source, str):
            self.issue("invalid_source", f"{path}.source", "Source must be a string.")
        if not source or (isinstance(source, str) and not source.strip()):
            self.missing_data.append(f"{path}.source")
            self.warnings.append(f"{label}: source not provided; provenance is unverified.")
        if observed_at is None or observed_at == "":
            self.missing_data.append(f"{path}.observedAt")
            self.warnings.append(f"{label}: observation time not provided; freshness is unknown.")
        elif not isinstance(observed_at, str):
            self.issue("invalid_timestamp", f"{path}.observedAt", "Use an ISO-8601 timestamp with a timezone.")
        else:
            try:
                timestamp = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    raise ValueError("timezone missing")
            except ValueError:
                self.issue("invalid_timestamp", f"{path}.observedAt", "Use an ISO-8601 timestamp with a timezone.")
        return {"source": source.strip() if isinstance(source, str) else None, "observedAt": observed_at or None}


def calculate_portfolio_risk(
    holdings: Any,
    base_currency: Any,
    *,
    cash: Any = None,
    fx_rates: Any = None,
    scenarios: Any = None,
) -> dict[str, Any]:
    """Validate all inputs before producing a complete portfolio valuation.

    FX rates are base currency units per one unit of the input currency.
    Uniform scenarios shock security prices only; FX and cash remain fixed.
    """
    inputs = _Inputs()
    base = inputs.currency(base_currency, "baseCurrency")
    if not isinstance(holdings, list) or len(holdings) > 100:
        inputs.issue("invalid_holdings", "holdings", "Holdings must be an array containing at most 100 positions.")
        holdings = []
    if cash is None:
        cash = []
    if not isinstance(cash, list) or len(cash) > 100:
        inputs.issue("invalid_cash", "cash", "Cash must be an array containing at most 100 balances.")
        cash = []
    if fx_rates is None:
        fx_rates = {}
    if not isinstance(fx_rates, dict) or len(fx_rates) > 100:
        inputs.issue("invalid_fx_rates", "fxRates", "FX rates must map currency codes to rate objects (at most 100).")
        fx_rates = {}
    if scenarios is None:
        scenarios = []
    if not isinstance(scenarios, list) or len(scenarios) > 20:
        inputs.issue("invalid_scenarios", "scenarios", "Scenarios must be an array containing at most 20 scenarios.")
        scenarios = []

    normalized_holdings: list[dict[str, Any]] = []
    seen_symbols: set[str] = set()
    for index, row in enumerate(holdings):
        path = f"holdings[{index}]"
        if not isinstance(row, dict):
            inputs.issue("invalid_holding", path, "Each holding must be an object.")
            continue
        symbol = row.get("symbol")
        if not isinstance(symbol, str) or not re.fullmatch(r"[A-Za-z0-9^][A-Za-z0-9._^=:/-]{0,39}", symbol.strip()):
            inputs.issue("invalid_symbol", f"{path}.symbol", "Provide an exchange-qualified ticker, not a company name.")
            clean_symbol = ""
        else:
            clean_symbol = canonical_symbol(symbol)
            if clean_symbol in seen_symbols:
                inputs.issue("duplicate_symbol", f"{path}.symbol", f"Duplicate holding or ticker alias: {clean_symbol}. Aggregate its lots explicitly first.")
            seen_symbols.add(clean_symbol)
        quantity = inputs.number(row.get("quantity"), f"{path}.quantity", positive=True)
        price = inputs.number(row.get("price"), f"{path}.price")
        currency = inputs.currency(row.get("currency"), f"{path}.currency")
        provenance = inputs.provenance(row, path, clean_symbol or path)
        price_type = row.get("priceType", "unspecified")
        if not isinstance(price_type, str) or price_type not in PRICE_TYPES:
            inputs.issue("invalid_price_type", f"{path}.priceType", f"Use one of: {', '.join(sorted(PRICE_TYPES))}.")
        elif price_type in {"estimate", "manual", "unspecified"}:
            inputs.warnings.append(f"{clean_symbol or path}: price type is {price_type}; valuation does not establish a verified live quote.")
        if price == ZERO:
            inputs.warnings.append(f"{clean_symbol or path}: supplied price is zero; verify the observation before relying on this valuation.")
        if quantity is not None and price is not None and currency and clean_symbol:
            normalized_holdings.append({
                "symbol": clean_symbol, "inputSymbol": symbol, "quantity": quantity,
                "price": price, "currency": currency, "priceType": price_type, **provenance,
            })

    normalized_cash: list[dict[str, Any]] = []
    for index, row in enumerate(cash):
        path = f"cash[{index}]"
        if not isinstance(row, dict):
            inputs.issue("invalid_cash_balance", path, "Each cash balance must be an object.")
            continue
        currency = inputs.currency(row.get("currency"), f"{path}.currency")
        amount = inputs.number(row.get("amount"), f"{path}.amount")
        if currency and amount is not None:
            normalized_cash.append({"currency": currency, "amount": amount})

    normalized_fx: dict[str, dict[str, Any]] = {}
    for raw_currency, row in fx_rates.items():
        path = f"fxRates.{raw_currency}"
        currency = inputs.currency(raw_currency, path)
        if not isinstance(row, dict):
            inputs.issue("invalid_fx_rate", path, "Each FX entry must be an object containing rate, with optional source and observedAt.")
            continue
        rate = inputs.number(row.get("rate"), f"{path}.rate", positive=True)
        provenance = inputs.provenance(row, path, f"FX {currency or raw_currency}")
        if currency in normalized_fx:
            inputs.issue("duplicate_fx_currency", path, "Currency codes are case-insensitive; supply one FX entry per currency.")
        if base and currency == base and rate is not None and rate != ONE:
            inputs.issue("invalid_base_fx_rate", f"{path}.rate", "Base-currency FX rate must equal 1.")
        if currency and rate is not None:
            normalized_fx[currency] = {"rate": rate, **provenance}
    if base and base not in normalized_fx:
        normalized_fx[base] = {"rate": ONE, "source": "base currency identity", "observedAt": None}
    currencies = {row["currency"] for row in [*normalized_holdings, *normalized_cash]}
    for currency in sorted(currencies):
        if currency not in normalized_fx:
            inputs.issue("missing_fx_rate", f"fxRates.{currency}", f"Provide units of {base or 'base currency'} per 1 {currency}; currencies cannot be added directly.")

    normalized_scenarios: list[dict[str, Any]] = []
    scenario_names: set[str] = set()
    for index, row in enumerate(scenarios):
        path = f"scenarios[{index}]"
        if not isinstance(row, dict):
            inputs.issue("invalid_scenario", path, "Each scenario must contain name and an explicit shockPct.")
            continue
        name = row.get("name")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            inputs.issue("invalid_scenario_name", f"{path}.name", "Provide a nonempty scenario name up to 100 characters.")
            continue
        name = name.strip()
        if name.lower() in scenario_names:
            inputs.issue("duplicate_scenario", f"{path}.name", "Scenario names must be unique.")
        scenario_names.add(name.lower())
        # Shocks may be negative, unlike prices, quantities, and FX rates.
        raw_shock = row.get("shockPct")
        try:
            if isinstance(raw_shock, bool) or not isinstance(raw_shock, (str, int, float, Decimal)):
                raise ValueError("invalid shock")
            shock = Decimal(str(raw_shock).strip())
            if not shock.is_finite() or len(shock.as_tuple().digits) > 28 or abs(shock.as_tuple().exponent) > 28 or not -HUNDRED <= shock <= HUNDRED:
                raise ValueError("invalid shock")
        except (InvalidOperation, ValueError):
            inputs.issue("invalid_shock", f"{path}.shockPct", "Supply a finite percentage between -100 and 100; -20 means a 20% price decline.")
            continue
        normalized_scenarios.append({"name": name, "shockPct": shock})

    if not holdings and not cash:
        inputs.issue("empty_portfolio", "holdings", "Provide at least one holding or cash balance.")
    if inputs.issues:
        return _error_result(inputs)

    with localcontext() as context:
        # Preserve exact monetary sums/products across the supported input range.
        context.prec = 320
        return _calculate(inputs, normalized_holdings, normalized_cash, normalized_fx, normalized_scenarios, base)


def _error_result(inputs: _Inputs) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {
            "type": "invalid_portfolio",
            "message": "Complete, valid holdings and exchange rates are required; no partial portfolio total was calculated.",
            "issues": inputs.issues,
        },
        "warnings": inputs.warnings,
        "missingData": inputs.missing_data,
    }


def _calculate(
    inputs: _Inputs,
    holdings: list[dict[str, Any]],
    cash: list[dict[str, Any]],
    fx: dict[str, dict[str, Any]],
    scenarios: list[dict[str, Any]],
    base: str,
) -> dict[str, Any]:
    invested_value = ZERO
    cash_value = ZERO
    currency_values: dict[str, Decimal] = {}
    for row in holdings:
        row["localValue"] = row["quantity"] * row["price"]
        row["fxRate"] = fx[row["currency"]]["rate"]
        row["valueBase"] = row["localValue"] * row["fxRate"]
        invested_value += row["valueBase"]
        currency_values[row["currency"]] = currency_values.get(row["currency"], ZERO) + row["valueBase"]
    for row in cash:
        row["fxRate"] = fx[row["currency"]]["rate"]
        row["valueBase"] = row["amount"] * row["fxRate"]
        cash_value += row["valueBase"]
        currency_values[row["currency"]] = currency_values.get(row["currency"], ZERO) + row["valueBase"]
    total = invested_value + cash_value
    if total == ZERO:
        inputs.issue("zero_total_value", "holdings", "Portfolio value is zero; weights and concentration are undefined.")
        return _error_result(inputs)
    for row in holdings:
        row["weightPct"] = _metric(row["valueBase"] / total * HUNDRED)
        row["securityWeightPct"] = _metric(row["valueBase"] / invested_value * HUNDRED) if invested_value else None
    for row in cash:
        row["weightPct"] = _metric(row["valueBase"] / total * HUNDRED)
    ranked = sorted(holdings, key=lambda row: row["valueBase"], reverse=True)
    hhi = sum((row["valueBase"] / invested_value) ** 2 for row in holdings) * HHI_SCALE if invested_value else None
    stress_results = []
    for scenario in scenarios:
        shock = scenario["shockPct"]
        pnl = invested_value * shock / HUNDRED
        stressed_total = total + pnl
        loss = max(ZERO, -pnl)
        stress_results.append({
            "name": scenario["name"], "shockPct": _money(shock),
            "hypothetical": True, "isForecast": False,
            "assumption": "Uniform user-specified price change across all securities; cash and FX rates remain fixed.",
            "stressedTotalValue": _money(stressed_total), "profitLoss": _money(pnl),
            "loss": _money(loss), "lossPct": _metric(loss / total * HUNDRED),
            "portfolioChangePct": _metric(pnl / total * HUNDRED),
        })
    return {
        "ok": True,
        "baseCurrency": base,
        "totalValue": _money(total), "investedValue": _money(invested_value), "cashValue": _money(cash_value),
        "holdings": [_serialize_decimals(row) for row in holdings],
        "cash": [_serialize_decimals(row) for row in cash],
        "fxRates": {currency: _serialize_decimals(fx[currency]) for currency in sorted(currency_values)},
        "concentration": {
            "securityHHI": _metric(hhi) if hhi is not None else None,
            "effectiveSecurityCount": _metric(HHI_SCALE / hhi) if hhi else None,
            "largestHoldingSymbol": ranked[0]["symbol"] if ranked and invested_value else None,
            "largestHoldingWeightPct": ranked[0]["weightPct"] if ranked and invested_value else "0",
            "top3HoldingWeightPct": _metric(sum((row["valueBase"] for row in ranked[:3]), ZERO) / total * HUNDRED),
            "cashWeightPct": _metric(cash_value / total * HUNDRED),
            "currencyExposure": [{"currency": currency, "valueBase": _money(value), "weightPct": _metric(value / total * HUNDRED)} for currency, value in sorted(currency_values.items())],
        },
        "scenarios": stress_results,
        "methodology": {
            "arithmetic": "Decimal with 320-digit calculation precision; inputs up to 28 significant digits and exponents -28 to 28; amounts serialized as decimal strings; displayed percentages and concentration rounded to 6 decimal places.",
            "fxConvention": "Base currency units per one input-currency unit; base currency rate is 1.",
            "weights": "Portfolio weights include cash; security weights and securityHHI exclude cash.",
            "concentration": "securityHHI = 10000 * sum(securityWeight^2); effectiveSecurityCount = 10000 / securityHHI. These measure concentration, not forecast losses.",
            "currencyExposure": "Exposure by supplied denomination, including cash; no issuer look-through or hedge adjustments.",
            "scenarios": "Explicit user assumptions only; uniform price shock, fixed cash and FX; hypothetical sensitivity, not prediction.",
            "provenance": "Sources and observation times are supplied by the caller and preserved, not independently verified; observation time is not retrieval time.",
        },
        "unavailableMetrics": ["expectedReturn", "annualizedVolatility", "sharpeRatio", "correlation", "maxDrawdown"],
        "warnings": inputs.warnings,
        "missingData": inputs.missing_data,
    }


def _serialize_decimals(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _money(value) if isinstance(value, Decimal) else value for key, value in row.items()}

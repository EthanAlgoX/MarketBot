"""Read-only, network-free portfolio risk calculation tool."""

from __future__ import annotations

import json
from typing import Any

from marketbot.agent.tools.base import Tool
from marketbot.domain.market.portfolio import calculate_portfolio_risk

DECIMAL_NUMBER = {
    "anyOf": [{"type": "number"}, {"type": "string", "minLength": 1}],
    "description": "Finite number or decimal string; decimal strings preserve input precision.",
}
PROVENANCE_FIELDS = {
    "source": {"type": "string", "description": "Origin of this supplied observation, e.g. a native market tool, public quote, or broker statement."},
    "observedAt": {"type": "string", "description": "Actual observation time as ISO-8601 with timezone. Omit if unknown; do not substitute current retrieval time."},
}


class PortfolioRiskTool(Tool):
    name = "portfolio_risk"
    description = (
        "Calculate long-only holdings and cash value, portfolio weights, security concentration, "
        "currency exposure, and explicitly supplied hypothetical price shocks with Decimal arithmetic. "
        "Fetch prices with native/MCP tools first. Requires complete quantities, prices, currencies, "
        "and foreign exchange rates; never adds different currencies directly. No network or writes. "
        "Does not infer Sharpe ratio, correlations, returns, volatility, or historical drawdown."
    )
    parameters = {
        "type": "object",
        "properties": {
            "holdings": {
                "type": "array", "maxItems": 100,
                "description": "At most 100 distinct long-only positions. Aggregate duplicate lots yourself. Weights-only inputs are not supported.",
                "items": {
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string", "minLength": 1, "maxLength": 40},
                        "quantity": {**DECIMAL_NUMBER, "description": "Positive shares or units; fractional units allowed."},
                        "price": {**DECIMAL_NUMBER, "description": "Nonnegative supplied unit price in the stated currency."},
                        "currency": {"type": "string", "minLength": 3, "maxLength": 3},
                        "priceType": {"type": "string", "enum": ["market", "last", "close", "estimate", "manual", "unspecified"]},
                        **PROVENANCE_FIELDS,
                    },
                    "required": ["symbol", "quantity", "price", "currency"],
                },
            },
            "baseCurrency": {"type": "string", "minLength": 3, "maxLength": 3, "description": "Explicit three-letter currency for portfolio totals."},
            "cash": {
                "type": "array", "maxItems": 100,
                "items": {"type": "object", "properties": {"currency": {"type": "string", "minLength": 3, "maxLength": 3}, "amount": {**DECIMAL_NUMBER, "description": "Nonnegative cash balance."}}, "required": ["currency", "amount"]},
            },
            "fxRates": {
                "type": "object",
                "description": "Map each foreign currency to {rate, source?, observedAt?}. Rate is baseCurrency units per 1 foreign-currency unit; base currency is automatically 1.",
                "additionalProperties": {"type": "object", "properties": {"rate": {**DECIMAL_NUMBER, "description": "Positive base-currency amount per one unit of this currency."}, **PROVENANCE_FIELDS}, "required": ["rate"]},
            },
            "scenarios": {
                "type": "array", "maxItems": 20,
                "description": "User-defined hypothetical uniform security-price shocks; cash and FX unchanged. No default scenarios or forecasts are invented.",
                "items": {"type": "object", "properties": {"name": {"type": "string", "minLength": 1, "maxLength": 100}, "shockPct": {**DECIMAL_NUMBER, "description": "Explicit percentage between -100 and 100; -20 means prices decline 20%."}}, "required": ["name", "shockPct"]},
            },
        },
        "required": ["holdings", "baseCurrency"],
    }

    def __init__(self, config: Any = None):
        """Accept the legacy market-tool loader's config without depending on it."""

    async def execute(
        self,
        holdings: list[dict[str, Any]],
        baseCurrency: str,
        cash: list[dict[str, Any]] | None = None,
        fxRates: dict[str, dict[str, Any]] | None = None,
        scenarios: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> str:
        result = calculate_portfolio_risk(holdings, baseCurrency, cash=cash, fx_rates=fxRates, scenarios=scenarios)
        return json.dumps(result, ensure_ascii=False, allow_nan=False)

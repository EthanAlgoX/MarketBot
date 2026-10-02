"""Deterministic acceptance scenarios for the complete financial research workflow.

Run with ``python scripts/evaluate_finance.py --output result.json``. Fixtures are
illustrative, not actual prices or a benchmark of financial/LLM performance.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Also runnable from an unpacked repository without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from marketbot.agent.tools.finance_evidence import capture_finance_result  # noqa: E402
from marketbot.agent.tools.registry import ToolRegistry  # noqa: E402
from marketbot.config.schema import MarketToolsConfig  # noqa: E402
from marketbot.domain.market.evidence import EvidenceStore  # noqa: E402
from marketbot.domain.market.plugin import create_market_tools  # noqa: E402


async def evaluate(workspace: Path) -> dict:
    registry = ToolRegistry()
    for tool in create_market_tools(MarketToolsConfig(), workspace):
        registry.register(tool)
    checks = []

    def check(name, passed, **details):
        checks.append({"scenario": name, "passed": bool(passed), **details})

    async def call(tool_name, **arguments):
        return json.loads(await registry.execute(tool_name, arguments))

    now = datetime.now(UTC)
    stamp = now.isoformat()
    portfolio = dict(
        holdings=[{"symbol": "AAPL", "quantity": "10", "price": "200", "currency": "USD"},
                  {"symbol": "0700.HK", "quantity": "100", "price": "400", "currency": "HKD"}],
        baseCurrency="CNY", cash=[{"currency": "CNY", "amount": "10000"}],
        fxRates={"USD": {"rate": "7"}, "HKD": {"rate": "0.9"}},
        scenarios=[{"name": "assumed selloff", "shockPct": "-20"}],
    )
    risk = await call("portfolio_risk", **portfolio)
    check("cross_market_fx_cash_and_uniform_stress", risk.get("totalValue") == "60000" and risk["scenarios"][0]["stressedTotalValue"] == "50000", totalValue=risk.get("totalValue"))
    missing = await call("portfolio_risk", **{**portfolio, "fxRates": {"USD": {"rate": "7"}}})
    check("missing_fx_never_produces_partial_valuation", missing.get("ok") is False and "totalValue" not in missing)
    duplicate = await call("portfolio_risk", baseCurrency="USD", holdings=[{"symbol": s, "quantity": 1, "price": 100, "currency": "USD"} for s in ("AAPL", "AAPL.US")])
    check("ticker_alias_cannot_double_count_positions", duplicate.get("ok") is False)
    precise = await call("portfolio_risk", baseCurrency="USD", holdings=[{"symbol": "AAPL", "quantity": "0.1", "price": "0.2", "currency": "USD"}])
    check("fractional_shares_use_decimal_arithmetic", precise.get("totalValue") == "0.02")

    def quote(price, observed_at=stamp):
        raw = {"symbol": "AAPL", "price": str(price), "currency": "USD", "provider": "evaluation_fixture", "observedAt": observed_at, "priceType": "as-of"}
        captured = json.loads(capture_finance_result(workspace, "market_snapshot", json.dumps({"asOf": stamp, "source": "evaluation_fixture", "symbols": ["AAPL"], "quotes": [raw]})))
        row = captured["quotes"][0]
        return row, row["evidenceId"]

    raw, evidence_id = quote(100)
    got = await call("evidence_get", evidenceId=evidence_id)
    check("tool_facts_are_retrievable_and_digest_verified", got.get("found") and got["evidence"]["payload"]["price"] == "100" and EvidenceStore(workspace).verify(evidence_id))
    thesis = await call("thesis_tracker", action="create", symbol="AAPL", thesis="Example hypothesis: price remains above 95", confidence=0,
                        rules=[{"id": "support", "metric": "price", "operator": "lt", "threshold": "95", "effect": "falsified", "maxAgeSeconds": 3600}])
    thesis_id = thesis["thesis"]["id"]
    check("zero_confidence_survives_storage", thesis["thesis"]["confidence"] == 0)
    sentiment = await call("thesis_tracker", action="update", thesisId=thesis_id, evidence="Terrible news, demand collapsed and sentiment is negative")
    check("negative_sentiment_cannot_falsify_hypothesis", sentiment["verdict"] == "unchanged" and sentiment["thesis"]["status"] == "active")
    forged = await call("thesis_tracker", action="review", thesisId=thesis_id, observations=[{"metric": "price", "evidenceId": evidence_id, "jsonPointer": "/price", "value": "90"}])
    check("real_evidence_id_cannot_authorize_forged_value", forged.get("verificationStatus") == "inconclusive" and forged["thesis"]["status"] == "active")
    unknown, unknown_id = quote(90, None)
    unknown_review = await call("thesis_tracker", action="review", thesisId=thesis_id, observations=[{"metric": "price", "evidenceId": unknown_id, "jsonPointer": "/price"}])
    check("retrieval_time_cannot_replace_observation_time", unknown_review.get("verificationStatus") == "inconclusive" and unknown_review.get("verdict") == "unchanged")
    _, invalidating_id = quote(90)
    verified = await call("thesis_tracker", action="review", thesisId=thesis_id, observations=[{"metric": "price", "evidenceId": invalidating_id, "jsonPointer": "/price"}])
    check("fresh_recorded_fact_can_falsify_explicit_rule", verified.get("verdict") == "falsified" and verified.get("decisionSource") == "rule_verified" and verified["thesis"]["confidence"] == 0)

    saved = await call("market_watch", action="save", name="Evaluation watch", symbols=["AAPL"], rules=[{"type": "price_change", "thresholdPct": "5"}], maxAgeSeconds=3600)
    watch_id = saved["watch"]["watchId"]
    def observation(price, observed_at=stamp):
        row, reference = quote(price, observed_at)
        return {"symbol": row["symbol"], "price": row["price"], "currency": row["currency"], "source": row["provider"], "observedAt": row["observedAt"], "evidenceIds": [reference]}
    baseline = await call("market_watch", action="evaluate", watchId=watch_id, observations=[observation(100)], asOf=stamp)
    check("first_watch_observation_is_quiet", baseline.get("status") == "baseline_established" and not baseline["alerts"])
    below = await call("market_watch", action="evaluate", watchId=watch_id, observations=[observation(104)], asOf=stamp)
    check("below_threshold_changes_are_quiet", not below["alerts"])
    crossed = await call("market_watch", action="evaluate", watchId=watch_id, observations=[observation(105)], asOf=stamp)
    repeated = await call("market_watch", action="evaluate", watchId=watch_id, observations=[observation(110)], asOf=stamp)
    check("threshold_episode_alerts_once", len(crossed["alerts"]) == 1 and not repeated["alerts"])
    before = (await call("market_watch", action="get", watchId=watch_id))["watch"]["state"]["baselinePrices"]
    stale_stamp = (now - timedelta(days=2)).isoformat()
    stale = await call("market_watch", action="evaluate", watchId=watch_id, observations=[observation(200, stale_stamp)], asOf=stamp)
    after = (await call("market_watch", action="get", watchId=watch_id))["watch"]["state"]["baselinePrices"]
    check("stale_watch_data_cannot_advance_baseline", stale.get("status") == "data_gap" and before == after)
    outbox = await call("market_watch", action="outbox", watchId=watch_id)
    for alert in outbox["alerts"]:
        await call("market_watch", action="ack", alertId=alert["alertId"])
    check("acknowledged_local_alerts_do_not_redeliver", not (await call("market_watch", action="outbox", watchId=watch_id))["alerts"])
    return {"evaluation": "financial_workflow_acceptance", "generatedAt": datetime.now(UTC).isoformat(), "data": "illustrative deterministic fixtures", "passed": sum(c["passed"] for c in checks), "total": len(checks), "checks": checks,
            "limitations": ["Does not measure real LLM output quality or provider accuracy", "Does not backtest returns or execute trades", "External channel delivery is tested with isolated mocks"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="marketbot-evaluation-") as directory:
        result = asyncio.run(evaluate(Path(directory)))
    rendered = json.dumps(result, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    raise SystemExit(0 if result["passed"] == result["total"] else 1)


if __name__ == "__main__":
    main()

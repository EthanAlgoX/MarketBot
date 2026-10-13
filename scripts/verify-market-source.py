#!/usr/bin/env python3
"""Fetch actual public BTC daily bars and run isolated, model-free rule audits."""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import secrets
import sys
import re
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "services/financial-engine"
sys.path.insert(0, str(ENGINE))


def private_json(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def package_version(name):
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retained-verify", type=Path,
                        help="Use an explicitly retained, project-owned verification account, never the development account")
    args = parser.parse_args()
    retained = None
    if args.retained_verify:
        candidate = args.retained_verify.absolute()
        if candidate.is_symlink() or candidate.parent.resolve() != (ROOT / ".local/verify").resolve():
            raise RuntimeError("Retained source audit requires a project-owned verification directory")
        owner = json.loads((candidate / "owner.json").read_text())
        access = json.loads((candidate / "access.json").read_text())
        if (owner["root"] != str(ROOT) or not re.fullmatch(r"finance_verify_[0-9a-f]{16}", owner["databaseName"])
                or not Path(owner["env"]["DATABASE_PATH"]).resolve().is_relative_to(candidate.resolve())
                or any(urlparse(access[key]).hostname != "127.0.0.1" for key in ("apiUrl", "financeUrl", "webUrl"))
                or owner["env"].get("FINANCIAL_SIMULATION_ENABLED") != "true"
                or owner["env"].get("FINANCIAL_CN_SIMULATION_ENABLED") != "false"):
            raise RuntimeError("Retained verification ownership or crypto-only gate is invalid")
        retained = (owner, access)

    def rpc(name, body):
        owner, access = retained
        request = Request(access["apiUrl"] + "/rpc/finance/" + name,
                          data=json.dumps({"json": body}).encode(),
                          headers={"content-type": "application/json", "cookie": access["alice"]["cookie"],
                                   "origin": access["webUrl"]})
        with urlopen(request, timeout=20) as response:
            return json.load(response)["json"]
    folder = ROOT / ".local/source-audit" / secrets.token_hex(8)
    folder.mkdir(parents=True, mode=0o700)
    folder.chmod(0o700)
    env_file = folder / "audit.env"
    env_file.write_text("# Isolated public-source audit; no model credentials.\n")
    env_file.chmod(0o600)
    token = secrets.token_hex(32)
    os.environ.update(ENV_FILE=str(env_file), DATABASE_PATH=str(folder / "control.db"),
                      LOG_DIR=str(folder / "logs"), FINANCIAL_BRIDGE_TOKEN=token,
                      FINANCIAL_BRIDGE_ISSUER="public-source-audit",
                      ASSISTANT_RESEARCH_ENABLED="false", FINANCIAL_SIMULATION_ENABLED="false",
                      FINANCIAL_CN_SIMULATION_ENABLED="false",
                      SCHEDULE_ENABLED="false", AGENT_EVENT_MONITOR_ENABLED="false",
                      STOCK_INDEX_REMOTE_UPDATE_ENABLED="false")
    result = {"source": "Binance Spot public completed UTC daily_data", "symbol": "BTCUSDT",
              "performedAt": datetime.now(timezone.utc).isoformat(), "simulationDevelopmentGateChanged": False,
              "actualPublicData": True, "modelCalls": 0, "liveTrading": False,
              "versions": {name: package_version(name) for name in
                           ("pandas", "numpy", "PyYAML", "exchange-calendars", "fastapi", "sqlalchemy", "requests")}}
    try:
        from data_provider.crypto_fetcher import daily_data
        frame = daily_data("BTCUSDT", days=180)
        assert len(frame) == 180 and frame["date"].is_unique and frame["date"].is_monotonic_increasing
        last = datetime.now(timezone.utc).date() - timedelta(days=1)
        assert frame.iloc[-1]["date"] == last.isoformat()
        assert all((date.fromisoformat(b) - date.fromisoformat(a)).days == 1
                   for a, b in zip(frame["date"], frame["date"].iloc[1:]))
        assert all(column in frame.columns for column in ("decimal_open", "decimal_close"))
        csv = frame.to_csv(index=False).encode()
        bars_file = folder / "btc-completed-daily.csv"
        bars_file.write_bytes(csv)
        bars_file.chmod(0o600)
        result.update(rows=len(frame), firstDate=frame.iloc[0]["date"], lastDate=last.isoformat(),
                      barsSha256=hashlib.sha256(csv).hexdigest(), rawDecimalColumns=True)

        # Only this audit process becomes enabled after actual source validation.
        # Development env and services keep their explicitly configured gates.
        os.environ["FINANCIAL_SIMULATION_ENABLED"] = "true"
        if retained:
            owner, access = retained
            os.environ.update(owner["env"])
            token = owner["env"]["FINANCIAL_BRIDGE_TOKEN"]
            issuer, subject = owner["env"]["FINANCIAL_BRIDGE_ISSUER"], access["alice"]["id"]
            control_path = owner["env"]["DATABASE_PATH"]
            catalog = rpc("simulationCatalog", {})
            assert catalog["enabled"] and catalog["markets"] == ["crypto"]
            assert (rpc("researchOverview", {})["capabilities"]["enabled"]) is False
        else:
            issuer, subject, control_path = "public-source-audit", "isolated-source-audit", str(folder / "control.db")
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from sqlalchemy import select
        from api.internal.assistant_bridge import router
        from src.config import Config
        from src.services.assistant_bridge_service import AssistantBridgeService, reset_bridge_stores
        from src.services.simulation_portfolio_service import SimulationPortfolioService
        from src.storage import (DatabaseManager, SimulationPortfolioRunRecord, SimulationRunRecord)
        from src.workspace_scope import workspace_scope
        Config._instance = Config(database_path=control_path)
        DatabaseManager.reset_instance()
        bridge = AssistantBridgeService(DatabaseManager("sqlite:///" + control_path))
        if not retained:
            bridge.bind(issuer, subject)
        database = bridge.resolve(issuer, subject)
        app = FastAPI()
        app.include_router(router)
        headers = {"Authorization": "Bearer " + token, "X-Assistant-Issuer": issuer,
                   "X-Assistant-Subject": subject}

        class ActualCachedSource:
            def get_daily_data(self, symbol, **kwargs):
                assert symbol == "BTCUSDT", "The audit uses only the actual validated BTC source"
                return frame.copy(), "Binance Spot validated public daily source"

        audits = []
        with TestClient(app) as client:
            for rule in ("crypto_btc_hold", "crypto_equal_weight", "crypto_rotation"):
                body = dict(idempotencyKey="public-" + folder.name + "-" + rule, name="Actual public source audit " + rule,
                            market="crypto", mode="backtest", symbols=["BTCUSDT"], ruleId=rule,
                            initialCash="1000", startDate=(last - timedelta(days=3)).isoformat(),
                            endDate=last.isoformat())
                if retained:
                    created = rpc("simulationCommand", dict(body, commandType="simulation.create"))
                else:
                    response = client.post("/internal/assistant/v1/commands/simulation.create", json=body, headers=headers)
                    assert response.status_code == 200, "Actual isolated simulation create failed"
                    created = response.json()
                run_id = created["result"]["runId"]
                lease = "public-source-audit-lease"
                with workspace_scope(database):
                    with database.session_scope() as session:
                        session.get(SimulationPortfolioRunRecord, run_id).lease_token = lease
                    SimulationPortfolioService(database, fetcher=ActualCachedSource()).execute(run_id, lease)
                    with database.get_session() as session:
                        row = session.get(SimulationPortfolioRunRecord, run_id)
                        assert row.status == "completed" and row.last_date == last.isoformat() and row.error_message is None
                        state = json.loads(row.state_json)["decimalLedger"]
                        assert Decimal(state["cash"]).is_finite() and Decimal(state["equity"]).is_finite()
                        records = session.scalars(select(SimulationRunRecord).where(
                            SimulationRunRecord.strategy_version_id == row.strategy_version_id).order_by(
                                SimulationRunRecord.id)).all()
                        assert len(records) == 4
                        fills = []
                        for record in records:
                            actual_input = json.loads(record.input_snapshot_json)
                            output = json.loads(record.result_snapshot_json)
                            assert actual_input["sources"]["BTCUSDT"] == "Binance Spot validated public daily source"
                            assert all(bar["priceInputSource"] == "provider_decimal"
                                       for bar in actual_input["bars"]["BTCUSDT"])
                            exact = output["decimalLedger"]
                            assert Decimal(exact["cash"]) + Decimal(exact["marketValue"]) == Decimal(exact["equity"])
                            fills.extend(trade for trade in exact["trades"] if trade["status"] == "filled")
                        assert state["cash"] == exact["cash"] and state["equity"] == exact["equity"]
                        assert fills, "Actual rule produced no fills; financial precision path was not exercised"
                        audits.append(dict(rule=rule, runId=run_id, days=4, filledTrades=len(fills),
                                           cash=state["cash"], equity=state["equity"],
                                           resultRecordIds=[record.id for record in records], ledgerPrecision="decimal_v1"))
                if retained:
                    detail = rpc("run", dict(runId=run_id))
                    assert detail["id"] == run_id and len(detail["days"]) == 4
                    for day in detail["days"]:
                        inputs = rpc("runInputs", dict(runId=run_id, recordId=day["recordId"]))
                        assert inputs["runId"] == run_id and inputs["recordId"] == day["recordId"]
                else:
                    detail = client.get(f"/internal/assistant/v1/runs/{run_id}", headers=headers)
                    assert detail.status_code == 200 and len(detail.json()["days"]) == 4
        result.update(status="passed", ruleAudits=audits,
                      simulationAuditGateEnabledOnlyInThisProcess=not bool(retained),
                      retainedVerificationHttp=bool(retained))
        reset_bridge_stores()
        DatabaseManager.reset_instance()
    except Exception as error:
        result.update(status="failed", errorType=type(error).__name__)
        if isinstance(error, HTTPError):
            result["httpStatus"] = error.code
        elif isinstance(error, ModuleNotFoundError):
            result["missingDependency"] = error.name
        # Store the actual exception privately, never print provider text/headers.
        (folder / "failure.txt").write_text(str(error))
        (folder / "failure.txt").chmod(0o600)
    private_json(folder / "result.json", result)
    print(json.dumps({**result, "evidenceDirectory": str(folder)}))
    if result["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()

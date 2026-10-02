"""Evidence-backed local portfolio/watchlist monitoring and durable alert outbox.

This module does not fetch data, send notifications, or execute transactions.
Prices are compared with the first complete, fresh evaluation; small movements
and unchanged breached rules remain quiet. SQLite commits state and alerts
together, and disabling a watch never deletes its observation history.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import stat
import tempfile
from contextlib import contextmanager
from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation, localcontext
from hashlib import sha256
from pathlib import Path
from typing import Any

from marketbot.domain.market.portfolio import calculate_portfolio_risk, canonical_symbol

_SYMBOL = re.compile(r"[A-Za-z0-9^][A-Za-z0-9._^=:/-]{0,39}")
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}")
_APPLICATION_ID = 0x4D425754  # MBWT, distinct from the evidence database.
_NON_OBSERVED = {"derived", "estimated", "estimate", "synthetic", "mock", "mocked", "forecast", "prediction", "hypothetical", "invalid", "missing", "unavailable", "stale"}
_SCHEMA = """
BEGIN IMMEDIATE;
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE watches (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER NOT NULL,
    revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    spec TEXT NOT NULL, state TEXT NOT NULL
);
CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, watch_id TEXT NOT NULL,
    action TEXT NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE outbox (
    id TEXT PRIMARY KEY, watch_id TEXT NOT NULL, created_at TEXT NOT NULL,
    payload TEXT NOT NULL, acknowledged_at TEXT
);
INSERT INTO metadata VALUES ('schema_version', '1');
"""


def _non_observed(row: Any) -> bool:
    if not isinstance(row, dict):
        return False
    flags = ("derived", "estimated", "synthetic", "mock", "mocked", "isForecast", "hypothetical")
    return any(row.get(key) for key in flags) or any(str(row.get(key, "")).casefold() in _NON_OBSERVED for key in ("status", "priceType", "valueType"))


def _json_default(value: Any) -> str:
    if isinstance(value, Decimal) and value.is_finite():
        return _decimal(value)
    raise TypeError("Unsupported watch JSON value")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
                      default=_json_default)


def _digest(value: Any) -> str:
    return sha256(_json(value).encode("utf-8")).hexdigest()


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Use an ISO-8601 observation timestamp with a timezone.")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Observation timestamps must contain a timezone.")
    return result.astimezone(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _number(value: Any, *, positive: bool = False) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("Use a finite decimal number or decimal string.")
    try:
        result = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise ValueError("Use a finite decimal number or decimal string.") from exc
    if not result.is_finite() or len(result.as_tuple().digits) > 28 or abs(result.as_tuple().exponent) > 28:
        raise ValueError("Use finite numbers with at most 28 digits and exponent -28 to 28.")
    if result < 0 or (positive and result == 0):
        raise ValueError("Value must be positive." if positive else "Value cannot be negative.")
    return result


def _decimal(value: Decimal) -> str:
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _symbol(value: Any) -> str:
    if not isinstance(value, str) or not _SYMBOL.fullmatch(value.strip()):
        raise ValueError("Use a ticker, not a company name.")
    return canonical_symbol(value)


def _references(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 200 or any(not isinstance(item, str) or not item for item in value):
        raise ValueError("evidenceIds must be an array of nonempty evidence IDs, at most 200.")
    return list(dict.fromkeys(value))


def _error(code: str, message: str, **details: Any) -> dict[str, Any]:
    return {"ok": False, "error": {"type": code, "message": message, **details}}


def _rules(value: Any, kind: str, symbols: list[str]) -> list[dict[str, Any]]:
    if value is None:
        value = []
    if not isinstance(value, list) or len(value) > 20:
        raise ValueError("rules must contain at most 20 explicit rules.")
    result: list[dict[str, Any]] = []
    used: set[str] = set()
    for index, raw in enumerate(value):
        if not isinstance(raw, dict):
            raise ValueError("Each rule must be an object.")
        rule_type = raw.get("type")
        if rule_type not in {"price_change", "max_weight", "freshness"}:
            raise ValueError("Rule type must be price_change, max_weight, or freshness.")
        allowed = {"id", "type", "symbol"}
        allowed |= {"maxAgeSeconds"} if rule_type == "freshness" else {"thresholdPct"}
        if rule_type == "price_change":
            allowed.add("direction")
        if set(raw) - allowed:
            raise ValueError("Rule contains unsupported parameters.")
        rule_id = raw.get("id", f"rule-{index + 1}")
        if not isinstance(rule_id, str) or not _ID.fullmatch(rule_id) or rule_id in used:
            raise ValueError("Rule IDs must be unique identifiers of at most 100 characters.")
        used.add(rule_id)
        rule = {"id": rule_id, "type": rule_type}
        if raw.get("symbol") is not None:
            rule["symbol"] = _symbol(raw["symbol"])
            if rule["symbol"] not in symbols:
                raise ValueError("A rule's symbol must belong to the saved watch.")
        if rule_type == "freshness":
            age = _number(raw.get("maxAgeSeconds"), positive=True)
            if age > 31536000:
                raise ValueError("Freshness cutoff must be at most one year in seconds.")
            rule["maxAgeSeconds"] = _decimal(age)
        else:
            threshold = _number(raw.get("thresholdPct"), positive=True)
            if threshold > (100 if rule_type == "max_weight" else 100000):
                raise ValueError("Weight threshold cannot exceed 100%; price threshold cannot exceed 100000%.")
            rule["thresholdPct"] = _decimal(threshold)
            if rule_type == "max_weight" and kind != "portfolio":
                raise ValueError("max_weight requires a complete portfolio, including cash and FX.")
            if rule_type == "price_change":
                rule["direction"] = raw.get("direction", "either")
                if rule["direction"] not in {"up", "down", "either"}:
                    raise ValueError("Price direction must be up, down, or either.")
        result.append(rule)
    return result


def _portfolio_inputs(result: dict[str, Any], originals: list[dict[str, Any]], fx: dict[str, Any]) -> dict[str, Any]:
    by_symbol = {_symbol(row["symbol"]): row for row in originals}
    holdings = []
    for row in result["holdings"]:
        clean = {key: row[key] for key in ("symbol", "quantity", "price", "currency", "priceType", "source", "observedAt")}
        clean["evidenceIds"] = _references(by_symbol[row["symbol"]].get("evidenceIds"))
        holdings.append(clean)
    normalized_fx = {}
    raw_fx = {key.strip().upper(): row for key, row in fx.items()}
    for currency, row in result["fxRates"].items():
        if currency == result["baseCurrency"]:
            continue
        normalized_fx[currency] = {**row, "evidenceIds": _references(raw_fx[currency].get("evidenceIds"))}
    return {
        "holdings": holdings,
        "cash": [{key: row[key] for key in ("currency", "amount")} for row in result["cash"]],
        "fxRates": normalized_fx,
    }


class WatchStore:
    """SQLite store with atomic evaluation/state/outbox commits and soft removal."""

    def __init__(self, workspace: Path, evidence_store: Any = None):
        self.workspace = Path(workspace).expanduser().resolve()
        self.path = self.workspace / "data" / "market_watch.sqlite3"
        if evidence_store is None:
            from marketbot.domain.market.evidence import EvidenceStore

            evidence_store = EvidenceStore(self.workspace)
        self.evidence = evidence_store

    def _check_paths(self) -> bool:
        """Inspect each path once; SQLite sidecars may disappear between operations."""
        def metadata_if_present(path: Path):
            try:
                return path.lstat()
            except FileNotFoundError:
                return None

        for directory in (self.workspace, self.path.parent):
            metadata = metadata_if_present(directory)
            if metadata is not None and not stat.S_ISDIR(metadata.st_mode):
                raise ValueError("Watch storage must remain inside its workspace.")
        database_exists = False
        for path in (self.path, Path(str(self.path) + "-journal"), Path(str(self.path) + "-wal"), Path(str(self.path) + "-shm")):
            metadata = metadata_if_present(path)
            if metadata is None:
                continue
            if not stat.S_ISREG(metadata.st_mode):
                raise ValueError("Watch storage path is unsafe.")
            if path == self.path:
                database_exists = True
                if metadata.st_size == 0:
                    raise ValueError("Existing watch storage is empty; existing data was preserved.")
        if not self.path.resolve().is_relative_to(self.workspace):
            raise ValueError("Watch storage must remain inside its workspace.")
        return database_exists

    @staticmethod
    def _initialize_database(connection: sqlite3.Connection) -> None:
        connection.executescript(_SCHEMA)
        connection.execute(f"PRAGMA application_id={_APPLICATION_ID}")
        connection.commit()

    def _ensure_database(self) -> None:
        if self._check_paths():
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self._check_paths():
            return
        temporary: Path | None = None
        try:
            descriptor, name = tempfile.mkstemp(prefix=".market-watch-", suffix=".sqlite3", dir=self.path.parent)
            os.close(descriptor)
            temporary = Path(name)
            connection = sqlite3.connect(temporary)
            try:
                self._initialize_database(connection)
            finally:
                connection.close()
            # Publish a complete database without replacing a concurrent writer's
            # database, an existing empty file, or an unsafe storage path.
            try:
                os.link(temporary, self.path)
            except FileExistsError:
                pass
            self._check_paths()
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    @contextmanager
    def _connection(self, *, write: bool = False):
        exists = self._check_paths()
        if write:
            self._ensure_database()
            exists = True
        database = self.path.as_uri() + ("?mode=rw" if write else "?mode=ro") if exists else ":memory:"
        connection = sqlite3.connect(database, timeout=10, isolation_level=None, uri=exists)
        connection.row_factory = sqlite3.Row
        try:
            if exists:
                application = connection.execute("PRAGMA application_id").fetchone()[0]
                if application not in {0, _APPLICATION_ID}:
                    raise ValueError("Foreign database at watch storage path; existing data was preserved.")
                version = connection.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
                if version is None or version[0] != "1":
                    raise ValueError("Unsupported watch storage schema; existing data was preserved.")
                for table in ("watches", "audit", "outbox"):
                    if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is None:
                        raise ValueError("Incomplete watch storage schema; existing data was preserved.")
            else:
                self._initialize_database(connection)
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            if write:
                connection.commit()
        except BaseException:
            if write:
                connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _record(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "watchId": row["id"], "name": row["name"], "kind": row["kind"], "active": bool(row["active"]),
            "revision": row["revision"], "createdAt": row["created_at"], "updatedAt": row["updated_at"],
            "spec": json.loads(row["spec"]), "state": json.loads(row["state"]),
        }

    @staticmethod
    def _find(connection: sqlite3.Connection, watch_id: str) -> dict[str, Any] | None:
        row = connection.execute("SELECT * FROM watches WHERE id=?", (watch_id,)).fetchone()
        return WatchStore._record(row) if row else None

    @staticmethod
    def _audit(connection: sqlite3.Connection, watch_id: str, action: str, at: str, payload: Any) -> None:
        connection.execute("INSERT INTO audit(watch_id, action, at, payload) VALUES (?, ?, ?, ?)", (watch_id, action, at, _json(payload)))

    def save(
        self, *, name: str, kind: str = "watchlist", watch_id: str | None = None,
        symbols: Any = None, holdings: Any = None, base_currency: Any = None,
        cash: Any = None, fx_rates: Any = None, rules: Any = None, max_age_seconds: Any = 3600,
    ) -> dict[str, Any]:
        """Create or replace a complete watch definition; preserve prior history/baselines."""
        try:
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 200:
                raise ValueError("Provide a nonempty watch name up to 200 characters.")
            name = " ".join(name.split())
            if kind not in {"portfolio", "watchlist"}:
                raise ValueError("Watch kind must be portfolio or watchlist.")
            if watch_id is None:
                watch_id = f"watch-{_digest(name.casefold())[:24]}"
            if not isinstance(watch_id, str) or not _ID.fullmatch(watch_id):
                raise ValueError("watchId must be an identifier up to 100 characters.")
            max_age = _number(max_age_seconds, positive=True)
            if max_age > 31536000:
                raise ValueError("maxAgeSeconds cannot exceed one year.")
            if kind == "portfolio":
                portfolio = calculate_portfolio_risk(holdings, base_currency, cash=cash, fx_rates=fx_rates)
                if not portfolio["ok"]:
                    return portfolio
                inputs = _portfolio_inputs(portfolio, holdings, fx_rates or {})
                clean_symbols = [row["symbol"] for row in inputs["holdings"]]
                if symbols is not None and (not isinstance(symbols, list) or {_symbol(item) for item in symbols} != set(clean_symbols)):
                    raise ValueError("Portfolio symbols must match its complete holdings.")
                spec = {**inputs, "baseCurrency": portfolio["baseCurrency"], "symbols": clean_symbols}
            else:
                if any(value is not None for value in (holdings, base_currency, cash, fx_rates)):
                    raise ValueError("A watchlist accepts symbols and rules; use portfolio for holdings/cash/FX.")
                if not isinstance(symbols, list) or not 1 <= len(symbols) <= 100:
                    raise ValueError("Provide between 1 and 100 watchlist symbols.")
                clean_symbols = [_symbol(item) for item in symbols]
                if len(clean_symbols) != len(set(clean_symbols)):
                    raise ValueError("Duplicate ticker aliases must be combined explicitly.")
                spec = {"symbols": clean_symbols}
            spec["rules"] = _rules(rules, kind, clean_symbols)
            spec["maxAgeSeconds"] = _decimal(max_age)
            _json(spec)
        except (ValueError, TypeError, KeyError) as exc:
            return _error("invalid_watch", str(exc))
        now = _now()
        with self._connection(write=True) as connection:
            old = self._find(connection, watch_id)
            if old and old["kind"] != kind:
                return _error("invalid_watch", "An existing watch cannot change kind; create a new watch.")
            if old and old["name"] == name and old["spec"] == spec and old["active"]:
                return {"ok": True, "watch": old, "changed": False}
            state = old["state"] if old else {}
            revision = old["revision"] + 1 if old else 1
            connection.execute(
                "INSERT INTO watches VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=1, revision=excluded.revision, updated_at=excluded.updated_at, spec=excluded.spec",
                (watch_id, name, kind, revision, old["createdAt"] if old else now, now, _json(spec), _json(state)),
            )
            self._audit(connection, watch_id, "saved", now, {"revision": revision, "spec": spec})
            return {"ok": True, "watch": self._find(connection, watch_id), "changed": True}

    def get(self, watch_id: str) -> dict[str, Any]:
        with self._connection() as connection:
            record = self._find(connection, watch_id)
            if record is None:
                return _error("watch_not_found", "No watch with that ID exists.")
            events = connection.execute("SELECT * FROM audit WHERE watch_id=? ORDER BY id", (watch_id,)).fetchall()
            record["history"] = [{"action": row["action"], "at": row["at"], "payload": json.loads(row["payload"])} for row in events]
            return {"ok": True, "watch": record}

    def list(self, *, include_inactive: bool = False) -> dict[str, Any]:
        with self._connection() as connection:
            rows = connection.execute("SELECT * FROM watches WHERE active=1 OR ? ORDER BY created_at, id", (include_inactive,)).fetchall()
            return {"ok": True, "watches": [self._record(row) for row in rows]}

    def remove(self, watch_id: str) -> dict[str, Any]:
        with self._connection(write=True) as connection:
            record = self._find(connection, watch_id)
            if record is None:
                return _error("watch_not_found", "No watch with that ID exists.")
            if record["active"]:
                now = _now()
                connection.execute("UPDATE watches SET active=0, updated_at=? WHERE id=?", (now, watch_id))
                self._audit(connection, watch_id, "disabled", now, {})
            return {"ok": True, "watch": self._find(connection, watch_id), "removed": True}

    def outbox(self, *, watch_id: str | None = None, include_acknowledged: bool = False, limit: int = 200) -> dict[str, Any]:
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 1000:
            return _error("invalid_watch", "Outbox limit must be between 1 and 1000.")
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM outbox WHERE (? IS NULL OR watch_id=?) AND (acknowledged_at IS NULL OR ?) ORDER BY created_at, id LIMIT ?",
                (watch_id, watch_id, include_acknowledged, limit),
            ).fetchall()
            return {"ok": True, "alerts": [{**json.loads(row["payload"]), "acknowledgedAt": row["acknowledged_at"]} for row in rows]}

    def ack(self, alert_id: str) -> dict[str, Any]:
        with self._connection(write=True) as connection:
            row = connection.execute("SELECT * FROM outbox WHERE id=?", (alert_id,)).fetchone()
            if row is None:
                return _error("alert_not_found", "No alert with that ID exists.")
            acknowledged = row["acknowledged_at"] or _now()
            connection.execute("UPDATE outbox SET acknowledged_at=? WHERE id=?", (acknowledged, alert_id))
            if not row["acknowledged_at"]:
                self._audit(connection, row["watch_id"], "acknowledged", acknowledged, {"alertId": alert_id})
            return {"ok": True, "alertId": alert_id, "acknowledgedAt": acknowledged}

    def _evidence_rows(self, record: Any) -> list[dict[str, Any]]:
        payload = record.payload
        if not isinstance(payload, dict):
            return []
        rows: list[dict[str, Any]] = []
        default_source = payload.get("source") or record.source
        if "symbol" in payload or "rate" in payload:
            rows.append(payload)
        for key in ("quotes", "holdings", "observations"):
            if isinstance(payload.get(key), list):
                rows.extend(item for item in payload[key] if isinstance(item, dict))
        if isinstance(payload.get("fxRates"), dict):
            rows.extend({**row, "currency": currency} for currency, row in payload["fxRates"].items() if isinstance(row, dict))
        return [{**row, "source": row.get("source", row.get("provider", default_source)),
                 "observedAt": row.get("observedAt", payload.get("observedAt", record.observed_at)),
                 "baseCurrency": row.get("baseCurrency", payload.get("baseCurrency"))} for row in rows]

    def _matches_evidence(self, observation: dict[str, Any], evidence_ids: list[str], *, fx: bool = False) -> bool:
        for evidence_id in evidence_ids:
            record = self.evidence.get(evidence_id)
            if record is None:
                continue
            quality = record.quality or {}
            if (_non_observed(quality) or _non_observed(record.payload)
                    or record.kind.casefold() in {"watch_evaluation", "thesis_review", "portfolio_risk", "risk_scenario", "valuation", "derived"}
                    or record.source.casefold() in _NON_OBSERVED | {"portfolio_risk", "risk_scenario", "valuation", "market_signal", "market_watch"}):
                continue
            for row in self._evidence_rows(record):
                if _non_observed(row):
                    continue
                try:
                    identity_matches = (str(row.get("currency", "")).upper() == observation["currency"]) if fx else (_symbol(row.get("symbol")) == observation["symbol"])
                    field = "rate" if fx else "price"
                    currency_matches = (
                        str(row.get("baseCurrency", "")).upper() == observation["baseCurrency"]
                        if fx else str(row.get("currency", "")).upper() == observation["currency"]
                    )
                    if (identity_matches and currency_matches and _number(row.get(field)) == _number(observation[field])
                            and _timestamp(row.get("observedAt")) == _timestamp(observation["observedAt"])
                            and row.get("source") == observation["source"]):
                        return True
                except (ValueError, TypeError, KeyError):
                    continue
        return False

    @staticmethod
    def _quality(row: dict[str, Any], as_of: datetime, max_age: Decimal, previous: dict[str, Any] | None) -> list[dict[str, Any]]:
        gaps = []
        identity = row.get("symbol") or row.get("currency")
        if not row.get("source"):
            gaps.append({"code": "missing_source", "symbol": identity})
        elif str(row["source"]).casefold() in {"mock", "synthetic"}:
            gaps.append({"code": "mock_source", "symbol": identity})
        if not row.get("observedAt"):
            gaps.append({"code": "missing_observation_time", "symbol": identity})
        else:
            observed = _timestamp(row["observedAt"])
            elapsed = as_of - observed
            age = Decimal(elapsed.days * 86400 + elapsed.seconds) + Decimal(elapsed.microseconds) / Decimal(1000000)
            if age < 0:
                gaps.append({"code": "future_observation", "symbol": identity})
            elif age > max_age:
                gaps.append({"code": "stale_observation", "symbol": identity, "ageSeconds": _decimal(age), "maxAgeSeconds": _decimal(max_age)})
            if previous and previous.get("observedAt") and observed < _timestamp(previous["observedAt"]):
                gaps.append({"code": "out_of_order_observation", "symbol": identity})
        return gaps

    def evaluate(
        self, watch_id: str, *, observations: Any = None, holdings: Any = None,
        cash: Any = None, fx_rates: Any = None, as_of: str | None = None, evidence_ids: Any = None,
    ) -> dict[str, Any]:
        """Evaluate supplied evidence; never substitute retrieval time for quote time."""
        try:
            moment = _timestamp(as_of) if as_of is not None else datetime.now(UTC)
            refs = _references(evidence_ids)
            if observations is not None and (not isinstance(observations, list) or len(observations) > 100):
                raise ValueError("observations must contain at most 100 quote objects.")
            for evidence_id in refs:
                if self.evidence.get(evidence_id) is None:
                    raise ValueError("Referenced evidence does not exist.")
        except (ValueError, TypeError) as exc:
            return _error("invalid_watch_evidence", str(exc))
        with self._connection(write=True) as connection:
            record = self._find(connection, watch_id)
            if record is None:
                return _error("watch_not_found", "No watch with that ID exists.")
            if not record["active"]:
                return _error("watch_inactive", "This watch is disabled; save it explicitly to reactivate.")
            state = deepcopy(record["state"])
            if state.get("lastEvaluatedAt") and moment < _timestamp(state["lastEvaluatedAt"]):
                return _error("invalid_watch_evidence", "Evaluation cannot rewind a watch's latest accepted timestamp.")
            try:
                snapshot, quotes, valuation, gaps, all_refs = self._prepare(record, observations, holdings, cash, fx_rates, moment, refs)
            except (ValueError, TypeError, KeyError) as exc:
                return _error("invalid_watch_evidence", str(exc))
            return self._commit_evaluation(connection, record, state, snapshot, quotes, valuation, gaps, all_refs, moment)

    def _prepare(self, record, observations, holdings, cash, fx_rates, moment, refs):
        spec, state = record["spec"], record["state"]
        last = state.get("lastSnapshot", {})
        quote_map = {}
        seen_symbols = set()
        gaps = []
        all_refs = list(refs)
        for raw in observations or []:
            if not isinstance(raw, dict):
                raise ValueError("Each observation must be an object.")
            symbol = _symbol(raw.get("symbol"))
            if symbol in seen_symbols:
                raise ValueError("Duplicate observation ticker aliases are not allowed.")
            seen_symbols.add(symbol)
            missing = [field for field in ("price", "currency") if raw.get(field) is None]
            if missing:
                gaps.extend({"code": f"missing_{field}", "symbol": symbol} for field in missing)
                all_refs.extend(_references(raw.get("evidenceIds")))
                continue
            price = _number(raw.get("price"), positive=True)
            currency = raw.get("currency")
            if not isinstance(currency, str) or not re.fullmatch(r"[A-Za-z]{3}", currency.strip()):
                raise ValueError("Each quote requires its actual three-letter currency.")
            source = raw.get("source") or raw.get("provider")
            if source is not None and not isinstance(source, str):
                raise ValueError("Quote source must be a string.")
            at = raw.get("observedAt")
            if at:
                _timestamp(at)
            ids = _references(raw.get("evidenceIds"))
            all_refs.extend(ids)
            quote_map[symbol] = {"symbol": symbol, "price": _decimal(price), "currency": currency.strip().upper(), "source": source, "observedAt": at, "evidenceIds": ids}
        valuation = None
        if record["kind"] == "portfolio":
            configured = spec if state.get("configRevision") != record["revision"] else last
            current_holdings = deepcopy(holdings if holdings is not None else configured.get("holdings", spec["holdings"]))
            if holdings is not None and cash is None and configured.get("cash", spec["cash"]):
                raise ValueError("A complete updated holdings snapshot must explicitly include cash; use [] if none.")
            current_cash = deepcopy(cash if cash is not None else configured.get("cash", spec["cash"]))
            current_fx = deepcopy(fx_rates if fx_rates is not None else configured.get("fxRates", spec["fxRates"]))
            if not isinstance(current_holdings, list):
                raise ValueError("holdings must be a complete array of positions.")
            for row in current_holdings:
                if not isinstance(row, dict):
                    raise ValueError("Each holding must be an object.")
                symbol = _symbol(row.get("symbol"))
                if observations is not None:
                    quote = quote_map.get(symbol)
                    if quote is None:
                        if not any(gap["symbol"] == symbol for gap in gaps):
                            gaps.append({"code": "missing_quote", "symbol": symbol})
                        continue
                    if not isinstance(row.get("currency"), str) or row["currency"].upper() != quote["currency"]:
                        raise ValueError("Quote currency does not match the position's denomination.")
                    row.update(quote)
                else:
                    quote_map[symbol] = {**row, "symbol": symbol, "evidenceIds": _references(row.get("evidenceIds"))}
            valuation = calculate_portfolio_risk(current_holdings, spec["baseCurrency"], cash=current_cash, fx_rates=current_fx)
            if not valuation["ok"]:
                issues = valuation["error"]["issues"]
                if all(issue["code"] == "missing_fx_rate" for issue in issues):
                    gaps.extend({"code": "missing_fx_rate", "symbol": issue["path"].split(".")[-1]} for issue in issues)
                    snapshot = json.loads(_json({"holdings": current_holdings, "cash": current_cash, "fxRates": current_fx}))
                else:
                    raise ValueError("Invalid complete portfolio snapshot: " + "; ".join(issue["message"] for issue in issues))
            else:
                snapshot = _portfolio_inputs(valuation, current_holdings, current_fx)
            wanted = [_symbol(row["symbol"]) for row in current_holdings]
        else:
            if any(value is not None for value in (holdings, cash, fx_rates)):
                raise ValueError("Watchlist evaluations accept quotes, not portfolio snapshots.")
            wanted = spec["symbols"]
            snapshot = {"quotes": [quote_map[symbol] for symbol in wanted if symbol in quote_map]}
        previous_quotes = {row["symbol"]: row for row in [*last.get("holdings", []), *last.get("quotes", [])]}
        for symbol in wanted:
            quote = quote_map.get(symbol)
            if quote is None:
                if not any(gap["symbol"] == symbol for gap in gaps):
                    gaps.append({"code": "missing_quote", "symbol": symbol})
                continue
            quote["price"] = _decimal(_number(quote.get("price"), positive=True))
            if not isinstance(quote.get("currency"), str) or not re.fullmatch(r"[A-Z]{3}", quote["currency"]):
                raise ValueError("Each quote requires its actual currency.")
            previous = previous_quotes.get(symbol)
            if previous and previous["currency"] != quote["currency"]:
                raise ValueError("A watch cannot compare prices across different currencies.")
            cutoff = min([Decimal(spec["maxAgeSeconds"]), *[Decimal(rule["maxAgeSeconds"]) for rule in spec["rules"] if rule["type"] == "freshness" and rule.get("symbol", symbol) == symbol]])
            row_gaps = self._quality(quote, moment, cutoff, previous)
            ids = list(dict.fromkeys([*_references(quote.get("evidenceIds")), *refs]))
            all_refs.extend(ids)
            if not ids:
                row_gaps.append({"code": "missing_evidence", "symbol": symbol})
            elif quote.get("source") and quote.get("observedAt") and str(quote["source"]).casefold() not in {"mock", "synthetic"} and not self._matches_evidence(quote, ids):
                raise ValueError("Quote values, denomination, source and observation time must match original observed evidence; derived/estimated data cannot establish a market baseline.")
            gaps.extend(row_gaps)
        if record["kind"] == "portfolio":
            for currency, row in snapshot["fxRates"].items():
                if currency.upper() == spec["baseCurrency"]:
                    continue
                fx_row = {**row, "currency": currency.upper(), "baseCurrency": spec["baseCurrency"]}
                row_gaps = self._quality(fx_row, moment, Decimal(spec["maxAgeSeconds"]), last.get("fxRates", {}).get(currency))
                ids = list(dict.fromkeys([*_references(row.get("evidenceIds")), *refs]))
                all_refs.extend(ids)
                if not ids:
                    row_gaps.append({"code": "missing_evidence", "symbol": currency})
                elif fx_row.get("source") and fx_row.get("observedAt") and str(fx_row["source"]).casefold() not in {"mock", "synthetic"} and not self._matches_evidence(fx_row, ids, fx=True):
                    raise ValueError("FX values, base currency, source and observation time must match original observed evidence; derived/estimated rates cannot establish a valuation baseline.")
                gaps.extend(row_gaps)
        all_refs = list(dict.fromkeys(all_refs))
        if any(self.evidence.get(evidence_id) is None for evidence_id in all_refs):
            raise ValueError("Referenced evidence does not exist.")
        return snapshot, [quote_map[symbol] for symbol in wanted if symbol in quote_map], valuation, gaps, all_refs

    def _commit_evaluation(self, connection, record, state, snapshot, quotes, valuation, gaps, refs, moment):
        watch_id, spec = record["watchId"], record["spec"]
        initial = "lastSnapshot" not in state
        observed = []
        transitions = []
        rule_states = dict(state.get("ruleStates", {}))
        if gaps:
            signature = _digest(sorted([{key: value for key, value in gap.items() if key not in {"ageSeconds", "maxAgeSeconds"}} for gap in gaps], key=_json))
            if state.get("qualityState") != signature:
                transitions.append({"type": "data_gap", "status": "data_gap", "gaps": gaps})
            observed = [{"type": "data_quality", "status": "data_gap", "gaps": gaps}]
            symbols = spec["symbols"] if record["kind"] == "watchlist" else [row["symbol"] for row in snapshot["holdings"]]
            for rule in spec["rules"]:
                for symbol in symbols:
                    if rule.get("symbol", symbol) == symbol:
                        observed.append({"type": rule["type"], "ruleId": rule["id"], "symbol": symbol,
                                         "status": "data_gap", "rule": rule, "gaps": gaps})
            state["qualityState"] = signature
            status = "data_gap"
        else:
            if state.get("qualityState") not in {None, "valid"}:
                transitions.append({"type": "data_recovered", "status": "valid"})
            state["qualityState"] = "valid"
            baseline = dict(state.get("baselinePrices", {}))
            previous = state.get("lastSnapshot", {})
            previous_symbols = {row["symbol"] for row in previous.get("holdings", previous.get("quotes", []))}
            for row in quotes:
                if row["symbol"] not in baseline or (record["kind"] == "portfolio" and row["symbol"] not in previous_symbols):
                    baseline[row["symbol"]] = {key: row[key] for key in ("price", "currency", "source", "observedAt")}
            if not initial and state.get("configRevision") != record["revision"]:
                transitions.append({"type": "configuration_change", "status": "changed", "previousRevision": state.get("configRevision"), "revision": record["revision"]})
            if not initial and record["kind"] == "portfolio":
                previous_positions = {row["symbol"]: row["quantity"] for row in previous["holdings"]}
                current_positions = {row["symbol"]: row["quantity"] for row in snapshot["holdings"]}
                previous_cash = self._cash_totals(previous["cash"])
                current_cash = self._cash_totals(snapshot["cash"])
                if previous_positions != current_positions or previous_cash != current_cash:
                    transitions.append({"type": "position_change", "status": "changed", "previousPositions": previous_positions, "positions": current_positions, "previousCash": previous_cash, "cash": current_cash, "basis": "explicit supplied portfolio snapshot"})
            with localcontext() as context:
                context.prec = 320
                for rule in spec["rules"]:
                    for quote in quotes:
                        symbol = quote["symbol"]
                        if rule.get("symbol", symbol) != symbol:
                            continue
                        key = f"{rule['id']}:{symbol}"
                        value = None
                        if rule["type"] == "price_change":
                            base = Decimal(baseline[symbol]["price"])
                            value = (Decimal(quote["price"]) - base) / base * 100
                            threshold = Decimal(rule["thresholdPct"])
                            up = value >= threshold and rule["direction"] in {"up", "either"}
                            down = value <= -threshold and rule["direction"] in {"down", "either"}
                            rule_status = "up" if up else "down" if down else "clear"
                        elif rule["type"] == "max_weight":
                            holding = next(row for row in valuation["holdings"] if row["symbol"] == symbol)
                            value = Decimal(holding["valueBase"]) / Decimal(valuation["totalValue"]) * 100
                            rule_status = "breached" if value > Decimal(rule["thresholdPct"]) else "clear"
                        else:
                            rule_status = "fresh"
                        observation = {"type": rule["type"], "ruleId": rule["id"], "symbol": symbol, "status": rule_status, "rule": rule}
                        if value is not None:
                            observation["valuePct"] = _decimal(value)
                        if rule["type"] == "price_change":
                            observation.update({"baselinePrice": baseline[symbol]["price"], "price": quote["price"],
                                                "currency": quote["currency"], "observedAt": quote["observedAt"]})
                        elif rule["type"] == "max_weight":
                            observation.update({"valueBase": holding["valueBase"], "totalValue": valuation["totalValue"],
                                                "baseCurrency": spec["baseCurrency"]})
                        else:
                            observation.update({"observedAt": quote["observedAt"], "maxAgeSeconds": rule["maxAgeSeconds"]})
                        observed.append(observation)
                        prior_status = rule_states.get(key)
                        if not initial and prior_status != rule_status:
                            # A new clear rule has no breach to notify about.
                            if prior_status is not None or rule_status not in {"clear", "fresh"}:
                                transitions.append({**observation, "previousStatus": prior_status})
                        rule_states[key] = rule_status
            state.update({"baselinePrices": baseline, "lastSnapshot": snapshot, "ruleStates": rule_states, "configRevision": record["revision"]})
            status = "baseline_established" if initial else "changed" if transitions else "unchanged"
        # This is an evaluation time, never represented as a source observation time.
        payload = {"watchId": watch_id, "evaluatedAt": _iso(moment), "status": status, "snapshot": snapshot, "observations": observed, "gaps": gaps, "revision": record["revision"]}
        evidence = self.evidence.record(kind="watch_evaluation", source="market_watch", payload=payload, symbols=[row["symbol"] for row in quotes], quality={"status": "data_gap" if gaps else "supplied_evidence_checked"}, derived_from=refs)
        evidence_id = evidence.evidence_id
        alerts = []
        event_version = int(state.get("eventVersion", 0)) + bool(transitions)
        for transition in transitions:
            alert_id = f"alert-{_digest([watch_id, event_version, transition])}"
            alert = {"alertId": alert_id, "watchId": watch_id, "createdAt": _iso(moment), **transition, "evidenceIds": [evidence_id], "inputEvidenceIds": refs, "delivery": "local_outbox"}
            connection.execute("INSERT OR IGNORE INTO outbox VALUES (?, ?, ?, ?, NULL)", (alert_id, watch_id, _iso(moment), _json(alert)))
            alerts.append(alert)
        state["eventVersion"] = event_version
        state["lastEvaluatedAt"] = _iso(moment)
        state["lastEvidenceId"] = evidence_id
        connection.execute("UPDATE watches SET state=?, updated_at=? WHERE id=?", (_json(state), _iso(moment), watch_id))
        self._audit(connection, watch_id, "evaluated", _iso(moment), {"status": status, "evidenceIds": [evidence_id], "alertIds": [row["alertId"] for row in alerts]})
        return {"ok": not gaps, "status": status, "watchId": watch_id, "evaluatedAt": _iso(moment), "observations": [{**row, "evidenceIds": [evidence_id]} for row in observed], "evidenceIds": [evidence_id], "inputEvidenceIds": refs, "alerts": alerts, "valuation": valuation if not gaps else None, "dataGaps": gaps, "baselineAdvanced": not gaps, "delivery": "local_outbox", **({"error": {"type": "data_gap", "message": "No complete fresh evidence-backed snapshot; the last valid baseline was preserved."}} if gaps else {})}

    @staticmethod
    def _cash_totals(rows: list[dict[str, Any]]) -> dict[str, str]:
        values: dict[str, Decimal] = {}
        with localcontext() as context:
            context.prec = 320
            for row in rows:
                values[row["currency"]] = values.get(row["currency"], Decimal(0)) + Decimal(row["amount"])
        return {currency: _decimal(value) for currency, value in sorted(values.items())}

"""Deterministic thesis conditions evaluated against immutable source facts."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

from marketbot.domain.market.portfolio import canonical_symbol

OPERATORS = {"lt", "lte", "gt", "gte", "eq", "ne"}
EFFECTS = {"weakened", "falsified", "strengthened"}
DEFAULT_MAX_AGE_SECONDS = 86400


def finite_decimal(value: Any) -> Decimal:
    """Read a bounded finite decimal, without binary-float comparisons."""
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("value must be a finite number or decimal string")
    if isinstance(value, str) and len(value) > 100:
        raise ValueError("numeric value is too long")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("value must be a finite number or decimal string") from None
    if not number.is_finite() or len(number.as_tuple().digits) > 28 or abs(number.as_tuple().exponent) > 28:
        raise ValueError("value must be finite with at most 28 significant digits and exponent magnitude 28")
    return number


def decimal_string(number: Decimal) -> str:
    result = format(number, "f")
    return result.rstrip("0").rstrip(".") if "." in result else result


def normalize_rules(rules: Any) -> list[dict[str, Any]]:
    """Validate and persist small, explicit numeric conditions."""
    if not isinstance(rules, list) or len(rules) > 100:
        raise ValueError("rules must be an array of at most 100 conditions")
    clean: list[dict[str, Any]] = []
    ids: set[str] = set()
    for item in rules:
        if not isinstance(item, dict):
            raise ValueError("each rule must be an object")
        rule_id, metric = item.get("id"), item.get("metric")
        if not isinstance(rule_id, str) or not rule_id.strip() or len(rule_id) > 100 or rule_id.strip() in ids:
            raise ValueError("rule id must be a unique nonempty string of at most 100 characters")
        if not isinstance(metric, str) or not metric.strip() or len(metric) > 100:
            raise ValueError("rule metric must be a nonempty field name of at most 100 characters")
        operator, effect = item.get("operator"), item.get("effect")
        if not isinstance(operator, str) or operator not in OPERATORS:
            raise ValueError("rule operator must be lt, lte, gt, gte, eq, or ne")
        if not isinstance(effect, str) or effect not in EFFECTS:
            raise ValueError("rule effect must be weakened, falsified, or strengthened")
        age = item.get("maxAgeSeconds", DEFAULT_MAX_AGE_SECONDS)
        if isinstance(age, bool) or not isinstance(age, int) or not 1 <= age <= 315360000:
            raise ValueError("maxAgeSeconds must be an integer between 1 and 315360000")
        clean.append({"id": rule_id.strip(), "metric": metric.strip(), "operator": operator,
                      "threshold": decimal_string(finite_decimal(item.get("threshold"))),
                      "effect": effect, "maxAgeSeconds": age})
        ids.add(rule_id.strip())
    return clean


def _field_name(value: str) -> str:
    return re.sub(r"[_\s-]", "", value).casefold()


def _timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("source observation time is unknown")
    try:
        result = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError
        return result.astimezone(UTC)
    except (ValueError, OverflowError):
        raise ValueError("source observation time must be ISO-8601 with timezone") from None


def _pointer(payload: Any, pointer: Any) -> tuple[Any, str, list[dict[str, Any]]]:
    if not isinstance(pointer, str) or not pointer.startswith("/") or len(pointer) > 1000:
        raise ValueError("jsonPointer must locate a numeric leaf in the stored payload")
    current = payload
    ancestors = []
    parts = pointer[1:].split("/")
    for raw in parts:
        if re.search(r"~(?![01])", raw):
            raise ValueError("jsonPointer contains an invalid escape")
        key = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict):
            ancestors.append(current)
            if key not in current:
                raise ValueError("jsonPointer is absent from the stored payload")
            current = current[key]
        elif isinstance(current, list) and re.fullmatch(r"0|[1-9][0-9]*", key):
            index = int(key)
            if index >= len(current):
                raise ValueError("jsonPointer is absent from the stored payload")
            current = current[index]
        else:
            raise ValueError("jsonPointer is absent from the stored payload")
    return current, key, ancestors


def _non_factual(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_non_factual(item) or (item is True and (
            _field_name(key) in {"mock", "ismock", "estimate", "estimated", "isestimated", "synthetic", "issynthetic", "simulated", "issimulated", "derived", "isderived"}
            or _non_factual(key)
        )) for key, item in value.items())
    if isinstance(value, (list, tuple)):
        return any(_non_factual(item) for item in value)
    if not isinstance(value, str):
        return False
    return bool(re.search(r"(?:^|[^a-z])(mock|estimated?|synthetic|simulated|hypothetical)(?:$|[^a-z])", value.lower()))


def _fact(observation: dict[str, Any], symbol: str, lookup: Callable[[str], Any]) -> dict[str, Any]:
    evidence_id = observation.get("evidenceId")
    if not isinstance(evidence_id, str) or not evidence_id.strip():
        raise ValueError("evidenceId is required")
    record = lookup(evidence_id)
    if record is None:
        raise ValueError("evidenceId does not exist in the local ledger")
    data = record.to_dict() if hasattr(record, "to_dict") else record
    if not isinstance(data, dict):
        raise ValueError("invalid evidence record")
    value, leaf, ancestors = _pointer(data.get("payload"), observation.get("jsonPointer"))
    metric = observation["metric"]
    parent = ancestors[-1] if ancestors else {}
    descriptors = [parent.get("metric"), parent.get("name")]
    named_value = _field_name(leaf) == "value" and any(
        isinstance(item, str) and _field_name(item) == _field_name(metric) for item in descriptors
    )
    if _field_name(metric) != _field_name(leaf) and not named_value:
        raise ValueError("metric does not match the referenced numeric field")
    actual = finite_decimal(value)
    if "value" in observation and finite_decimal(observation["value"]) != actual:
        raise ValueError("supplied value differs from the immutable source fact")

    scoped_symbol = next((item["symbol"] for item in reversed(ancestors) if "symbol" in item), None)
    symbols = data.get("symbols") or []
    if scoped_symbol is not None:
        if not isinstance(scoped_symbol, str) or canonical_symbol(scoped_symbol) != canonical_symbol(symbol):
            raise ValueError("referenced fact belongs to a different symbol")
    elif len(symbols) != 1 or canonical_symbol(str(symbols[0])) != canonical_symbol(symbol):
        raise ValueError("referenced fact has no unambiguous matching symbol")

    quality = [data.get("quality"), data.get("source")]
    for item in ancestors:
        quality.extend(item.get(key) for key in ("quality", "priceType", "dataSource", "source", "provider", "priceSource", "quoteSource", "sourceHealth", "freshness"))
    if any(_non_factual(item) for item in quality):
        raise ValueError("mock, estimated, synthetic, or derived facts cannot verify a rule")

    source_time = data.get("observedAt")
    for item in reversed(ancestors):
        if "observedAt" in item or "observed_at" in item:
            source_time = item.get("observedAt", item.get("observed_at"))
            break
    observed = _timestamp(source_time)
    if "observedAt" in observation and _timestamp(observation["observedAt"]) != observed:
        raise ValueError("supplied observedAt differs from the immutable source time")
    return {"metric": metric, "value": decimal_string(actual), "observedAt": observed.isoformat().replace("+00:00", "Z"),
            "evidenceId": evidence_id, "jsonPointer": observation["jsonPointer"], "source": data.get("source"),
            "sourceUrl": data.get("sourceUrl"), "contentDigest": data.get("contentDigest")}


def evaluate_rules(
    rules: list[dict[str, Any]], observations: Any, *, symbol: str,
    lookup: Callable[[str], Any], now: datetime | None = None,
) -> dict[str, Any]:
    """Check all rules. Incomplete inputs never produce a lifecycle transition."""
    clean_rules = normalize_rules(rules)
    if not isinstance(observations, list) or len(observations) > 100:
        raise ValueError("observations must be an array of at most 100 source references")
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("review time must include timezone")
    by_metric: dict[str, list[dict[str, Any]]] = {}
    for observation in observations:
        if not isinstance(observation, dict) or not isinstance(observation.get("metric"), str) or not observation["metric"].strip() or len(observation["metric"]) > 100:
            raise ValueError("each observation must have a nonempty metric")
        by_metric.setdefault(_field_name(observation["metric"]), []).append(observation)

    results: list[dict[str, Any]] = []
    evidence_ids: list[str] = []
    for rule in clean_rules:
        result = {"ruleId": rule["id"], "metric": rule["metric"], "operator": rule["operator"],
                  "threshold": rule["threshold"], "effect": rule["effect"], "maxAgeSeconds": rule["maxAgeSeconds"]}
        candidates = by_metric.get(_field_name(rule["metric"]), [])
        try:
            if len(candidates) != 1:
                raise ValueError("missing observation" if not candidates else "multiple observations for one metric are ambiguous")
            fact = _fact(candidates[0], symbol, lookup)
            result["fact"] = fact
            if fact["evidenceId"] not in evidence_ids:
                evidence_ids.append(fact["evidenceId"])
            age = (now.astimezone(UTC) - _timestamp(fact["observedAt"])).total_seconds()
            if age < 0:
                raise ValueError("source observation time is in the future")
            if age > rule["maxAgeSeconds"]:
                raise ValueError("source observation is stale for this rule")
            left, right = finite_decimal(fact["value"]), finite_decimal(rule["threshold"])
            checks = {"lt": left < right, "lte": left <= right, "gt": left > right,
                      "gte": left >= right, "eq": left == right, "ne": left != right}
            result["status"] = "triggered" if checks[rule["operator"]] else "not_triggered"
        except (ValueError, TypeError, KeyError) as exc:
            result.update({"status": "inconclusive", "reason": str(exc)})
        results.append(result)

    complete = bool(results) and all(item["status"] != "inconclusive" for item in results)
    verdict = "unchanged"
    if complete:
        triggered = {item["effect"] for item in results if item["status"] == "triggered"}
        verdict = next((effect for effect in ("falsified", "weakened", "strengthened") if effect in triggered), "unchanged")
    return {"verificationStatus": "verified" if complete else "inconclusive", "decisionSource": "rule_verified" if complete else "none",
            "verdict": verdict, "ruleResults": results, "evidenceIds": evidence_ids,
            "methodology": "All conditions must have one matching immutable numeric fact, matching symbol, and a known source observation time within maxAgeSeconds. Trigger precedence: falsified, weakened, strengthened. No confidence score is inferred."}

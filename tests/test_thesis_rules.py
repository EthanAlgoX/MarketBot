"""A thesis verdict must be reproducible from fresh, matching ledger facts."""

import asyncio
import json
from datetime import UTC, datetime, timedelta

import pytest

from marketbot.agent.tools.thesis import ThesisTrackerTool
from marketbot.domain.market.evidence import EvidenceStore, EvidenceStoreError
from marketbot.domain.market.thesis import ThesisStore
from marketbot.domain.market.thesis_rules import evaluate_rules, normalize_rules

NOW = datetime(2026, 10, 3, 4, 0, tzinfo=UTC)
OBSERVED = (NOW - timedelta(minutes=5)).isoformat()


def _rule(**overrides):
    return {"id": "floor", "metric": "price", "operator": "lt", "threshold": "100", "effect": "falsified", **overrides}


def _quote(ledger, *, value="90", symbol="NVDA", observed_at=OBSERVED, quality=None, payload=None):
    return ledger.record(kind="quote", source="public_quote", symbols=[symbol], observed_at=observed_at,
                         quality=quality, payload=payload if payload is not None else {"quotes": [{"symbol": symbol, "price": value}]})


def _observation(record, **overrides):
    return {"metric": "price", "evidenceId": record.evidence_id, "jsonPointer": "/quotes/0/price", **overrides}


def _review(ledger, record, *, observations=None, rules=None, symbol="NVDA"):
    return evaluate_rules(rules if rules is not None else [_rule()],
                          observations if observations is not None else [_observation(record)],
                          symbol=symbol, lookup=ledger.get, now=NOW)


@pytest.mark.parametrize(("operator", "threshold", "triggered"), [
    ("lt", "100", True), ("lte", "90", True), ("gt", "90", False),
    ("gte", "90", True), ("eq", "90.0000", True), ("ne", "90", False),
])
def test_numeric_conditions_use_actual_decimal_source_facts(tmp_path, operator, threshold, triggered):
    ledger = EvidenceStore(tmp_path)
    record = _quote(ledger)
    review = _review(ledger, record, rules=[_rule(operator=operator, threshold=threshold)])
    assert review["verificationStatus"] == "verified"
    assert review["verdict"] == ("falsified" if triggered else "unchanged")
    assert review["ruleResults"][0]["fact"]["value"] == "90"
    assert review["ruleResults"][0]["fact"]["contentDigest"] == record.content_digest


def test_verified_review_binds_immutable_facts_and_preserves_zero_confidence(tmp_path):
    ledger, store = EvidenceStore(tmp_path), ThesisStore(tmp_path)
    source = _quote(ledger)
    thesis = store.create_thesis(symbol="NVDA", thesis="价格守住关键支撑", confidence=0, rules=[_rule()])

    updated, review = store.review_thesis(thesis.id, observations=[_observation(source)], evidence_store=ledger, now=NOW)

    assert updated.status == "inactive"
    assert updated.confidence == 0
    assert review["decisionSource"] == "rule_verified"
    assert updated.history[-1]["evidenceIds"] == [source.evidence_id]
    assert ledger.get_claim_evidence(review["claimId"])[0].evidence_id == source.evidence_id
    reloaded = ThesisStore(tmp_path).get_thesis(thesis.id)
    assert reloaded.confidence == 0
    assert reloaded.rules[0]["threshold"] == "100"
    assert reloaded.history[-1]["claimId"] == review["claimId"]


@pytest.mark.parametrize(("change", "reason"), [
    ({"value": "91"}, "supplied value"),
    ({"observedAt": NOW.isoformat()}, "supplied observedAt"),
    ({"jsonPointer": "/quotes/0/missing"}, "absent"),
    ({"jsonPointer": "/quotes/0"}, "numeric field"),
    ({"jsonPointer": "/quotes/0/~invalid"}, "invalid escape"),
    ({"evidenceId": "invented"}, "Invalid evidenceId"),
    ({"evidenceId": "ev_" + "0" * 64}, "does not exist"),
])
def test_real_evidence_id_cannot_support_invented_value_time_or_pointer(tmp_path, change, reason):
    ledger = EvidenceStore(tmp_path)
    record = _quote(ledger)
    review = _review(ledger, record, observations=[_observation(record, **change)])
    assert review["verificationStatus"] == "inconclusive"
    assert review["verdict"] == "unchanged"
    assert reason in review["ruleResults"][0]["reason"]


def test_metric_cannot_be_relabelled_from_unrelated_stored_field(tmp_path):
    ledger = EvidenceStore(tmp_path)
    record = _quote(ledger, payload={"quotes": [{"symbol": "NVDA", "price": "90", "volume": "1"}]})
    review = _review(ledger, record, observations=[_observation(record, jsonPointer="/quotes/0/volume")])
    assert review["verificationStatus"] == "inconclusive"
    assert "metric does not match" in review["ruleResults"][0]["reason"]


def test_named_numeric_fact_and_rfc6901_escaped_field_are_supported(tmp_path):
    ledger = EvidenceStore(tmp_path)
    record = _quote(ledger, payload={"facts": [{"symbol": "NVDA", "metric": "operatingMargin", "value": "24.50"}],
                                    "net/income~reported": "1"})
    review = _review(ledger, record, rules=[_rule(metric="operatingMargin", threshold="25")],
                     observations=[_observation(record, metric="operatingMargin", jsonPointer="/facts/0/value")])
    assert review["verificationStatus"] == "verified"
    escaped = _review(ledger, record, rules=[_rule(metric="net/income~reported", threshold="2")],
                      observations=[_observation(record, metric="net/income~reported", jsonPointer="/net~1income~0reported")])
    assert escaped["verdict"] == "falsified"


def test_named_fact_cannot_relabel_its_unrelated_numeric_metadata(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, payload={"facts": [{"symbol": "NVDA", "metric": "operatingMargin", "value": "24.50", "year": 2026}]})
    result = _review(ledger, source, rules=[_rule(metric="operatingMargin", threshold="25")],
                     observations=[_observation(source, metric="operatingMargin", jsonPointer="/facts/0/year")])
    assert result["verificationStatus"] == "inconclusive"
    assert "metric does not match" in result["ruleResults"][0]["reason"]


@pytest.mark.parametrize(("observed_at", "quality", "value", "reason"), [
    (None, None, "90", "unknown"),
    ((NOW - timedelta(days=2)).isoformat(), None, "90", "stale"),
    ((NOW + timedelta(seconds=1)).isoformat(), None, "90", "future"),
    (OBSERVED, {"freshness": "mock"}, "90", "synthetic"),
    (OBSERVED, {"priceType": "estimated"}, "90", "synthetic"),
    (OBSERVED, {"nested": {"synthetic": "synthetic"}}, "90", "synthetic"),
    (OBSERVED, {"synthetic": True}, "90", "synthetic"),
    (OBSERVED, {"isSynthetic": True}, "90", "synthetic"),
    (OBSERVED, {"derived": True}, "90", "derived"),
    (OBSERVED, None, "NaN", "finite"),
    (OBSERVED, None, "Infinity", "finite"),
    (OBSERVED, None, "1e100", "finite"),
])
def test_missing_stale_nonfactual_and_nonfinite_facts_never_change_lifecycle(tmp_path, observed_at, quality, value, reason):
    ledger, store = EvidenceStore(tmp_path), ThesisStore(tmp_path)
    record = _quote(ledger, value=value, observed_at=observed_at, quality=quality)
    thesis = store.create_thesis(symbol="NVDA", thesis="支撑有效", confidence=.7, rules=[_rule()])
    reviewed, result = store.review_thesis(thesis.id, observations=[_observation(record)], evidence_store=ledger, now=NOW)
    assert result["verificationStatus"] == "inconclusive"
    assert reason in result["ruleResults"][0]["reason"]
    assert reviewed.status == thesis.status
    assert reviewed.confidence == thesis.confidence


def test_row_unknown_time_does_not_borrow_batch_observation_or_retrieval_time(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, payload={"quotes": [{"symbol": "NVDA", "price": "90", "observedAt": None}]})
    assert _review(ledger, source)["verificationStatus"] == "inconclusive"
    retrieved_only = ledger.record(kind="quote", source="public_quote", payload={"price": "90"}, symbols=["NVDA"], retrieved_at=OBSERVED)
    result = _review(ledger, retrieved_only, observations=[_observation(retrieved_only, jsonPointer="/price")])
    assert result["verificationStatus"] == "inconclusive"


def test_delayed_actual_quote_can_verify_explicit_age_policy(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, observed_at=(NOW - timedelta(days=2)).isoformat(), quality={"freshness": "delayed"})
    result = _review(ledger, source, rules=[_rule(maxAgeSeconds=3 * 86400)])
    assert result["verificationStatus"] == "verified"


def test_explicitly_original_source_fact_is_still_eligible(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, quality={"derived": False})
    assert _review(ledger, source)["verificationStatus"] == "verified"


def test_quote_provider_mock_is_rejected_even_when_record_source_is_a_tool(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, payload={"quotes": [{"symbol": "NVDA", "price": "90", "provider": "mock"}]})
    assert _review(ledger, source)["verificationStatus"] == "inconclusive"


def test_nonstandard_and_overflowing_row_times_are_inconclusive(tmp_path):
    ledger = EvidenceStore(tmp_path)
    for source_time in ("2026-10-03T03:55:00", "0001-01-01T00:00:00+23:59"):
        source = _quote(ledger, payload={"quotes": [{"symbol": "NVDA", "price": "90", "observedAt": source_time}]})
        assert _review(ledger, source)["verificationStatus"] == "inconclusive"


def test_other_symbol_or_ambiguous_batch_facts_cannot_verify_a_thesis(tmp_path):
    ledger = EvidenceStore(tmp_path)
    wrong = _quote(ledger, symbol="AMD")
    assert _review(ledger, wrong)["verificationStatus"] == "inconclusive"
    batch = ledger.record(kind="quote", source="public_quote", symbols=["NVDA", "AMD"], observed_at=OBSERVED, payload={"price": "90"})
    assert _review(ledger, batch, observations=[_observation(batch, jsonPointer="/price")])["verificationStatus"] == "inconclusive"


def test_symbol_aliases_match_without_borrowing_other_row_fact(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger, symbol="0700.HK")
    assert _review(ledger, source, symbol="00700.HK")["verificationStatus"] == "verified"


def test_missing_or_ambiguous_conditions_block_even_other_valid_falsification(tmp_path):
    ledger = EvidenceStore(tmp_path)
    source = _quote(ledger)
    rules = [_rule(), _rule(id="margin", metric="margin")]
    incomplete = _review(ledger, source, rules=rules)
    assert incomplete["verdict"] == "unchanged"
    assert incomplete["verificationStatus"] == "inconclusive"
    duplicated = _review(ledger, source, observations=[_observation(source), _observation(source)])
    assert duplicated["verificationStatus"] == "inconclusive"
    assert _review(ledger, source, rules=[])["verificationStatus"] == "inconclusive"


def test_rule_precedence_is_explicit_and_does_not_reopen_closed_theses(tmp_path):
    ledger, store = EvidenceStore(tmp_path), ThesisStore(tmp_path)
    source = _quote(ledger)
    rules = [_rule(effect="strengthened"), _rule(id="other", effect="weakened")]
    assert _review(ledger, source, rules=rules)["verdict"] == "weakened"
    thesis = store.create_thesis(symbol="NVDA", thesis="观察支撑", rules=[_rule(effect="strengthened")])
    store.update_thesis(thesis.id, status="closed")
    record, result = store.review_thesis(thesis.id, observations=[_observation(source)], evidence_store=ledger, now=NOW)
    assert result["verdict"] == "strengthened"
    assert record.status == "closed"


@pytest.mark.parametrize("bad", [
    {}, [_rule(id="")], [_rule(), _rule()], [_rule(operator="guess")], [_rule(effect="buy")],
    [_rule(threshold=True)], [_rule(threshold="NaN")], [_rule(maxAgeSeconds=0)], [_rule(maxAgeSeconds=True)],
])
def test_invalid_rule_inputs_fail_before_persistence(bad):
    with pytest.raises(ValueError):
        normalize_rules(bad)


def _execute(tool, **kwargs):
    return json.loads(asyncio.run(tool.execute(**kwargs)))


def test_negative_sentiment_is_observation_and_explicit_verdict_is_marked_declared(tmp_path):
    tool = ThesisTrackerTool(workspace=tmp_path)
    thesis = _execute(tool, action="create", symbol="NVDA", thesis="需求增长", confidence=0)["thesis"]
    passive = _execute(tool, action="update", thesisId=thesis["id"], evidence="miss weak bearish downgrade selloff risk 爆雷")
    assert passive["derivedSentiment"]["score"] < -.55
    assert passive["verdict"] == "unchanged"
    assert passive["decisionSource"] == "observation"
    assert passive["thesis"]["status"] == "active"
    assert passive["thesis"]["confidence"] == 0
    declared = _execute(tool, action="update", thesisId=thesis["id"], verdict="falsified", note="用户判断")
    assert declared["thesis"]["status"] == "inactive"
    assert declared["decisionSource"] == "declared"
    assert declared["verificationStatus"] == "unverified_declaration"


def test_tool_persists_rules_and_reviews_by_real_evidence_reference(tmp_path):
    tool = ThesisTrackerTool(workspace=tmp_path)
    now = datetime.now(UTC)
    source = _quote(tool._evidence_store, observed_at=(now - timedelta(seconds=1)).isoformat())
    created = _execute(tool, action="create", symbol="NVDA", thesis="价格支撑", rules=[_rule()])
    thesis_id = created["thesis"]["id"]
    result = _execute(tool, action="review", thesisId=thesis_id, observations=[_observation(source)])
    assert result["verdict"] == "falsified"
    assert result["verificationStatus"] == "verified"
    assert result["thesis"]["status"] == "inactive"
    assert _execute(tool, action="update", thesisId=thesis_id, note="继续观察")["thesis"]["rules"]
    assert _execute(tool, action="update", thesisId=thesis_id, rules=[])["thesis"]["rules"] == []


def test_review_cannot_hide_manual_lifecycle_overrides(tmp_path):
    tool = ThesisTrackerTool(workspace=tmp_path)
    thesis_id = _execute(tool, action="create", symbol="NVDA", thesis="价格支撑", rules=[_rule()])["thesis"]["id"]
    before = (tmp_path / "data" / "theses.json").read_bytes()
    result = _execute(tool, action="review", thesisId=thesis_id, verdict="falsified")
    assert result["error"]["type"] == "invalid_input"
    assert (tmp_path / "data" / "theses.json").read_bytes() == before


@pytest.mark.parametrize("kwargs", [{"rules": {}}, {"confidence": float("nan")}, {"confidence": 10 ** 1000}])
def test_malformed_create_inputs_return_error_without_persisting(tmp_path, kwargs):
    result = _execute(ThesisTrackerTool(workspace=tmp_path), action="create", symbol="NVDA", thesis="价格支撑", **kwargs)
    assert result["error"]["type"] == "invalid_input"
    assert not (tmp_path / "data" / "theses.json").exists()


def test_malformed_observation_collection_is_not_silently_treated_as_empty(tmp_path):
    tool = ThesisTrackerTool(workspace=tmp_path)
    thesis_id = _execute(tool, action="create", symbol="NVDA", thesis="价格支撑", rules=[_rule()])["thesis"]["id"]
    before = (tmp_path / "data" / "theses.json").read_bytes()
    result = _execute(tool, action="review", thesisId=thesis_id, observations={})
    assert result["error"]["type"] == "invalid_input"
    assert (tmp_path / "data" / "theses.json").read_bytes() == before


def test_declared_evidence_ids_are_validated_without_claiming_rule_verification(tmp_path):
    tool = ThesisTrackerTool(workspace=tmp_path)
    source = _quote(tool._evidence_store)
    thesis_id = _execute(tool, action="create", symbol="NVDA", thesis="需求增长")["thesis"]["id"]
    result = _execute(tool, action="update", thesisId=thesis_id, verdict="weakened", evidenceIds=[source.evidence_id])
    assert result["verificationStatus"] == "unverified_declaration"
    event = result["thesis"]["history"][-1]
    assert tool._evidence_store.get_claim_evidence(event["claimId"])[0].evidence_id == source.evidence_id
    before = (tmp_path / "data" / "theses.json").read_bytes()
    failed = _execute(tool, action="update", thesisId=thesis_id, verdict="falsified", evidenceIds=["invented"])
    assert failed["error"]["type"] == "invalid_input"
    assert (tmp_path / "data" / "theses.json").read_bytes() == before


def test_ledger_binding_failure_preserves_original_thesis_file(tmp_path, monkeypatch):
    ledger, store = EvidenceStore(tmp_path), ThesisStore(tmp_path)
    source = _quote(ledger)
    thesis = store.create_thesis(symbol="NVDA", thesis="价格支撑", rules=[_rule()])
    before = (tmp_path / "data" / "theses.json").read_bytes()

    def fail(*args):
        raise EvidenceStoreError("ledger unavailable")

    monkeypatch.setattr(ledger, "bind_claim", fail)
    with pytest.raises(EvidenceStoreError):
        store.review_thesis(thesis.id, observations=[_observation(source)], evidence_store=ledger, now=NOW)
    assert (tmp_path / "data" / "theses.json").read_bytes() == before

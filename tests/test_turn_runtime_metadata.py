from marketbot.agent.turn_runtime import build_response_metadata


class _FakeLoop:
    def __init__(self) -> None:
        self._last_route_decision = {"mode": "planned_task", "reason": "multi_step_intent"}
        self._last_plan_summary = {"id": "plan_123", "stepCount": 2}
        self._last_plan_path = "/tmp/plan_123.json"
        self._last_skill_fallback = None

        class _FakeProcessor:
            @staticmethod
            def get_last_skill_routing():
                return {"selected": [{"name": "market-report"}]}

        self.processor = _FakeProcessor()


def test_build_response_metadata_includes_route_and_plan_fields() -> None:
    loop = _FakeLoop()

    metadata = build_response_metadata(
        loop,
        msg_metadata={"message_id": "m1"},
        usage={"total_tokens": 42},
        explainability=None,
        external_skill_suggestions=None,
        report_path=None,
    )

    assert metadata["message_id"] == "m1"
    assert metadata["route_decision"] == {"mode": "planned_task", "reason": "multi_step_intent"}
    assert metadata["plan"] == {"id": "plan_123", "stepCount": 2}
    assert metadata["plan_path"] == "/tmp/plan_123.json"
    assert metadata["usage"] == {"total_tokens": 42}
    assert metadata["skill_routing"] == {"selected": [{"name": "market-report"}]}

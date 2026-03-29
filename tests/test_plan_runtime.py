import json

import pytest

from marketbot.agent.plan_models import ExecutionPlan, PlanStep, StepResult
from marketbot.agent.plan_runtime import PlanRuntime
from marketbot.agent.verifier import StepVerifier


class _FakeSession:
    def __init__(self) -> None:
        self.key = "cli:direct"
        self.metadata: dict[str, str] = {}


class _FakeExecutor:
    async def execute_step(self, **kwargs) -> StepResult:
        step = kwargs["step"]
        return StepResult(
            step_id=step.id,
            status="completed",
            summary=f"completed {step.title}",
            raw_output=f"completed {step.title}",
            tool_calls=list(step.allowed_tools[:1]),
            messages=[{"role": "tool", "content": '{"ok": true}'}],
            usage={"total_tokens": 1},
        )


class _FakeLoop:
    def __init__(self, workspace):
        self.workspace = workspace
        self.executor = _FakeExecutor()
        self.verifier = StepVerifier()
        self._last_plan_path = None

        class _FakeProcessor:
            @staticmethod
            def get_recent_history(session):
                return []

        self.processor = _FakeProcessor()

    @staticmethod
    def _merge_usage(total, usage):
        merged = dict(total or {})
        for key, value in (usage or {}).items():
            merged[key] = merged.get(key, 0) + value
        merged["calls"] = merged.get("calls", 0) + (1 if usage else 0)
        return merged


@pytest.mark.asyncio
async def test_plan_runtime_persists_snapshot(tmp_path) -> None:
    loop = _FakeLoop(tmp_path)
    session = _FakeSession()
    runtime = PlanRuntime()
    plan = ExecutionPlan(
        id="plan_test",
        goal="请分步骤研究 NVDA 并输出报告",
        steps=[
            PlanStep(id="step-1", title="Collect Context", instruction="collect", allowed_tools=["read_file"]),
            PlanStep(id="step-2", title="Produce Final Answer", instruction="answer"),
        ],
        current_step_id="step-1",
    )

    final_content, tools_used, _messages, usage = await runtime.run_plan(
        loop=loop,
        plan=plan,
        session=session,
        channel="cli",
        chat_id="direct",
        on_progress=None,
    )

    assert final_content == "completed Produce Final Answer"
    assert tools_used == ["read_file"]
    assert usage["total_tokens"] == 2
    assert loop._last_plan_path is not None

    payload = json.loads((tmp_path / "plans" / "plan_test.json").read_text(encoding="utf-8"))
    assert payload["goal"] == "请分步骤研究 NVDA 并输出报告"
    assert [step["title"] for step in payload["steps"]] == ["Collect Context", "Produce Final Answer"]
    assert payload["final_content_preview"] == "completed Produce Final Answer"
    assert session.metadata == {}

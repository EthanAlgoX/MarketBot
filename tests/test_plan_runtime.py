import asyncio
import json
from copy import deepcopy
from types import SimpleNamespace

import pytest

from marketbot.agent.executor import AgentExecutor
from marketbot.agent.plan_models import ExecutionPlan, PlanStep, StepResult
from marketbot.agent.plan_runtime import PlanRuntime
from marketbot.agent.runner import AgentRunResult
from marketbot.agent.tool_runtime import active_tool_scope
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


@pytest.mark.parametrize("omit_session_history", [False, True])
async def test_plan_evidence_reaches_final_prompt_without_duplicate_session_history(tmp_path, omit_session_history):
    session = _FakeSession()
    session.messages = [
        {"role": "user", "content": [{"type": "text", "text": "previous question"}]},
        {"role": "assistant", "content": "previous answer"},
    ]
    original = deepcopy(session.messages)
    session.metadata["user_setting"] = "preserve"
    evidence = {
        "asOf": "2026-10-02T01:00:00Z", "source": "test-source",
        "quotes": [{"symbol": "SPY", "price": 123, "currency": "USD"}],
        "warnings": ["delayed"], "sourceHealth": {"test-source": {"status": "degraded"}},
    }
    prompts = []
    loop = _FakeLoop(tmp_path)

    class Processor:
        def get_recent_history(self, current):
            return current.messages

        def build_messages(self, *, session, current_message, routing_message, **kwargs):
            assert routing_message == "Research SPY with source provenance"
            prior = [] if omit_session_history else session.messages
            return [{"role": "system", "content": "system"}, *prior,
                    {"role": "user", "content": current_message}]

    class Runner:
        async def run(self, spec):
            prompts.append(deepcopy(spec.initial_messages))
            messages = spec.initial_messages
            if len(prompts) == 1:
                assert active_tool_scope(loop) == {"market_snapshot"}
                messages.extend([
                    {"role": "assistant", "content": "", "tool_calls": [{
                        "id": "quote-1", "type": "function", "function": {
                            "name": "market_snapshot", "arguments": '{"symbols":["SPY"]}'
                        }
                    }]},
                    {"role": "tool", "tool_call_id": "quote-1", "name": "market_snapshot", "content": json.dumps(evidence)},
                    {"role": "assistant", "content": "collected SPY evidence"},
                ])
                tools_used = ["market_snapshot"]
            else:
                assert active_tool_scope(loop) == set()
                assert json.loads(next(message["content"] for message in messages if message["role"] == "tool")) == evidence
                messages.append({"role": "assistant", "content": "final evidence-based answer"})
                tools_used = []
            return AgentRunResult(final_content=messages[-1]["content"], messages=messages,
                                  tools_used=tools_used, usage={"total_tokens": 1})

    loop.processor = Processor()
    loop.runner = Runner()
    loop.executor = AgentExecutor(loop)
    plan = ExecutionPlan(id="evidence_plan", goal="Research SPY with source provenance", steps=[
        PlanStep(id="collect", title="Collect", instruction="fetch evidence", allowed_tools=["market_snapshot"]),
        PlanStep(id="answer", title="Answer", instruction="use collected evidence"),
    ])
    final, tools, messages, _ = await PlanRuntime().run_plan(
        loop=loop, plan=plan, session=session, channel="cli", chat_id="direct"
    )
    assert final == "final evidence-based answer"
    assert tools == ["market_snapshot"]
    assert session.messages == original
    assert session.metadata == {"user_setting": "preserve"}
    assert [step.status for step in plan.steps] == ["completed", "completed"]
    assert messages.count(original[0]) == 1
    assert sum(message["role"] == "system" for message in messages) == 1
    assert sum(message["role"] == "tool" for message in prompts[-1]) == 1
    assert (original[0] in prompts[-1]) is not omit_session_history
    assert "Research SPY with source provenance" in prompts[0][-1]["content"]
    # The provider-facing transcript and the session contain independent objects.
    messages[1]["content"][0]["text"] = "provider mutation"
    assert session.messages == original


async def test_retry_sees_previous_attempt_evidence_and_verifies_again(tmp_path):
    loop = _FakeLoop(tmp_path)
    calls = []
    verifier_calls = []

    class Executor:
        async def execute_step(self, **kwargs):
            history = kwargs["history"]
            calls.append(deepcopy(history))
            number = len(calls)
            result = {"role": "tool", "tool_call_id": str(number), "content": f"attempt-{number}"}
            return StepResult(step_id=kwargs["step"].id,
                              status="partial" if number == 1 else "completed",
                              summary=f"attempt {number}", messages=[*history, result])

    class Verifier(StepVerifier):
        def evaluate(self, **kwargs):
            verifier_calls.append(kwargs["step_result"].status)
            return super().evaluate(**kwargs)

    loop.executor, loop.verifier = Executor(), Verifier()
    session = _FakeSession()
    plan = ExecutionPlan(id="retry_plan", goal="test", steps=[PlanStep(id="step", title="step", instruction="test")])
    _, _, messages, _ = await PlanRuntime().run_plan(loop=loop, plan=plan, session=session, channel="cli", chat_id="direct")
    assert calls[0] == []
    assert calls[1][0]["content"] == "attempt-1"
    assert verifier_calls == ["partial", "completed"]
    assert [message["content"] for message in messages] == ["attempt-1", "attempt-2"]
    assert plan.steps[0].status == "completed"


async def test_step_classification_does_not_reapply_historical_tool_failures():
    historical_error = {"role": "tool", "content": '{"error":{"message":"previous step failed"}}'}
    loop = SimpleNamespace()

    class Processor:
        def build_messages(self, **kwargs):
            return [{"role": "system", "content": "system"}, {"role": "user", "content": kwargs["current_message"]}]

    class Runner:
        async def run(self, spec):
            messages = [*spec.initial_messages, {"role": "assistant", "content": "qualified answer with data gaps"}]
            return AgentRunResult(final_content=messages[-1]["content"], messages=messages)

    loop.processor, loop.runner = Processor(), Runner()
    result = await AgentExecutor(loop).execute_step(
        session=_FakeSession(), step=PlanStep(id="final", title="Answer", instruction="summarize"),
        channel="cli", chat_id="direct", history=[historical_error], plan_goal="research",
    )
    assert result.status == "completed"
    assert historical_error in result.messages


@pytest.mark.parametrize("failure", [RuntimeError("executor failed"), asyncio.CancelledError()])
async def test_plan_clears_temporary_metadata_when_execution_fails(tmp_path, failure):
    loop = _FakeLoop(tmp_path)
    session = _FakeSession()
    session.metadata["user_setting"] = "preserve"

    class Executor:
        async def execute_step(self, **kwargs):
            raise failure

    loop.executor = Executor()
    plan = ExecutionPlan(id="failed_plan", goal="test", steps=[PlanStep(id="step", title="step", instruction="test")])
    with pytest.raises(type(failure)):
        await PlanRuntime().run_plan(loop=loop, plan=plan, session=session, channel="cli", chat_id="direct")
    assert session.metadata == {"user_setting": "preserve"}
    assert plan.steps[0].status == "failed"
    snapshot = json.loads((tmp_path / "plans" / "failed_plan.json").read_text())
    assert snapshot["steps"][0]["status"] == "failed"

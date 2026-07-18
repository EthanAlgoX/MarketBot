import asyncio
from types import SimpleNamespace

from marketbot.agent.turn_orchestrator import MarketTurnOrchestrator, TurnExecutionRequest
from marketbot.bus.events import InboundMessage
from marketbot.session.manager import Session


def test_turn_orchestrator_runs_shared_market_pipeline() -> None:
    calls: list[tuple] = []
    session = Session(key="cli:direct")
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="Analyze NVDA")

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    class _Loop:
        _last_route_decision = {"mode": "direct_react", "reason": "test"}
        processor = _Processor()

        @staticmethod
        async def _run_agent_loop(messages, on_progress=None):
            calls.append(("run", messages, on_progress is not None))
            return "draft", ["market_snapshot"], [{"role": "assistant", "content": "draft"}], {"total_tokens": 11}

        @staticmethod
        def _build_bus_progress_callback(msg):
            async def _progress(content: str, *, tool_hint: bool = False) -> None:
                calls.append(("progress", content, tool_hint))

            return _progress

        @staticmethod
        def _classify_skill_outcome(**kwargs):
            return "success"

        @staticmethod
        async def _retry_turn_with_fallback(**kwargs):
            return [], None, None, None, None

        @staticmethod
        def _normalize_daily_opportunity_report(content):
            return f"normalized:{content}"

        @staticmethod
        def _finalize_response_content(content, **kwargs):
            calls.append(("finalize", kwargs["channel"], kwargs["append_inline_explainability"]))
            return f"final:{content}", {"summary": "ok"}, [], None

        @staticmethod
        def _record_completed_turn(**kwargs):
            calls.append(("record", kwargs["history_len"], kwargs["tools_used"]))

        @staticmethod
        def _build_response_metadata(**kwargs):
            return {"usage": kwargs["usage"], "explainability": kwargs["explainability"]}

    result = asyncio.run(
        MarketTurnOrchestrator(_Loop()).execute(
            TurnExecutionRequest(
                msg=msg,
                session=session,
                history=[{"role": "user", "content": "old"}],
                initial_messages=[{"role": "system", "content": "prompt"}],
                channel="cli",
                chat_id="direct",
                request_text=msg.content,
                default_route_mode="direct_react",
                append_inline_explainability=True,
                normalize_daily_report=True,
            )
        )
    )

    assert result.final_content == "final:normalized:draft"
    assert result.metadata == {"usage": {"total_tokens": 11}, "explainability": {"summary": "ok"}}
    assert calls == [
        ("run", [{"role": "system", "content": "prompt"}], True),
        ("finalize", "cli", True),
        ("record", 1, ["market_snapshot"]),
    ]


def test_turn_orchestrator_sets_plan_summary_for_planned_tasks() -> None:
    session = Session(key="cli:direct")
    msg = InboundMessage(channel="cli", sender_id="user", chat_id="direct", content="研究 NVDA 并输出报告")
    plan = SimpleNamespace(
        id="plan-1",
        mode="serial",
        steps=[SimpleNamespace(title="Collect"), SimpleNamespace(title="Write")],
    )

    class _Processor:
        @staticmethod
        def get_last_skill_routing():
            return {}

    class _Planner:
        @staticmethod
        def create_plan(**kwargs):
            return plan

    class _PlanRuntime:
        @staticmethod
        async def run_plan(**kwargs):
            return "planned", ["market_news"], [{"role": "assistant", "content": "planned"}], {"total_tokens": 7}

    class _Loop:
        _last_route_decision = {"mode": "planned_task", "reason": "multi_step_intent"}
        processor = _Processor()
        planner = _Planner()
        plan_runtime = _PlanRuntime()

        @staticmethod
        def _visible_tool_names():
            return {"market_news"}

        @staticmethod
        def _build_bus_progress_callback(msg):
            async def _progress(content: str, *, tool_hint: bool = False) -> None:
                return None

            return _progress

        @staticmethod
        def _classify_skill_outcome(**kwargs):
            return "success"

        @staticmethod
        async def _retry_turn_with_fallback(**kwargs):
            return [], None, None, None, None

        @staticmethod
        def _finalize_response_content(content, **kwargs):
            return content, None, [], None

        @staticmethod
        def _record_completed_turn(**kwargs):
            return None

        def _build_response_metadata(self, **kwargs):
            return {"plan": self._last_plan_summary}

    loop = _Loop()
    result = asyncio.run(
        MarketTurnOrchestrator(loop).execute(
            TurnExecutionRequest(
                msg=msg,
                session=session,
                history=[],
                initial_messages=[{"role": "system", "content": "prompt"}],
                channel="cli",
                chat_id="direct",
                request_text=msg.content,
                default_route_mode="direct_react",
                append_inline_explainability=True,
            )
        )
    )

    assert result.final_content == "planned"
    assert result.metadata["plan"] == {
        "id": "plan-1",
        "mode": "serial",
        "stepCount": 2,
        "steps": ["Collect", "Write"],
    }

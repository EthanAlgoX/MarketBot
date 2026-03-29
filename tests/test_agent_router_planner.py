from pathlib import Path

from marketbot.agent.executor import classify_execution_outcome
from marketbot.agent.plan_runtime import PlanRuntime
from marketbot.agent.planner import TaskPlanner
from marketbot.agent.router import RequestRouter


def test_request_router_detects_planned_task() -> None:
    router = RequestRouter()

    decision = router.decide(text="请分步骤研究 NVDA 并输出报告", channel="cli")

    assert decision.mode == "planned_task"
    assert decision.reason == "multi_step_intent"


def test_request_router_detects_market_fast_path() -> None:
    router = RequestRouter()

    decision = router.decide(text="今日机会", channel="cli")

    assert decision.mode == "market_fast_path"
    assert decision.reason == "market_scan"


def test_task_planner_builds_collect_and_finalize_steps() -> None:
    planner = TaskPlanner()

    plan = planner.create_plan(
        request_text="请分步骤研究 NVDA 并输出报告",
        visible_tools={"read_file", "web_search", "market_news", "write_file"},
        route_mode="planned_task",
    )

    assert plan.goal == "请分步骤研究 NVDA 并输出报告"
    assert plan.mode == "serial"
    assert plan.current_step_id == "step-1"
    assert [step.title for step in plan.steps] == ["Collect Context", "Produce Final Answer"]
    assert "web_search" in plan.steps[0].allowed_tools
    assert plan.steps[-1].allowed_tools == []


def test_classify_execution_outcome_distinguishes_success_and_failure() -> None:
    success = classify_execution_outcome(
        final_content="done",
        messages=[{"role": "tool", "content": '{"ok": true}'}],
        tools_used=["web_search"],
    )
    failure = classify_execution_outcome(
        final_content="Error happened",
        messages=[{"role": "tool", "content": '{"error": {"message": "boom"}}'}],
        tools_used=["web_search"],
    )

    assert success == "success"
    assert failure == "failure"


def test_plan_runtime_uses_workspace_plans_dir(tmp_path: Path) -> None:
    runtime = PlanRuntime()
    loop = type("Loop", (), {"workspace": tmp_path})()

    assert runtime._plans_dir(loop) == tmp_path / "plans"

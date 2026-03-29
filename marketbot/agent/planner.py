"""Deterministic minimal planner for multi-step tasks."""

from __future__ import annotations

import uuid
from typing import Any

from marketbot.agent.plan_models import ExecutionPlan, PlanStep


class TaskPlanner:
    """Generate a small structured plan without introducing new LLM dependencies."""

    _READ_PREFERRED = (
        "read_file",
        "list_dir",
        "web_search",
        "web_fetch",
        "browser_site",
        "browser_page",
        "market_snapshot",
        "market_news",
        "market_macro",
        "market_brief",
    )
    _WRITE_PREFERRED = (
        "write_file",
        "edit_file",
        "exec",
        "message",
        "cron",
        "lark_cli",
        "twitter_cli",
        "xiaohongshu_cli",
    )

    def create_plan(
        self,
        *,
        request_text: str,
        visible_tools: set[str],
        route_mode: str,
    ) -> ExecutionPlan:
        """Build a deterministic serial plan for complex requests."""
        steps: list[PlanStep] = []
        read_tools = [name for name in self._READ_PREFERRED if name in visible_tools]
        write_tools = [name for name in self._WRITE_PREFERRED if name in visible_tools]
        normalized = str(request_text or "").strip()
        lowered = normalized.lower()

        if read_tools:
            steps.append(
                PlanStep(
                    id="step-1",
                    title="Collect Context",
                    instruction=(
                        "Collect only the information needed for the user's task. "
                        "Prefer the most relevant sources and avoid unnecessary tool calls."
                    ),
                    allowed_tools=read_tools[:6],
                    success_criteria="The key facts, files, or market signals needed for the task are available.",
                )
            )

        mutation_markers = ("发送", "发布", "写入", "修改", "保存", "schedule", "post", "write", "edit")
        if write_tools and any(marker in lowered for marker in mutation_markers):
            steps.append(
                PlanStep(
                    id=f"step-{len(steps) + 1}",
                    title="Execute Requested Action",
                    instruction=(
                        "Perform the requested mutation carefully. "
                        "Do not make unrelated changes and do not repeat read-only work."
                    ),
                    allowed_tools=write_tools[:4],
                    success_criteria="The requested action has been executed or a concrete blocking reason was found.",
                )
            )

        steps.append(
            PlanStep(
                id=f"step-{len(steps) + 1}",
                title="Produce Final Answer",
                instruction=(
                    f"Answer the user request directly: {normalized}\n\n"
                    "Use the evidence already collected in this plan. "
                    "Do not call tools unless they are explicitly allowed for this step."
                ),
                allowed_tools=[],
                success_criteria="A clear final answer is produced for the user.",
            )
        )

        plan_id = f"plan_{uuid.uuid4().hex[:8]}"
        return ExecutionPlan(
            id=plan_id,
            goal=normalized,
            mode="serial",
            steps=steps,
            current_step_id=steps[0].id if steps else None,
        )

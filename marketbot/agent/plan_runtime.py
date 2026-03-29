"""Minimal serial plan runtime."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

from marketbot.agent.plan_models import ExecutionPlan


class PlanRuntime:
    """Execute a small serial plan via the shared executor."""

    def _plans_dir(self, loop: Any) -> Path:
        """Return the workspace directory used for plan snapshots."""
        return loop.workspace / "plans"

    def _plan_snapshot_path(self, loop: Any, plan: ExecutionPlan) -> Path:
        """Return the canonical JSON snapshot path for a plan."""
        return self._plans_dir(loop) / f"{plan.id}.json"

    def _persist_plan_snapshot(
        self,
        loop: Any,
        *,
        plan: ExecutionPlan,
        session: Any,
        channel: str,
        chat_id: str,
        final_content: str | None,
        usage_totals: dict[str, int],
        last_step_result: Any | None = None,
        last_decision: Any | None = None,
    ) -> Path:
        """Persist one JSON snapshot of the current plan state."""
        plans_dir = self._plans_dir(loop)
        plans_dir.mkdir(parents=True, exist_ok=True)
        path = self._plan_snapshot_path(loop, plan)
        payload = {
            "id": plan.id,
            "goal": plan.goal,
            "mode": plan.mode,
            "current_step_id": plan.current_step_id,
            "steps": plan.to_dict().get("steps", []),
            "session_key": getattr(session, "key", ""),
            "channel": channel,
            "chat_id": chat_id,
            "final_content_preview": (str(final_content or "")[:500] if final_content else ""),
            "usage": usage_totals,
            "updated_at": datetime.now().isoformat(),
        }
        if last_step_result is not None and hasattr(last_step_result, "to_dict"):
            payload["last_step_result"] = last_step_result.to_dict()
        if last_decision is not None and hasattr(last_decision, "to_dict"):
            payload["last_decision"] = last_decision.to_dict()
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    async def run_plan(
        self,
        *,
        loop: Any,
        plan: ExecutionPlan,
        session: Any,
        channel: str,
        chat_id: str,
        on_progress: Callable[[str], Awaitable[None]] | None = None,
    ) -> tuple[str | None, list[str], list[dict[str, Any]], dict[str, int]]:
        """Execute a plan step by step and return a loop-compatible result tuple."""
        all_tools_used: list[str] = []
        last_messages: list[dict[str, Any]] = []
        usage_totals: dict[str, int] = {}
        final_content: str | None = None

        session.metadata["active_plan_id"] = plan.id
        session.metadata["current_step_id"] = plan.current_step_id
        loop._last_plan_path = str(self._persist_plan_snapshot(
            loop,
            plan=plan,
            session=session,
            channel=channel,
            chat_id=chat_id,
            final_content=final_content,
            usage_totals=usage_totals,
        ))

        for step in plan.steps:
            plan.current_step_id = step.id
            session.metadata["current_step_id"] = step.id
            step.status = "running"
            if on_progress is not None:
                await on_progress(f"Plan step `{step.title}`", tool_hint=False)

            step_result = await loop.executor.execute_step(
                session=session,
                step=step,
                channel=channel,
                chat_id=chat_id,
                history=loop.processor.get_recent_history(session),
                on_progress=on_progress,
            )
            decision = loop.verifier.evaluate(step=step, step_result=step_result)
            usage_totals = loop._merge_usage(usage_totals, step_result.usage)
            all_tools_used.extend(step_result.tool_calls)
            last_messages = step_result.messages or last_messages
            final_content = step_result.summary or final_content
            loop._last_plan_path = str(self._persist_plan_snapshot(
                loop,
                plan=plan,
                session=session,
                channel=channel,
                chat_id=chat_id,
                final_content=final_content,
                usage_totals=usage_totals,
                last_step_result=step_result,
                last_decision=decision,
            ))

            if decision.outcome == "advance":
                step.status = "completed"
                continue
            if decision.outcome == "retry":
                retry_result = await loop.executor.execute_step(
                    session=session,
                    step=step,
                    channel=channel,
                    chat_id=chat_id,
                    history=loop.processor.get_recent_history(session),
                    on_progress=on_progress,
                )
                usage_totals = loop._merge_usage(usage_totals, retry_result.usage)
                all_tools_used.extend(retry_result.tool_calls)
                last_messages = retry_result.messages or last_messages
                final_content = retry_result.summary or final_content
                loop._last_plan_path = str(self._persist_plan_snapshot(
                    loop,
                    plan=plan,
                    session=session,
                    channel=channel,
                    chat_id=chat_id,
                    final_content=final_content,
                    usage_totals=usage_totals,
                    last_step_result=retry_result,
                ))
                if retry_result.status == "completed":
                    step.status = "completed"
                    continue
                step.status = "failed"
                break
            step.status = "failed"
            break

        session.metadata.pop("current_step_id", None)
        session.metadata.pop("active_plan_id", None)
        loop._last_plan_path = str(self._persist_plan_snapshot(
            loop,
            plan=plan,
            session=session,
            channel=channel,
            chat_id=chat_id,
            final_content=final_content,
            usage_totals=usage_totals,
        ))
        return final_content, all_tools_used, last_messages, usage_totals

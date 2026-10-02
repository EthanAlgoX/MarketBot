"""Minimal serial plan runtime."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

from marketbot.agent.plan_models import ExecutionPlan


def _merge_step_history(history: list[dict], messages: list[dict], base_count: int) -> list[dict]:
    """Carry full step transcripts without repeating their existing history."""
    transcript = [deepcopy(message) for message in messages if message.get("role") != "system"]
    if not transcript:
        return deepcopy(history)
    if transcript[:len(history)] == history:
        return transcript
    plan_history = history[base_count:]
    if transcript[:len(plan_history)] == plan_history:
        # The prompt builder can suppress old session history on live requests.
        # Keep its original prefix for one-time turn persistence, without
        # duplicating the plan-local evidence in subsequent prompts.
        return [*deepcopy(history[:base_count]), *transcript]
    return [*deepcopy(history), *transcript]


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
        plan_history = deepcopy(loop.processor.get_recent_history(session))
        base_history_count = len(plan_history)
        last_step_result = None
        last_decision = None

        session.metadata["active_plan_id"] = plan.id
        session.metadata["current_step_id"] = plan.current_step_id
        try:
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

                # Keep evidence within this plan until the turn is persisted once.
                # Copies prevent provider or custom executor mutations from leaking
                # into the session or into another step's inputs.
                for attempt in range(2):
                    step_result = await loop.executor.execute_step(
                        session=session,
                        step=step,
                        channel=channel,
                        chat_id=chat_id,
                        history=deepcopy(plan_history),
                        plan_goal=plan.goal,
                        on_progress=on_progress,
                    )
                    decision = loop.verifier.evaluate(step=step, step_result=step_result)
                    usage_totals = loop._merge_usage(usage_totals, step_result.usage)
                    all_tools_used.extend(step_result.tool_calls)
                    if step_result.messages:
                        plan_history = _merge_step_history(
                            plan_history, step_result.messages, base_history_count
                        )
                        system = step_result.messages[0]
                        last_messages = deepcopy([
                            *([system] if system.get("role") == "system" else []), *plan_history
                        ])
                    final_content = step_result.summary or final_content
                    last_step_result, last_decision = step_result, decision
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
                    if decision.outcome != "retry" or attempt == 1:
                        break

                if decision.outcome == "advance":
                    step.status = "completed"
                    continue
                step.status = "failed"
                break
        except BaseException:
            for step in plan.steps:
                if step.status == "running":
                    step.status = "failed"
            raise
        finally:
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
                last_step_result=last_step_result,
                last_decision=last_decision,
            ))
        return final_content, all_tools_used, last_messages, usage_totals

"""Minimal verifier for step-scoped execution."""

from __future__ import annotations

from marketbot.agent.plan_models import StepResult, VerifyDecision


class StepVerifier:
    """Determine whether to advance, retry, or replan."""

    def evaluate(self, *, step, step_result: StepResult) -> VerifyDecision:
        """Return the next action for one executed step."""
        if step_result.needs_replan:
            return VerifyDecision(outcome="replan", reason="executor_requested_replan")
        if step_result.status == "completed":
            return VerifyDecision(outcome="advance", reason="step_completed")
        if step_result.status == "partial":
            return VerifyDecision(outcome="retry", reason="partial_result")
        return VerifyDecision(outcome="replan", reason="step_failed")

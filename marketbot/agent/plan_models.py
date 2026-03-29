"""Data models for minimal planning runtime."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal


PlanMode = Literal["serial", "parallel"]
StepStatus = Literal["pending", "running", "completed", "failed"]
ResultStatus = Literal["completed", "partial", "failed"]
VerifyOutcome = Literal["advance", "retry", "replan", "finish"]


@dataclass(slots=True)
class PlanStep:
    """One executable step inside a structured plan."""

    id: str
    title: str
    instruction: str
    allowed_tools: list[str] = field(default_factory=list)
    success_criteria: str = ""
    status: StepStatus = "pending"


@dataclass(slots=True)
class ExecutionPlan:
    """Minimal structured execution plan."""

    id: str
    goal: str
    mode: PlanMode = "serial"
    steps: list[PlanStep] = field(default_factory=list)
    current_step_id: str | None = None

    def to_dict(self) -> dict:
        """Return a JSON-serializable payload for persistence."""
        return asdict(self)


@dataclass(slots=True)
class StepResult:
    """Normalized result returned by step-scoped execution."""

    step_id: str
    status: ResultStatus
    summary: str
    raw_output: str = ""
    tool_calls: list[str] = field(default_factory=list)
    needs_replan: bool = False
    messages: list[dict] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Return a JSON-serializable payload for persistence."""
        payload = asdict(self)
        # Raw message transcripts are too noisy for routine plan snapshots.
        payload.pop("messages", None)
        return payload


@dataclass(slots=True)
class VerifyDecision:
    """Verifier outcome for the current step."""

    outcome: VerifyOutcome
    reason: str

    def to_dict(self) -> dict:
        """Return a JSON-serializable payload for persistence."""
        return asdict(self)

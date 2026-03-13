"""Contracts for market rollout environments."""

from __future__ import annotations

from typing import Any, Protocol


class MarketEnv(Protocol):
    """Protocol for an RL-compatible market environment."""

    async def allocate(self, task_key: str, request_id: str | None = None) -> dict[str, Any]: ...

    async def reset(
        self,
        lease_id: str,
        task_meta: dict[str, Any],
        run_ctx: dict[str, Any],
        task_timeouts: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    async def exec_tool(self, lease_id: str, tool_name: str, arguments: dict[str, Any]) -> str: ...

    async def evaluate(self, lease_id: str) -> float: ...

    async def close(self, lease_id: str) -> None: ...

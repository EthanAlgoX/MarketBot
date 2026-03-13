"""Small wrapper around the local market environment."""

from __future__ import annotations

from typing import Any

from marketbot.rl.env.market_env import LocalMarketEnv


class LocalMarketEnvWorker:
    """A thin composition wrapper matching future worker responsibilities."""

    def __init__(self, task_catalog: dict[str, dict[str, Any]] | None = None) -> None:
        self.env = LocalMarketEnv(task_catalog=task_catalog)

    async def allocate(self, task_key: str, request_id: str | None = None) -> dict[str, Any]:
        return await self.env.allocate(task_key=task_key, request_id=request_id)

    async def reset(
        self,
        lease_id: str,
        task_meta: dict[str, Any],
        run_ctx: dict[str, Any],
        task_timeouts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self.env.reset(
            lease_id=lease_id,
            task_meta=task_meta,
            run_ctx=run_ctx,
            task_timeouts=task_timeouts,
        )

    async def exec_tool(self, lease_id: str, tool_name: str, arguments: dict[str, Any]) -> str:
        return await self.env.exec_tool(lease_id=lease_id, tool_name=tool_name, arguments=arguments)

    async def evaluate(self, lease_id: str) -> float:
        return await self.env.evaluate(lease_id=lease_id)

    async def close(self, lease_id: str) -> None:
        await self.env.close(lease_id=lease_id)

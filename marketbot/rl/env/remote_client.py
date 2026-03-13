"""HTTP client for MarketBot RL environment servers."""

from __future__ import annotations

from typing import Any

import httpx


class RemoteMarketEnvClient:
    """Minimal async client matching the OpenClaw terminal env protocol."""

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self.base_url = str(base_url).rstrip("/")
        self.timeout = float(timeout)

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}{path}", json=payload)
            response.raise_for_status()
        return dict(response.json())

    async def allocate(self, task_key: str, request_id: str | None = None) -> dict[str, Any]:
        return await self._post("/allocate", {"task_key": task_key, "request_id": request_id})

    async def heartbeat(self, lease_id: str) -> dict[str, Any]:
        return await self._post("/heartbeat", {"lease_id": lease_id})

    async def reset(
        self,
        lease_id: str,
        task_meta: dict[str, Any],
        run_ctx: dict[str, Any],
        task_timeouts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._post(
            "/reset",
            {
                "lease_id": lease_id,
                "task_meta": task_meta,
                "run_ctx": run_ctx,
                "task_timeouts": task_timeouts,
            },
        )

    async def exec_tool(self, lease_id: str, tool_name: str, arguments: dict[str, Any]) -> str:
        response = await self._post(
            "/exec_tool",
            {
                "lease_id": lease_id,
                "tool_call": {"name": tool_name, "arguments": arguments},
            },
        )
        return str(response.get("observation", ""))

    async def evaluate(self, lease_id: str) -> float:
        response = await self._post("/evaluate", {"lease_id": lease_id})
        return float(response.get("score", 0.0))

    async def evaluate_details(self, lease_id: str) -> dict[str, Any]:
        response = await self._post("/evaluate_details", {"lease_id": lease_id})
        return dict(response.get("evaluation", {}))

    async def close(self, lease_id: str) -> dict[str, Any]:
        return await self._post("/close", {"lease_id": lease_id})

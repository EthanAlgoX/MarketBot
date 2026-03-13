"""Local offline market environment for RL-compatible backtests."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from marketbot.rl.reward import RewardBreakdown


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass(slots=True)
class _LeaseState:
    lease_id: str
    task_key: str
    request_id: str | None
    symbol: str
    prices: list[float]
    timestamps: list[str]
    instruction: str
    objective: str
    max_position_pct: float
    drawdown_coef: float
    turnover_coef: float
    slippage_bps: float
    step: int = 0
    position_pct: float = 0.0
    entry_price: float | None = None
    equity: float = 1.0
    peak_equity: float = 1.0
    max_drawdown: float = 0.0
    turnover: float = 0.0
    action_history: list[dict[str, Any]] = field(default_factory=list)
    done: bool = False

    @property
    def current_price(self) -> float:
        return float(self.prices[self.step])

    @property
    def next_price(self) -> float | None:
        next_idx = self.step + 1
        if next_idx >= len(self.prices):
            return None
        return float(self.prices[next_idx])

    @property
    def current_timestamp(self) -> str:
        return self.timestamps[self.step]


class LocalMarketEnv:
    """In-memory single-asset backtest environment with OpenClaw-like APIs."""

    def __init__(self, task_catalog: dict[str, dict[str, Any]] | None = None) -> None:
        self._task_catalog = dict(task_catalog or {})
        self._leases: dict[str, _LeaseState] = {}

    def register_task(self, task_key: str, task_meta: dict[str, Any]) -> None:
        """Register or replace a task definition."""
        self._task_catalog[str(task_key)] = dict(task_meta or {})

    async def allocate(self, task_key: str, request_id: str | None = None) -> dict[str, Any]:
        if task_key not in self._task_catalog:
            raise KeyError(f"unknown task_key: {task_key}")
        lease_id = uuid.uuid4().hex
        task = self._task_catalog[task_key]
        self._leases[lease_id] = self._build_state(
            lease_id=lease_id,
            task_key=task_key,
            request_id=request_id,
            task_meta=task,
        )
        return {"ok": True, "lease_id": lease_id, "task_key": task_key}

    async def reset(
        self,
        lease_id: str,
        task_meta: dict[str, Any],
        run_ctx: dict[str, Any],
        task_timeouts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        _ = run_ctx
        _ = task_timeouts
        state = self._require_lease(lease_id)
        merged_meta = {**self._task_catalog.get(state.task_key, {}), **(task_meta or {})}
        self._leases[lease_id] = self._build_state(
            lease_id=lease_id,
            task_key=state.task_key,
            request_id=state.request_id,
            task_meta=merged_meta,
        )
        state = self._leases[lease_id]
        return {
            "ok": True,
            "user_msg": state.instruction,
            "task": {
                "taskKey": state.task_key,
                "symbol": state.symbol,
                "objective": state.objective,
            },
            "initial_observation": self._snapshot_payload(state),
            "tool_schemas": self._tool_schemas(),
        }

    async def exec_tool(self, lease_id: str, tool_name: str, arguments: dict[str, Any]) -> str:
        state = self._require_lease(lease_id)
        params = dict(arguments or {})
        if tool_name == "market_snapshot":
            return json.dumps(self._snapshot_payload(state), ensure_ascii=False)
        if tool_name == "portfolio_state":
            return json.dumps(self._portfolio_payload(state), ensure_ascii=False)
        if tool_name == "submit_trade_action":
            return json.dumps(self._submit_trade_action(state, params), ensure_ascii=False)
        if tool_name == "advance_time":
            return json.dumps(self._advance_time(state, int(params.get("steps", 1))), ensure_ascii=False)
        raise KeyError(f"unsupported tool: {tool_name}")

    async def evaluate(self, lease_id: str) -> float:
        _ = self._require_lease(lease_id)
        return float(self.evaluate_details(lease_id)["reward"]["score"])

    async def heartbeat(self, lease_id: str) -> dict[str, Any]:
        state = self._require_lease(lease_id)
        return {"ok": True, "lease_id": state.lease_id, "task_key": state.task_key}

    def evaluate_details(self, lease_id: str) -> dict[str, Any]:
        state = self._require_lease(lease_id)
        slippage_penalty = round(state.turnover * (state.slippage_bps / 10_000.0), 6)
        breakdown = RewardBreakdown(
            realized_return=round(state.equity - 1.0, 6),
            max_drawdown_penalty=round(state.max_drawdown * state.drawdown_coef, 6),
            turnover_penalty=round(state.turnover * state.turnover_coef, 6),
            slippage_penalty=slippage_penalty,
        )
        return {
            "taskKey": state.task_key,
            "symbol": state.symbol,
            "done": state.done,
            "step": state.step,
            "equity": round(state.equity, 6),
            "turnover": round(state.turnover, 6),
            "maxDrawdown": round(state.max_drawdown, 6),
            "finalSnapshot": self._snapshot_payload(state),
            "finalPortfolio": self._portfolio_payload(state),
            "actionHistory": [dict(item) for item in state.action_history],
            "reward": breakdown.to_dict(),
        }

    async def close(self, lease_id: str) -> None:
        self._leases.pop(lease_id, None)

    def status(self) -> dict[str, Any]:
        """Expose lightweight server status for health checks."""
        return {
            "ok": True,
            "leaseCount": len(self._leases),
            "taskCount": len(self._task_catalog),
            "taskKeys": sorted(self._task_catalog.keys()),
        }

    def _build_state(
        self,
        *,
        lease_id: str,
        task_key: str,
        request_id: str | None,
        task_meta: dict[str, Any],
    ) -> _LeaseState:
        symbol = str(task_meta.get("symbol") or task_meta.get("symbols", ["UNKNOWN"])[0]).upper()
        prices_raw = list(task_meta.get("prices") or [])
        if len(prices_raw) < 2:
            raise ValueError(f"task {task_key} must define at least two prices")
        prices = [float(item) for item in prices_raw]
        timestamps = [str(item) for item in (task_meta.get("timestamps") or [])]
        if len(timestamps) != len(prices):
            timestamps = [f"t{i}" for i in range(len(prices))]
        instruction = str(
            task_meta.get("instruction")
            or f"Trade {symbol} to maximize risk-adjusted return over the provided episode."
        )
        return _LeaseState(
            lease_id=lease_id,
            task_key=task_key,
            request_id=request_id,
            symbol=symbol,
            prices=prices,
            timestamps=timestamps,
            instruction=instruction,
            objective=str(task_meta.get("objective") or "maximize risk-adjusted return"),
            max_position_pct=float(task_meta.get("max_position_pct", 1.0)),
            drawdown_coef=float(task_meta.get("drawdown_coef", 0.5)),
            turnover_coef=float(task_meta.get("turnover_coef", 0.02)),
            slippage_bps=float(task_meta.get("slippage_bps", 5.0)),
        )

    def _require_lease(self, lease_id: str) -> _LeaseState:
        state = self._leases.get(str(lease_id))
        if state is None:
            raise KeyError(f"unknown lease_id: {lease_id}")
        return state

    def _submit_trade_action(self, state: _LeaseState, params: dict[str, Any]) -> dict[str, Any]:
        if state.done:
            raise RuntimeError("episode already completed")
        action = str(params.get("action") or "watch").strip().lower()
        requested_pct = float(params.get("position_pct", state.position_pct) or 0.0)
        requested_pct = _clamp(requested_pct, 0.0, state.max_position_pct)
        previous_pct = state.position_pct

        if action == "buy":
            target_pct = requested_pct if requested_pct > 0 else state.max_position_pct
        elif action == "reduce":
            target_pct = min(previous_pct, requested_pct)
        elif action in {"sell", "flat"}:
            target_pct = 0.0
        elif action == "watch":
            target_pct = previous_pct
        else:
            raise ValueError(f"unsupported action: {action}")

        turnover_delta = abs(target_pct - previous_pct)
        state.turnover = round(state.turnover + turnover_delta, 6)
        state.position_pct = round(target_pct, 6)
        if state.position_pct > 0 and previous_pct == 0.0:
            state.entry_price = state.current_price
        elif state.position_pct == 0.0:
            state.entry_price = None

        record = {
            "step": state.step,
            "timestamp": state.current_timestamp,
            "price": state.current_price,
            "action": action,
            "previousPositionPct": previous_pct,
            "positionPct": state.position_pct,
            "turnoverDelta": round(turnover_delta, 6),
        }
        state.action_history.append(record)
        return {
            "ok": True,
            "applied": record,
            "portfolio": self._portfolio_payload(state),
        }

    def _advance_time(self, state: _LeaseState, steps: int) -> dict[str, Any]:
        move_steps = max(1, int(steps))
        advanced = 0
        while advanced < move_steps and not state.done:
            next_price = state.next_price
            if next_price is None:
                state.done = True
                break
            gross_return = state.position_pct * ((next_price / state.current_price) - 1.0)
            state.equity = round(state.equity * (1.0 + gross_return), 6)
            state.peak_equity = max(state.peak_equity, state.equity)
            drawdown = 0.0
            if state.peak_equity > 0:
                drawdown = (state.peak_equity - state.equity) / state.peak_equity
            state.max_drawdown = max(state.max_drawdown, drawdown)
            state.step += 1
            advanced += 1
            if state.step >= len(state.prices) - 1:
                state.done = True
        return {
            "ok": True,
            "advancedSteps": advanced,
            "done": state.done,
            "snapshot": self._snapshot_payload(state),
            "portfolio": self._portfolio_payload(state),
        }

    def _snapshot_payload(self, state: _LeaseState) -> dict[str, Any]:
        previous_price = float(state.prices[state.step - 1]) if state.step > 0 else None
        change_pct = 0.0
        if previous_price and previous_price > 0:
            change_pct = ((state.current_price / previous_price) - 1.0) * 100.0
        return {
            "symbol": state.symbol,
            "step": state.step,
            "timestamp": state.current_timestamp,
            "price": round(state.current_price, 6),
            "nextPrice": round(state.next_price, 6) if state.next_price is not None else None,
            "changePct": round(change_pct, 6),
            "done": state.done,
        }

    def _portfolio_payload(self, state: _LeaseState) -> dict[str, Any]:
        unrealized_return = 0.0
        if state.entry_price and state.entry_price > 0 and state.position_pct > 0:
            unrealized_return = state.position_pct * ((state.current_price / state.entry_price) - 1.0)
        return {
            "symbol": state.symbol,
            "step": state.step,
            "timestamp": state.current_timestamp,
            "positionPct": state.position_pct,
            "entryPrice": state.entry_price,
            "equity": round(state.equity, 6),
            "unrealizedReturn": round(unrealized_return, 6),
            "turnover": round(state.turnover, 6),
            "maxDrawdown": round(state.max_drawdown, 6),
            "done": state.done,
        }

    @staticmethod
    def _tool_schemas() -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "market_snapshot",
                    "description": "Read the current offline market snapshot for the episode.",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "portfolio_state",
                    "description": "Inspect current portfolio state for the episode.",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "submit_trade_action",
                    "description": "Submit a structured trade action for the current step.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["buy", "reduce", "watch", "sell", "flat"],
                            },
                            "position_pct": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        },
                        "required": ["action"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "advance_time",
                    "description": "Advance the episode by one or more bars.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "steps": {"type": "integer", "minimum": 1, "maximum": 20},
                        },
                    },
                },
            },
        ]

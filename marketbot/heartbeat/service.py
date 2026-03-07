"""Heartbeat service - periodic agent wake-up to check for tasks."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Coroutine
from zoneinfo import ZoneInfo

from loguru import logger
from marketbot.market_reporting import extract_market_heartbeat_spec

if TYPE_CHECKING:
    from marketbot.providers.base import LLMProvider

_HEARTBEAT_TOOL = [
    {
        "type": "function",
        "function": {
            "name": "heartbeat",
            "description": "Report heartbeat decision after reviewing tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["skip", "run"],
                        "description": "skip = nothing to do, run = has active tasks",
                    },
                    "tasks": {
                        "type": "string",
                        "description": "Natural-language summary of active tasks (required for run)",
                    },
                },
                "required": ["action"],
            },
        },
    }
]

_TZ_RE = re.compile(r"<!--\s*marketbot:timezone\s+([A-Za-z0-9_\-/+]+)\s*-->")
_WEEKDAYS_RE = re.compile(r"<!--\s*marketbot:weekdays\s+([a-z,\s]+)\s*-->", re.I)
_WINDOWS_RE = re.compile(r"<!--\s*marketbot:windows\s+([0-9:,\-\s]+)\s*-->")
_WEEKDAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


class HeartbeatService:
    """
    Periodic heartbeat service that wakes the agent to check for tasks.

    Phase 1 (decision): reads HEARTBEAT.md and asks the LLM — via a virtual
    tool call — whether there are active tasks.  This avoids free-text parsing
    and the unreliable HEARTBEAT_OK token.

    Phase 2 (execution): only triggered when Phase 1 returns ``run``.  The
    ``on_execute`` callback runs the task through the full agent loop and
    returns the result to deliver.
    """

    def __init__(
        self,
        workspace: Path,
        provider: LLMProvider,
        model: str,
        on_execute: Callable[[str], Coroutine[Any, Any, str]] | None = None,
        on_notify: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        interval_s: int = 30 * 60,
        enabled: bool = True,
    ):
        self.workspace = workspace
        self.provider = provider
        self.model = model
        self.on_execute = on_execute
        self.on_notify = on_notify
        self.interval_s = interval_s
        self.enabled = enabled
        self._running = False
        self._task: asyncio.Task | None = None

    @property
    def heartbeat_file(self) -> Path:
        return self.workspace / "HEARTBEAT.md"

    def _read_heartbeat_file(self) -> str | None:
        if self.heartbeat_file.exists():
            try:
                return self.heartbeat_file.read_text(encoding="utf-8")
            except Exception:
                return None
        return None

    @staticmethod
    def _parse_window_token(token: str) -> tuple[time, time] | None:
        parts = [part.strip() for part in token.split("-", 1)]
        if len(parts) != 2:
            return None
        try:
            start = time.fromisoformat(parts[0])
            end = time.fromisoformat(parts[1])
        except ValueError:
            return None
        return start, end

    @classmethod
    def _extract_constraints(cls, content: str) -> dict[str, Any]:
        tz_match = _TZ_RE.search(content)
        weekday_match = _WEEKDAYS_RE.search(content)
        windows_match = _WINDOWS_RE.search(content)

        timezone = tz_match.group(1).strip() if tz_match else None
        weekdays: set[int] = set()
        if weekday_match:
            for token in weekday_match.group(1).split(","):
                key = token.strip().lower()[:3]
                if key in _WEEKDAY_MAP:
                    weekdays.add(_WEEKDAY_MAP[key])

        windows: list[tuple[time, time]] = []
        if windows_match:
            for token in windows_match.group(1).split(","):
                parsed = cls._parse_window_token(token.strip())
                if parsed:
                    windows.append(parsed)

        return {
            "timezone": timezone,
            "weekdays": weekdays,
            "windows": windows,
        }

    @classmethod
    def _within_constraints(cls, content: str, now: datetime | None = None) -> tuple[bool, str | None]:
        constraints = cls._extract_constraints(content)
        timezone_name = constraints["timezone"]
        weekdays = constraints["weekdays"]
        windows = constraints["windows"]

        if not timezone_name and not weekdays and not windows:
            return True, None

        current = now or datetime.now().astimezone()
        if timezone_name:
            try:
                current = current.astimezone(ZoneInfo(timezone_name))
            except Exception:
                return False, f"invalid timezone '{timezone_name}'"

        if weekdays and current.weekday() not in weekdays:
            return False, "outside configured weekdays"

        if windows:
            current_time = current.timetz().replace(tzinfo=None)
            for start, end in windows:
                if start <= end:
                    if start <= current_time <= end:
                        return True, None
                else:
                    if current_time >= start or current_time <= end:
                        return True, None
            return False, "outside configured windows"

        return True, None

    async def _decide(self, content: str) -> tuple[str, str]:
        """Phase 1: ask LLM to decide skip/run via virtual tool call.

        Returns (action, tasks) where action is 'skip' or 'run'.
        """
        now = datetime.now().astimezone()
        response = await self.provider.chat(
            messages=[
                {"role": "system", "content": "You are a heartbeat agent. Call the heartbeat tool to report your decision."},
                {"role": "user", "content": (
                    "Review the following HEARTBEAT.md and decide whether there are active tasks.\n\n"
                    f"Current local time: {now.isoformat()}\n"
                    f"Timezone: {now.tzname() or 'local'}\n\n"
                    f"{content}"
                )},
            ],
            tools=_HEARTBEAT_TOOL,
            model=self.model,
        )

        if not response.has_tool_calls:
            return "skip", ""

        args = response.tool_calls[0].arguments
        return args.get("action", "skip"), args.get("tasks", "")

    async def start(self) -> None:
        """Start the heartbeat service."""
        if not self.enabled:
            logger.info("Heartbeat disabled")
            return
        if self._running:
            logger.warning("Heartbeat already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Heartbeat started (every {}s)", self.interval_s)

    def stop(self) -> None:
        """Stop the heartbeat service."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _run_loop(self) -> None:
        """Main heartbeat loop."""
        while self._running:
            try:
                await asyncio.sleep(self.interval_s)
                if self._running:
                    await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Heartbeat error: {}", e)

    async def _tick(self) -> None:
        """Execute a single heartbeat tick."""
        content = self._read_heartbeat_file()
        if not content:
            logger.debug("Heartbeat: HEARTBEAT.md missing or empty")
            return

        allowed, reason = self._within_constraints(content)
        if not allowed:
            logger.info("Heartbeat: skipped ({})", reason or "constraint not met")
            return

        logger.info("Heartbeat: checking for tasks...")

        try:
            market_spec = extract_market_heartbeat_spec(content)
            if market_spec:
                action = "run"
                tasks = str(market_spec["task"])
                logger.info("Heartbeat: market report scheduled ({})", market_spec["session"])
            else:
                action, tasks = await self._decide(content)

            if action != "run":
                logger.info("Heartbeat: OK (nothing to report)")
                return

            logger.info("Heartbeat: tasks found, executing...")
            if self.on_execute:
                response = await self.on_execute(tasks)
                if response and self.on_notify:
                    logger.info("Heartbeat: completed, delivering response")
                    await self.on_notify(response)
        except Exception:
            logger.exception("Heartbeat execution failed")

    async def trigger_now(self) -> str | None:
        """Manually trigger a heartbeat."""
        content = self._read_heartbeat_file()
        if not content:
            return None
        allowed, _reason = self._within_constraints(content)
        if not allowed:
            return None
        market_spec = extract_market_heartbeat_spec(content)
        if market_spec:
            action, tasks = "run", str(market_spec["task"])
        else:
            action, tasks = await self._decide(content)
        if action != "run" or not self.on_execute:
            return None
        return await self.on_execute(tasks)

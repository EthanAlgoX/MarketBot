"""Task scheduler for cron and heartbeat services."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, Callable, Awaitable
from dataclasses import dataclass

from loguru import logger

if TYPE_CHECKING:
    from marketbot.cron.service import CronService


@dataclass
class ScheduledTask:
    """Represents a scheduled task."""
    name: str
    schedule: str  # cron expression
    callback: Callable[[], Awaitable[str | None]]
    enabled: bool = True


class TaskScheduler:
    """
    Unified task scheduler for cron jobs and heartbeat.
    
    Responsibilities:
    - Manage scheduled tasks
    - Trigger execution
    - Handle task lifecycle
    """

    def __init__(self, cron_service: "CronService | None" = None):
        self.cron_service = cron_service
        self._tasks: dict[str, ScheduledTask] = {}
        self._running_tasks: dict[str, asyncio.Task] = {}

    def register_task(self, task: ScheduledTask) -> None:
        """Register a scheduled task."""
        self._tasks[task.name] = task
        logger.info("Registered task: {} with schedule {}", task.name, task.schedule)

    def unregister_task(self, name: str) -> None:
        """Unregister a task."""
        self._tasks.pop(name, None)
        if name in self._running_tasks:
            self._running_tasks[name].cancel()
            self._running_tasks.pop(name, None)

    def get_task(self, name: str) -> ScheduledTask | None:
        """Get a task by name."""
        return self._tasks.get(name)

    def list_tasks(self) -> list[str]:
        """List all registered task names."""
        return list(self._tasks.keys())

    async def execute_task(self, name: str) -> str | None:
        """Execute a task by name."""
        task = self._tasks.get(name)
        if not task:
            logger.warning("Task not found: {}", name)
            return None
        
        if not task.enabled:
            logger.info("Task {} is disabled", name)
            return None

        logger.info("Executing task: {}", name)
        try:
            result = await task.callback()
            logger.info("Task {} completed", name)
            return result
        except Exception:
            logger.exception("Task {} failed", name)
            return None

    async def run_task_async(self, name: str) -> None:
        """Run a task asynchronously."""
        if name in self._running_tasks:
            logger.warning("Task {} is already running", name)
            return

        task = asyncio.create_task(self.execute_task(name))
        self._running_tasks[name] = task
        try:
            await task
        finally:
            self._running_tasks.pop(name, None)

    def cancel_task(self, name: str) -> bool:
        """Cancel a running task."""
        if name in self._running_tasks:
            self._running_tasks[name].cancel()
            return True
        return False

    def cancel_all(self) -> None:
        """Cancel all running tasks."""
        for task in self._running_tasks.values():
            task.cancel()
        self._running_tasks.clear()

    @property
    def is_running(self) -> bool:
        """Check if any tasks are running."""
        return len(self._running_tasks) > 0


def create_scheduler_from_cron(cron_service: "CronService") -> TaskScheduler:
    """Create a TaskScheduler from an existing CronService."""
    scheduler = TaskScheduler(cron_service=cron_service)
    
    # Add cron jobs as scheduled tasks
    if cron_service:
        for job in cron_service.jobs:
            scheduler.register_task(ScheduledTask(
                name=f"cron:{job.name}",
                schedule=job.schedule,
                callback=lambda j=job: _execute_cron_job(j),
            ))
    
    return scheduler


async def _execute_cron_job(job) -> str | None:
    """Execute a cron job."""
    # This is a placeholder - actual implementation would use the agent loop
    logger.debug("Would execute cron job: {}", job.name)
    return None

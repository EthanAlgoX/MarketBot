"""Subagent manager for background task execution."""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from loguru import logger

from marketbot.agent.executor import classify_execution_outcome
from marketbot.agent.planner import TaskPlanner
from marketbot.agent.router import RequestRouter
from marketbot.agent.tool_health import ToolHealthSnapshot
from marketbot.agent.verifier import StepVerifier
from marketbot.agent.tools.browser import BrowserNetworkTool, BrowserPageTool, BrowserSiteTool
from marketbot.agent.tools.filesystem import EditFileTool, ListDirTool, ReadFileTool, WriteFileTool
from marketbot.agent.tools.lark import LarkBaseTool, LarkCliTool, LarkDocTool, LarkIMTool, LarkSheetsTool, LarkTaskTool
from marketbot.agent.tools.registry import ToolRegistry
from marketbot.agent.tools.shell import ExecTool
from marketbot.agent.tools.twitter import TwitterCliTool
from marketbot.agent.tools.web import WebFetchTool, WebSearchTool
from marketbot.agent.tools.xiaohongshu import XiaohongshuCliTool
from marketbot.bus.events import InboundMessage
from marketbot.bus.queue import MessageBus
from marketbot.config.schema import ExecToolConfig
from marketbot.providers.base import LLMProvider


class SubagentManager:
    """Manages background subagent execution."""

    def __init__(
        self,
        provider: LLMProvider,
        workspace: Path,
        bus: MessageBus,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        reasoning_effort: str | None = None,
        brave_api_key: str | None = None,
        web_proxy: str | None = None,
        browser_config: Any | None = None,
        xiaohongshu_cli_config: Any | None = None,
        twitter_cli_config: Any | None = None,
        lark_cli_config: Any | None = None,
        exec_config: "ExecToolConfig | None" = None,
        restrict_to_workspace: bool = False,
    ):
        from marketbot.config.schema import ExecToolConfig
        self.provider = provider
        self.workspace = workspace
        self.bus = bus
        self.model = model or provider.get_default_model()
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.reasoning_effort = reasoning_effort
        self.brave_api_key = brave_api_key
        self.web_proxy = web_proxy
        self.browser_config = browser_config
        self.xiaohongshu_cli_config = xiaohongshu_cli_config
        self.twitter_cli_config = twitter_cli_config
        self.lark_cli_config = lark_cli_config
        self.exec_config = exec_config or ExecToolConfig()
        self.restrict_to_workspace = restrict_to_workspace
        self._running_tasks: dict[str, asyncio.Task[None]] = {}
        self._session_tasks: dict[str, set[str]] = {}  # session_key -> {task_id, ...}
        self.router = RequestRouter()
        self.planner = TaskPlanner()
        self.verifier = StepVerifier()

    async def spawn(
        self,
        task: str,
        label: str | None = None,
        origin_channel: str = "cli",
        origin_chat_id: str = "direct",
        session_key: str | None = None,
    ) -> str:
        """Spawn a subagent to execute a task in the background."""
        task_id = str(uuid.uuid4())[:8]
        display_label = label or task[:30] + ("..." if len(task) > 30 else "")
        origin = {"channel": origin_channel, "chat_id": origin_chat_id}

        bg_task = asyncio.create_task(
            self._run_subagent(task_id, task, display_label, origin)
        )
        self._running_tasks[task_id] = bg_task
        if session_key:
            self._session_tasks.setdefault(session_key, set()).add(task_id)

        def _cleanup(_: asyncio.Task) -> None:
            self._running_tasks.pop(task_id, None)
            if session_key and (ids := self._session_tasks.get(session_key)):
                ids.discard(task_id)
                if not ids:
                    del self._session_tasks[session_key]

        bg_task.add_done_callback(_cleanup)

        logger.info("Spawned subagent [{}]: {}", task_id, display_label)
        return f"Subagent [{display_label}] started (id: {task_id}). I'll notify you when it completes."

    async def _run_subagent(
        self,
        task_id: str,
        task: str,
        label: str,
        origin: dict[str, str],
    ) -> None:
        """Execute the subagent task and announce the result."""
        logger.info("Subagent [{}] starting task: {}", task_id, label)

        try:
            tools, healthy_names = self._build_tool_registry()
            system_prompt = self._build_subagent_prompt()
            route = self.router.decide(text=task, channel="cli", metadata=None)
            if route.mode == "planned_task":
                final_result = await self._run_planned_subagent_task(
                    task=task,
                    tools=tools,
                    healthy_names=healthy_names,
                    system_prompt=system_prompt,
                )
            else:
                messages: list[dict[str, Any]] = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": task},
                ]
                final_result, _, _ = await self._run_local_react_loop(
                    messages=messages,
                    tools=tools,
                    exposed_names=healthy_names,
                )

            logger.info("Subagent [{}] completed successfully", task_id)
            await self._announce_result(task_id, label, task, final_result, origin, "ok")

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            logger.error("Subagent [{}] failed: {}", task_id, e)
            await self._announce_result(task_id, label, task, error_msg, origin, "error")

    def _build_tool_registry(self) -> tuple[ToolRegistry, set[str]]:
        """Build subagent tools and return healthy visible tool names."""
        tools = ToolRegistry()
        allowed_dir = self.workspace if self.restrict_to_workspace else None
        tools.register(ReadFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
        tools.register(WriteFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
        tools.register(EditFileTool(workspace=self.workspace, allowed_dir=allowed_dir))
        tools.register(ListDirTool(workspace=self.workspace, allowed_dir=allowed_dir))
        tools.register(ExecTool(
            working_dir=str(self.workspace),
            timeout=self.exec_config.timeout,
            restrict_to_workspace=self.restrict_to_workspace,
            path_append=self.exec_config.path_append,
        ))
        tools.register(WebSearchTool(api_key=self.brave_api_key, proxy=self.web_proxy))
        tools.register(WebFetchTool(proxy=self.web_proxy))
        if self.browser_config and getattr(self.browser_config, "enabled", False):
            tools.register(BrowserSiteTool(browser_config=self.browser_config, workspace=self.workspace))
            tools.register(BrowserPageTool(browser_config=self.browser_config, workspace=self.workspace))
            tools.register(BrowserNetworkTool(browser_config=self.browser_config, workspace=self.workspace))
        if self.xiaohongshu_cli_config and getattr(self.xiaohongshu_cli_config, "enabled", False):
            tools.register(XiaohongshuCliTool(xhs_config=self.xiaohongshu_cli_config, workspace=self.workspace))
        if self.twitter_cli_config and getattr(self.twitter_cli_config, "enabled", False):
            tools.register(TwitterCliTool(twitter_config=self.twitter_cli_config, workspace=self.workspace))
        if self.lark_cli_config and getattr(self.lark_cli_config, "enabled", False):
            tools.register(LarkCliTool(lark_config=self.lark_cli_config, workspace=self.workspace))
            tools.register(LarkBaseTool(lark_config=self.lark_cli_config, workspace=self.workspace))
            tools.register(LarkIMTool(lark_config=self.lark_cli_config, workspace=self.workspace))
            tools.register(LarkDocTool(lark_config=self.lark_cli_config, workspace=self.workspace))
            tools.register(LarkSheetsTool(lark_config=self.lark_cli_config, workspace=self.workspace))
            tools.register(LarkTaskTool(lark_config=self.lark_cli_config, workspace=self.workspace))
        health = ToolHealthSnapshot()
        health.refresh(tools._tools)
        return tools, health.healthy_names()

    async def _run_local_react_loop(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: ToolRegistry,
        exposed_names: set[str],
        max_iterations: int = 15,
    ) -> tuple[str, list[str], list[dict[str, Any]]]:
        """Run a local ReAct loop for the subagent using filtered tools."""
        iteration = 0
        final_result: str | None = None
        tools_used: list[str] = []
        while iteration < max_iterations:
            iteration += 1
            response = await self.provider.chat(
                messages=messages,
                tools=tools.get_definitions(exposed_names=exposed_names),
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                reasoning_effort=self.reasoning_effort,
            )
            if response.has_tool_calls:
                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                        },
                    }
                    for tc in response.tool_calls
                ]
                messages.append({
                    "role": "assistant",
                    "content": response.content or "",
                    "tool_calls": tool_call_dicts,
                })
                for tool_call in response.tool_calls:
                    args_str = json.dumps(tool_call.arguments, ensure_ascii=False)
                    logger.debug("Subagent executing: {} with arguments: {}", tool_call.name, args_str)
                    tools_used.append(tool_call.name)
                    result = await tools.execute(tool_call.name, tool_call.arguments)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.name,
                        "content": result,
                    })
            else:
                final_result = response.content
                break
        return final_result or "Task completed but no final response was generated.", tools_used, messages

    async def _run_planned_subagent_task(
        self,
        *,
        task: str,
        tools: ToolRegistry,
        healthy_names: set[str],
        system_prompt: str,
    ) -> str:
        """Run a deterministic planned task locally for the subagent."""
        plan = self.planner.create_plan(
            request_text=task,
            visible_tools=healthy_names,
            route_mode="planned_task",
        )
        latest_output = ""
        for step in plan.steps:
            step.status = "running"
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Current step: {step.title}\n\n"
                        f"Instruction: {step.instruction}\n\n"
                        f"Success criteria: {step.success_criteria}\n\n"
                        f"Allowed tools: {', '.join(step.allowed_tools) if step.allowed_tools else '(none)'}"
                    ),
                },
            ]
            latest_output, tools_used, messages = await self._run_local_react_loop(
                messages=messages,
                tools=tools,
                exposed_names=set(step.allowed_tools),
            )
            outcome = classify_execution_outcome(
                final_content=latest_output,
                messages=messages,
                tools_used=tools_used,
            )
            result_status = "completed" if outcome == "success" else ("partial" if outcome == "partial" else "failed")
            decision = self.verifier.evaluate(
                step=step,
                step_result=type(
                    "SubStepResult",
                    (),
                    {
                        "status": result_status,
                        "needs_replan": (outcome == "failure" and not tools_used and bool(step.allowed_tools)),
                    },
                )(),
            )
            if decision.outcome != "advance":
                break
            step.status = "completed"
        return latest_output or "Task completed but no final response was generated."

    async def _announce_result(
        self,
        task_id: str,
        label: str,
        task: str,
        result: str,
        origin: dict[str, str],
        status: str,
    ) -> None:
        """Announce the subagent result to the main agent via the message bus."""
        status_text = "completed successfully" if status == "ok" else "failed"

        announce_content = f"""[Subagent '{label}' {status_text}]

Task: {task}

Result:
{result}

Summarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs."""

        # Inject as system message to trigger main agent
        msg = InboundMessage(
            channel="system",
            sender_id="subagent",
            chat_id=f"{origin['channel']}:{origin['chat_id']}",
            content=announce_content,
        )

        await self.bus.publish_inbound(msg)
        logger.debug("Subagent [{}] announced result to {}:{}", task_id, origin['channel'], origin['chat_id'])
    
    def _build_subagent_prompt(self) -> str:
        """Build a focused system prompt for the subagent."""
        from marketbot.agent.context import ContextBuilder
        from marketbot.agent.skills import SkillsLoader

        time_ctx = ContextBuilder._build_runtime_context(None, None)
        parts = [f"""# Subagent

{time_ctx}

You are a subagent spawned by the main agent to complete a specific task.
Stay focused on the assigned task. Your final response will be reported back to the main agent.

## Workspace
{self.workspace}"""]

        skills_summary = SkillsLoader(self.workspace).build_skills_summary()
        if skills_summary:
            parts.append(f"## Skills\n\nRead SKILL.md with read_file to use a skill.\n\n{skills_summary}")

        return "\n\n".join(parts)
    
    async def cancel_by_session(self, session_key: str) -> int:
        """Cancel all subagents for the given session. Returns count cancelled."""
        tasks = [self._running_tasks[tid] for tid in self._session_tasks.get(session_key, [])
                 if tid in self._running_tasks and not self._running_tasks[tid].done()]
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        return len(tasks)

    def get_running_count(self) -> int:
        """Return the number of currently running subagents."""
        return len(self._running_tasks)

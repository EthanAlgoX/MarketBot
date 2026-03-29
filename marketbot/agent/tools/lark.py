"""Structured wrappers around the local lark-cli binary."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool


_HIGHLIGHT_TAG_RE = re.compile(r"</?h>")


class _LarkCliExecutor:
    """Shared lark-cli process runner and safety guard."""

    _ALLOWED_TOP_LEVEL = {
        "api",
        "auth",
        "base",
        "calendar",
        "contact",
        "doctor",
        "docs",
        "drive",
        "event",
        "im",
        "mail",
        "minutes",
        "schema",
        "sheets",
        "task",
        "vc",
        "wiki",
        "whiteboard",
    }
    _WRITE_HINTS = {
        "add",
        "append",
        "assign",
        "comment",
        "complete",
        "create",
        "delete",
        "draft-create",
        "draft-edit",
        "forward",
        "reminder",
        "reopen",
        "reply",
        "reply-all",
        "send",
        "update",
        "upload",
        "write",
    }
    _READ_API_METHODS = {"GET"}
    _DENY_FLAGS = {"--output", "-o", "--force"}
    _DENY_LONG_RUNNING = {"+subscribe"}

    def __init__(self, lark_config: Any | None = None, workspace: Path | None = None):
        self.workspace = workspace
        self.command = getattr(lark_config, "command", "lark-cli") if lark_config else "lark-cli"
        self.enabled = bool(getattr(lark_config, "enabled", False)) if lark_config else False
        self.timeout = int(getattr(lark_config, "timeout_s", 45) or 45) if lark_config else 45
        self.config_dir = str(getattr(lark_config, "config_dir", "") or "").strip() if lark_config else ""
        self.allow_write = bool(getattr(lark_config, "allow_write", False)) if lark_config else False
        self.allow_auth = bool(getattr(lark_config, "allow_auth", False)) if lark_config else False

    def _ensure_available(self) -> str | None:
        if Path(self.command).expanduser().exists():
            return None
        if shutil.which(self.command):
            return None
        return (
            f"Error: lark-cli command '{self.command}' was not found. "
            "Install lark-cli and/or set tools.larkCli.command in config."
        )

    def _guard_args(self, args: list[str]) -> str | None:
        root = args[0].lower()
        if root not in self._ALLOWED_TOP_LEVEL:
            allowed = ", ".join(sorted(self._ALLOWED_TOP_LEVEL))
            return f"Error: unsupported lark-cli root command '{root}'. Allowed: {allowed}"

        for token in args:
            if token in self._DENY_FLAGS:
                return f"Error: lark-cli flag '{token}' is blocked in marketbot"
            if token in self._DENY_LONG_RUNNING:
                return f"Error: lark-cli command '{token}' is long-running and blocked in marketbot"

        if root == "auth":
            if not self.allow_auth:
                return (
                    "Error: lark-cli auth commands are disabled. "
                    "Set tools.larkCli.allowAuth=true to enable controlled auth flows."
                )
            return None

        if root in {"doctor", "schema"}:
            return None

        if root == "api":
            if len(args) < 3:
                return "Error: lark-cli api requires at least [api, METHOD, PATH]"
            method = args[1].upper()
            if method not in self._READ_API_METHODS and not self.allow_write:
                return (
                    "Error: lark-cli write operations are disabled. "
                    "Set tools.larkCli.allowWrite=true to enable controlled mutations."
                )
            return None

        if root == "event":
            return "Error: lark-cli event subscription is blocked in marketbot tool mode"

        if not self.allow_write and self._looks_like_write(args[1:]):
            return (
                "Error: lark-cli write operations are disabled. "
                "Set tools.larkCli.allowWrite=true to enable controlled mutations."
            )
        return None

    def _looks_like_write(self, args: list[str]) -> bool:
        lowered = [part.lower() for part in args]
        for token in lowered:
            if token.startswith("--"):
                continue
            normalized = token.lstrip("+")
            if normalized in self._WRITE_HINTS:
                return True
            for hint in self._WRITE_HINTS:
                if normalized.endswith(f"-{hint}") or normalized.startswith(f"{hint}-"):
                    return True
        return False

    async def _run_command(self, args: list[str], stdin: str = "") -> tuple[int, str, str]:
        env = os.environ.copy()
        if self.config_dir:
            env["LARKSUITE_CLI_CONFIG_DIR"] = self.config_dir

        process = await asyncio.create_subprocess_exec(
            self.command,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin else None,
            cwd=str(self.workspace) if self.workspace else None,
            env=env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(stdin.encode("utf-8") if stdin else None),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
            process.kill()
            try:
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
            return 124, "", f"lark-cli timed out after {self.timeout} seconds"

        return (
            process.returncode,
            stdout.decode("utf-8", errors="replace"),
            stderr.decode("utf-8", errors="replace"),
        )

    async def _execute_lark(self, args: list[str], stdin: str = "") -> str:
        if not self.enabled:
            return "Error: lark-cli tool is disabled. Enable tools.larkCli.enabled in config."
        if not args:
            return "Error: args is required"
        if error := self._ensure_available():
            return error
        if guard := self._guard_args(args):
            return guard

        exit_code, stdout, stderr = await self._run_command(args, stdin=stdin)
        stripped = stdout.strip()
        if exit_code == 0:
            return stripped or "(no output)"
        if stripped:
            return stripped
        payload = {
            "ok": False,
            "schema_version": "1",
            "error": {
                "code": "tool_execution_failed",
                "message": stderr.strip() or f"lark-cli exited with code {exit_code}",
            },
            "meta": {"command": [self.command, *args], "exit_code": exit_code},
        }
        return json.dumps(payload, ensure_ascii=False)


class LarkCliTool(_LarkCliExecutor, Tool):
    """Expose selected lark-cli commands as a generic structured tool."""

    @property
    def name(self) -> str:
        return "lark_cli"

    @property
    def description(self) -> str:
        return (
            "Run Lark/Feishu queries via local lark-cli. "
            "Read operations are enabled by default; write and auth flows require explicit config."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "args": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Arguments passed to lark-cli, for example ['im', '+chat-search', '--query', 'earnings'].",
                },
                "stdin": {
                    "type": "string",
                    "description": "Optional stdin payload for commands that read structured input.",
                },
            },
            "required": ["args"],
        }

    async def execute(self, args: list[str], stdin: str | None = None, **kwargs: Any) -> str:
        normalized_args = [str(part) for part in (args or []) if str(part).strip()]
        return await self._execute_lark(normalized_args, stdin=stdin or "")


class LarkIMTool(_LarkCliExecutor, Tool):
    """Common IM workflows over lark-cli shortcuts."""

    _ACTIONS = {"chat_search", "messages_list", "messages_search", "send_message"}

    @staticmethod
    def _extract_sender_name(message: dict[str, Any]) -> str:
        sender = message.get("sender")
        if not isinstance(sender, dict):
            return ""
        return str(sender.get("name", "") or "")

    def _summarize_chat_search_output(self, output: str, query: str | None = None) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        chats = data.get("chats")
        if chats is None:
            chats = []
        if not isinstance(chats, list):
            return output

        items: list[dict[str, Any]] = []
        for entry in chats:
            if not isinstance(entry, dict):
                continue
            items.append(
                {
                    "chatId": entry.get("chat_id", ""),
                    "name": entry.get("name", ""),
                    "description": entry.get("description", ""),
                    "chatMode": entry.get("chat_mode", ""),
                    "ownerId": entry.get("owner_id", ""),
                }
            )

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "query": query or "",
                "total": data.get("total", len(items)),
                "returned": len(items),
                "has_more": bool(data.get("has_more")),
                "page_token": data.get("page_token", ""),
                "chats": items,
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    def _summarize_messages_output(self, output: str, query: str | None = None) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        messages = data.get("messages")
        if messages is None:
            messages = []
        if not isinstance(messages, list):
            return output

        items: list[dict[str, Any]] = []
        for entry in messages:
            if not isinstance(entry, dict):
                continue
            items.append(
                {
                    "messageId": entry.get("message_id", ""),
                    "chatId": entry.get("chat_id", ""),
                    "chatName": entry.get("chat_name", ""),
                    "chatType": entry.get("chat_type", ""),
                    "sender": self._extract_sender_name(entry),
                    "type": entry.get("msg_type", ""),
                    "content": entry.get("content", ""),
                    "createdAt": entry.get("create_time", ""),
                }
            )

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "query": query or "",
                "total": data.get("total", len(items)),
                "returned": len(items),
                "has_more": bool(data.get("has_more")),
                "page_token": data.get("page_token", ""),
                "messages": items,
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    @property
    def name(self) -> str:
        return "lark_im"

    @property
    def description(self) -> str:
        return "Search chats, list messages, search messages, or send a message via lark-cli IM shortcuts."

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": sorted(self._ACTIONS)},
                "query": {"type": "string"},
                "chat_id": {"type": "string"},
                "user_id": {"type": "string"},
                "thread": {"type": "string"},
                "text": {"type": "string"},
                "start": {"type": "string"},
                "end": {"type": "string"},
                "sort": {"type": "string", "enum": ["asc", "desc"]},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 200},
                "page_token": {"type": "string"},
                "as_type": {"type": "string", "enum": ["auto", "user", "bot"]},
            },
            "required": ["action"],
        }

    async def execute(
        self,
        action: str,
        query: str | None = None,
        chat_id: str | None = None,
        user_id: str | None = None,
        thread: str | None = None,
        text: str | None = None,
        start: str | None = None,
        end: str | None = None,
        sort: str | None = None,
        page_size: int | None = None,
        page_token: str | None = None,
        as_type: str = "auto",
        **kwargs: Any,
    ) -> str:
        if action == "chat_search":
            if not query:
                return "Error: query is required for lark_im.chat_search"
            args = ["im", "+chat-search", "--query", query]
        elif action == "messages_list":
            if not chat_id and not user_id and not thread:
                return "Error: chat_id, user_id, or thread is required for lark_im.messages_list"
            shortcut = "+threads-messages-list" if thread else "+chat-messages-list"
            args = ["im", shortcut]
            if thread:
                args += ["--thread", thread]
            elif chat_id:
                args += ["--chat-id", chat_id]
            elif user_id:
                args += ["--user-id", user_id]
        elif action == "messages_search":
            if not query:
                return "Error: query is required for lark_im.messages_search"
            args = ["im", "+messages-search", "--query", query]
            if chat_id:
                args += ["--chat-id", chat_id]
        elif action == "send_message":
            if not text:
                return "Error: text is required for lark_im.send_message"
            if not chat_id and not user_id:
                return "Error: chat_id or user_id is required for lark_im.send_message"
            args = ["im", "+messages-send"]
            if chat_id:
                args += ["--chat-id", chat_id]
            else:
                args += ["--user-id", user_id or ""]
            args += ["--text", text]
        else:
            return f"Error: unsupported lark_im action: {action}"

        if start:
            args += ["--start", start]
        if end:
            args += ["--end", end]
        if sort:
            args += ["--sort", sort]
        if page_size:
            args += ["--page-size", str(page_size)]
        if page_token:
            args += ["--page-token", page_token]
        if as_type != "auto":
            args += ["--as", as_type]
        args += ["--format", "json"]
        result = await self._execute_lark(args)
        if action == "chat_search":
            return self._summarize_chat_search_output(result, query=query)
        if action in {"messages_list", "messages_search"}:
            return self._summarize_messages_output(result, query=query)
        return result


class LarkDocTool(_LarkCliExecutor, Tool):
    """Common doc workflows over lark-cli shortcuts."""

    _ACTIONS = {"search", "fetch", "create", "update"}

    @property
    def name(self) -> str:
        return "lark_doc"

    @property
    def description(self) -> str:
        return "Search docs, fetch content, create docs, or update docs via lark-cli document shortcuts."

    @staticmethod
    def _clean_highlighted(text: str | None) -> str:
        if not text:
            return ""
        return _HIGHLIGHT_TAG_RE.sub("", text)

    def _summarize_search_output(self, output: str) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        results = data.get("results")
        if not isinstance(results, list):
            return output

        items: list[dict[str, Any]] = []
        for entry in results:
            if not isinstance(entry, dict):
                continue
            meta = entry.get("result_meta")
            if not isinstance(meta, dict):
                meta = {}
            items.append(
                {
                    "type": entry.get("entity_type", ""),
                    "title": self._clean_highlighted(str(entry.get("title_highlighted", "") or "")),
                    "summary": self._clean_highlighted(str(entry.get("summary_highlighted", "") or "")),
                    "url": meta.get("url", ""),
                    "token": meta.get("token", ""),
                    "docType": meta.get("doc_types", ""),
                    "updatedAt": meta.get("update_time_iso", ""),
                }
            )

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "query": data.get("query", ""),
                "total": data.get("total"),
                "returned": len(items),
                "has_more": bool(data.get("has_more")),
                "results": items,
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": sorted(self._ACTIONS)},
                "query": {"type": "string"},
                "doc_token": {"type": "string"},
                "url": {"type": "string"},
                "title": {"type": "string"},
                "markdown": {"type": "string"},
                "folder_token": {"type": "string"},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 20},
                "page_token": {"type": "string"},
                "as_type": {"type": "string", "enum": ["auto", "user", "bot"]},
            },
            "required": ["action"],
        }

    async def execute(
        self,
        action: str,
        query: str | None = None,
        doc_token: str | None = None,
        url: str | None = None,
        title: str | None = None,
        markdown: str | None = None,
        folder_token: str | None = None,
        page_size: int | None = None,
        page_token: str | None = None,
        as_type: str = "auto",
        **kwargs: Any,
    ) -> str:
        if action == "search":
            if not query:
                return "Error: query is required for lark_doc.search"
            args = ["docs", "+search", "--query", query]
        elif action == "fetch":
            if not doc_token and not url:
                return "Error: doc_token or url is required for lark_doc.fetch"
            args = ["docs", "+fetch"]
            args += ["--doc-token", doc_token] if doc_token else ["--url", url or ""]
        elif action == "create":
            if not title:
                return "Error: title is required for lark_doc.create"
            args = ["docs", "+create", "--title", title]
            if markdown:
                args += ["--markdown", markdown]
            if folder_token:
                args += ["--folder-token", folder_token]
        elif action == "update":
            if not markdown:
                return "Error: markdown is required for lark_doc.update"
            if not doc_token and not url:
                return "Error: doc_token or url is required for lark_doc.update"
            args = ["docs", "+update"]
            args += ["--doc-token", doc_token] if doc_token else ["--url", url or ""]
            args += ["--markdown", markdown]
        else:
            return f"Error: unsupported lark_doc action: {action}"

        if action == "search":
            if page_size:
                args += ["--page-size", str(page_size)]
            if page_token:
                args += ["--page-token", page_token]
            if as_type != "auto":
                args += ["--as", as_type]
        args += ["--format", "json"]
        result = await self._execute_lark(args)
        if action == "search":
            return self._summarize_search_output(result)
        return result


class LarkSheetsTool(_LarkCliExecutor, Tool):
    """Common sheets workflows over lark-cli shortcuts."""

    _ACTIONS = {"read", "append", "write", "create"}

    def _summarize_read_output(self, output: str, read_range: str | None = None) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        value_range = data.get("valueRange")
        if isinstance(value_range, dict):
            source = value_range
        else:
            source = data

        values = source.get("values")
        if values is None:
            values = []
        if not isinstance(values, list):
            return output

        rows: list[list[str]] = []
        for row in values:
            if isinstance(row, list):
                rows.append([str(cell) if cell is not None else "" for cell in row])

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "range": source.get("range", read_range or ""),
                "rowCount": len(rows),
                "columnCount": max((len(row) for row in rows), default=0),
                "rows": rows,
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    @property
    def name(self) -> str:
        return "lark_sheets"

    @property
    def description(self) -> str:
        return "Read, append, write, or create Lark sheets via lark-cli sheet shortcuts."

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": sorted(self._ACTIONS)},
                "spreadsheet_token": {"type": "string"},
                "url": {"type": "string"},
                "title": {"type": "string"},
                "range": {"type": "string"},
                "sheet_id": {"type": "string"},
                "values_json": {"type": "string"},
                "folder_token": {"type": "string"},
            },
            "required": ["action"],
        }

    async def execute(
        self,
        action: str,
        spreadsheet_token: str | None = None,
        url: str | None = None,
        title: str | None = None,
        range: str | None = None,
        sheet_id: str | None = None,
        values_json: str | None = None,
        folder_token: str | None = None,
        **kwargs: Any,
    ) -> str:
        if action == "create":
            if not title:
                return "Error: title is required for lark_sheets.create"
            args = ["sheets", "+create", "--title", title]
            if folder_token:
                args += ["--folder-token", folder_token]
        else:
            if not spreadsheet_token and not url:
                return "Error: spreadsheet_token or url is required"
            if not range:
                return "Error: range is required"
            shortcut = {"read": "+read", "append": "+append", "write": "+write"}.get(action)
            if not shortcut:
                return f"Error: unsupported lark_sheets action: {action}"
            args = ["sheets", shortcut]
            args += ["--spreadsheet-token", spreadsheet_token] if spreadsheet_token else ["--url", url or ""]
            if sheet_id:
                args += ["--sheet-id", sheet_id]
            args += ["--range", range]
            if action in {"append", "write"}:
                if not values_json:
                    return f"Error: values_json is required for lark_sheets.{action}"
                args += ["--values", values_json]

        result = await self._execute_lark(args)
        if action == "read":
            return self._summarize_read_output(result, read_range=range)
        return result


class LarkTaskTool(_LarkCliExecutor, Tool):
    """Common task workflows over lark-cli shortcuts."""

    _ACTIONS = {"list", "create", "update", "comment"}

    def _summarize_list_output(self, output: str, query: str | None = None) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        items_raw = data.get("items")
        if items_raw is None:
            items_raw = []
        if not isinstance(items_raw, list):
            return output

        items: list[dict[str, Any]] = []
        for entry in items_raw:
            if not isinstance(entry, dict):
                continue
            items.append(
                {
                    "taskId": entry.get("guid", ""),
                    "summary": entry.get("summary", ""),
                    "url": entry.get("url", ""),
                    "createdAt": entry.get("created_at", ""),
                    "dueAt": entry.get("due_at", ""),
                }
            )

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "query": query or "",
                "returned": len(items),
                "has_more": bool(data.get("has_more")),
                "page_token": data.get("page_token", ""),
                "items": items,
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    @property
    def name(self) -> str:
        return "lark_task"

    @property
    def description(self) -> str:
        return "List tasks, create tasks, update tasks, or comment on tasks via lark-cli task shortcuts."

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": sorted(self._ACTIONS)},
                "query": {"type": "string"},
                "task_id": {"type": "string"},
                "summary": {"type": "string"},
                "description": {"type": "string"},
                "due": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["action"],
        }

    async def execute(
        self,
        action: str,
        query: str | None = None,
        task_id: str | None = None,
        summary: str | None = None,
        description: str | None = None,
        due: str | None = None,
        content: str | None = None,
        **kwargs: Any,
    ) -> str:
        if action == "list":
            args = ["task", "+get-my-tasks"]
            if query:
                args += ["--query", query]
        elif action == "create":
            if not summary:
                return "Error: summary is required for lark_task.create"
            args = ["task", "+create", "--summary", summary]
            if description:
                args += ["--description", description]
            if due:
                args += ["--due", due]
        elif action == "update":
            if not task_id:
                return "Error: task_id is required for lark_task.update"
            if not summary and not description and not due:
                return "Error: at least one of summary, description, or due is required for lark_task.update"
            args = ["task", "+update", "--task-id", task_id]
            if summary:
                args += ["--summary", summary]
            if description:
                args += ["--description", description]
            if due:
                args += ["--due", due]
        elif action == "comment":
            if not task_id:
                return "Error: task_id is required for lark_task.comment"
            if not content:
                return "Error: content is required for lark_task.comment"
            args = ["task", "+comment", "--task-id", task_id, "--content", content]
        else:
            return f"Error: unsupported lark_task action: {action}"

        args += ["--format", "json"]
        result = await self._execute_lark(args)
        if action == "list":
            return self._summarize_list_output(result, query=query)
        return result


class LarkBaseTool(_LarkCliExecutor, Tool):
    """Common Bitable/Base read workflows over lark-cli shortcuts."""

    _ACTIONS = {"table_list", "field_list", "record_list", "record_get"}

    @staticmethod
    def _table_resolution_error(
        *,
        code: str,
        message: str,
        base_token: str,
        table_name: str | None = None,
        candidates: list[str] | None = None,
    ) -> str:
        payload = {
            "ok": False,
            "identity": "lark_base",
            "error": {
                "code": code,
                "message": message,
            },
            "data": {
                "baseToken": base_token,
                "tableName": table_name or "",
                "candidates": candidates or [],
            },
        }
        return json.dumps(payload, ensure_ascii=False)

    async def _resolve_table(self, *, base_token: str, table_id: str | None, table_name: str | None) -> tuple[str | None, str | None, str | None]:
        normalized_table_id = str(table_id or "").strip() or None
        normalized_table_name = str(table_name or "").strip() or None
        if normalized_table_id:
            return normalized_table_id, normalized_table_name, None
        if not normalized_table_name:
            return None, None, self._table_resolution_error(
                code="missing_table_selector",
                message="table_id or table_name is required",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        result = await self._execute_lark(["base", "+table-list", "--base-token", base_token])
        try:
            payload = json.loads(result)
        except json.JSONDecodeError:
            return None, None, self._table_resolution_error(
                code="table_resolution_non_json",
                message="failed to resolve table_name because table_list returned non-JSON output",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        if not isinstance(payload, dict) or not payload.get("ok"):
            return None, None, self._table_resolution_error(
                code="table_resolution_failed",
                message="failed to resolve table_name via base table_list",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        data = payload.get("data")
        if not isinstance(data, dict):
            return None, None, self._table_resolution_error(
                code="table_resolution_failed",
                message="failed to resolve table_name via base table_list",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        items = data.get("items")
        if not isinstance(items, list):
            return None, None, self._table_resolution_error(
                code="table_resolution_failed",
                message="failed to resolve table_name via base table_list",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        lowered_query = normalized_table_name.casefold()
        candidate_names: list[str] = []
        exact_match: dict[str, Any] | None = None
        partial_matches: list[dict[str, Any]] = []
        for entry in items:
            if not isinstance(entry, dict):
                continue
            candidate_name = str(entry.get("table_name", "") or entry.get("name", "") or "").strip()
            candidate_id = str(entry.get("table_id", "") or "").strip()
            if not candidate_name or not candidate_id:
                continue
            candidate_names.append(candidate_name)
            lowered_candidate = candidate_name.casefold()
            if lowered_candidate == lowered_query:
                exact_match = entry
                break
            if lowered_query in lowered_candidate:
                partial_matches.append(entry)

        matched = exact_match
        if matched is None and len(partial_matches) == 1:
            matched = partial_matches[0]

        if matched is None and len(partial_matches) > 1:
            suggestions = sorted(
                dict.fromkeys(
                    str(entry.get("table_name", "") or entry.get("name", "") or "").strip()
                    for entry in partial_matches
                    if isinstance(entry, dict)
                )
            )
            return None, None, self._table_resolution_error(
                code="ambiguous_table_name",
                message=f"table_name '{normalized_table_name}' matched multiple tables in base {base_token}",
                base_token=base_token,
                table_name=normalized_table_name,
                candidates=suggestions[:5],
            )

        if not isinstance(matched, dict):
            suggestions = sorted(dict.fromkeys(candidate_names))[:5]
            if suggestions:
                return None, None, self._table_resolution_error(
                    code="table_name_not_found",
                    message=f"table_name '{normalized_table_name}' was not found in base {base_token}",
                    base_token=base_token,
                    table_name=normalized_table_name,
                    candidates=suggestions,
                )
            return None, None, self._table_resolution_error(
                code="table_name_not_found",
                message=f"table_name '{normalized_table_name}' was not found in base {base_token}",
                base_token=base_token,
                table_name=normalized_table_name,
            )

        resolved_table_id = str(matched.get("table_id", "") or "").strip() or None
        resolved_table_name = str(matched.get("table_name", "") or matched.get("name", "") or "").strip() or normalized_table_name
        if not resolved_table_id:
            return None, None, self._table_resolution_error(
                code="table_resolution_missing_id",
                message=f"table_name '{normalized_table_name}' resolved without a table_id",
                base_token=base_token,
                table_name=normalized_table_name,
            )
        return resolved_table_id, resolved_table_name, None

    def _summarize_items_output(
        self,
        output: str,
        *,
        key: str,
        item_mapper: Any,
        extra: dict[str, Any] | None = None,
    ) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        raw_items = data.get(key)
        if raw_items is None:
            raw_items = []
        if not isinstance(raw_items, list):
            return output

        items = [mapped for entry in raw_items if isinstance(entry, dict) and (mapped := item_mapper(entry))]
        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "returned": len(items),
                "has_more": bool(data.get("has_more")),
                "page_token": data.get("page_token", ""),
                key: items,
            },
        }
        if extra:
            summary["data"].update(extra)
        return json.dumps(summary, ensure_ascii=False)

    @staticmethod
    def _map_table(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "tableId": entry.get("table_id", ""),
            "tableName": entry.get("table_name", "") or entry.get("name", ""),
            "name": entry.get("table_name", "") or entry.get("name", ""),
            "revision": entry.get("revision", 0),
        }

    @staticmethod
    def _map_field(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "fieldId": entry.get("field_id", ""),
            "fieldName": entry.get("field_name", ""),
            "type": entry.get("type", 0),
            "isPrimary": bool(entry.get("is_primary")),
        }

    @staticmethod
    def _map_record(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "recordId": entry.get("record_id", ""),
            "fields": entry.get("fields", {}),
        }

    def _summarize_record_list_output(
        self,
        output: str,
        *,
        base_token: str,
        table_id: str | None = None,
        table_name: str | None = None,
        selected_fields: list[str] | None = None,
        field_filters: dict[str, Any] | None = None,
    ) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        # lark-cli base +record-list returns tabular data with a separate field list.
        if isinstance(data.get("data"), list) and isinstance(data.get("fields"), list):
            field_names = [str(name) for name in data.get("fields", [])]
            record_ids = data.get("record_id_list")
            if not isinstance(record_ids, list):
                record_ids = []

            items: list[dict[str, Any]] = []
            for index, row in enumerate(data.get("data", [])):
                if not isinstance(row, list):
                    continue
                fields = {
                    field_names[i]: row[i]
                    for i in range(min(len(field_names), len(row)))
                }
                if selected_fields:
                    fields = {name: fields[name] for name in selected_fields if name in fields}
                record_id = str(record_ids[index]) if index < len(record_ids) else ""
                mapped = {"recordId": record_id, "fields": fields}
                if self._record_matches_filters(mapped, field_filters):
                    items.append(mapped)

            summary = {
                "ok": True,
                "identity": payload.get("identity"),
                "data": {
                    "baseToken": base_token,
                    "tableId": table_id or "",
                    "tableName": table_name or "",
                    "returned": len(items),
                    "items": items,
                    "fieldNames": selected_fields or field_names,
                },
            }
            return json.dumps(summary, ensure_ascii=False)

        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output
        if not isinstance(payload, dict) or not payload.get("ok"):
            return output
        data = payload.get("data")
        if not isinstance(data, dict):
            return output
        raw_items = data.get("items")
        if raw_items is None:
            raw_items = []
        if not isinstance(raw_items, list):
            return output
        items = []
        for entry in raw_items:
            if not isinstance(entry, dict):
                continue
            mapped = self._map_record(entry)
            if selected_fields:
                fields = mapped.get("fields")
                if isinstance(fields, dict):
                    mapped["fields"] = {name: fields[name] for name in selected_fields if name in fields}
            if self._record_matches_filters(mapped, field_filters):
                items.append(mapped)
        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "baseToken": base_token,
                "tableId": table_id or "",
                "tableName": table_name or "",
                "returned": len(items),
                "items": items,
                "fieldNames": selected_fields or [],
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    def _summarize_record_get_output(self, output: str, *, table_id: str | None = None) -> str:
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            return output

        if not isinstance(payload, dict) or not payload.get("ok"):
            return output

        data = payload.get("data")
        if not isinstance(data, dict):
            return output

        record = data.get("record")
        if not isinstance(record, dict):
            return output

        summary = {
            "ok": True,
            "identity": payload.get("identity"),
            "data": {
                "tableId": table_id or "",
                "record": self._map_record(record),
            },
        }
        return json.dumps(summary, ensure_ascii=False)

    @staticmethod
    def _record_matches_filters(record: dict[str, Any], field_filters: dict[str, Any] | None) -> bool:
        if not field_filters:
            return True
        fields = record.get("fields")
        if not isinstance(fields, dict):
            return False
        if "conditions" in field_filters and isinstance(field_filters.get("conditions"), list):
            conjunction = str(field_filters.get("conjunction", "and")).lower()
            conditions = field_filters.get("conditions") or []
            matches = [
                LarkBaseTool._match_filter_condition(fields, condition)
                for condition in conditions
                if isinstance(condition, dict)
            ]
            if not matches:
                return True
            if conjunction == "or":
                return any(matches)
            return all(matches)
        for field_name, expected in field_filters.items():
            if not LarkBaseTool._match_simple_filter(fields, str(field_name), expected):
                return False
        return True

    @staticmethod
    def _field_value_to_text(value: Any) -> str:
        if isinstance(value, list):
            return " ".join(str(item) for item in value)
        return str(value)

    @staticmethod
    def _match_simple_filter(fields: dict[str, Any], field_name: str, expected: Any) -> bool:
        if field_name not in fields:
            return False
        actual_text = LarkBaseTool._field_value_to_text(fields.get(field_name))
        expected_text = str(expected)
        return expected_text in actual_text

    @staticmethod
    def _match_filter_condition(fields: dict[str, Any], condition: dict[str, Any]) -> bool:
        field_name = str(condition.get("field_name", "") or "")
        operator = str(condition.get("operator", "contains") or "contains").lower()
        value = condition.get("value")
        if not field_name or field_name not in fields:
            return False

        actual = fields.get(field_name)
        actual_text = LarkBaseTool._field_value_to_text(actual)

        if operator == "is":
            if isinstance(value, list):
                return any(str(item) == actual_text or str(item) in actual_text for item in value)
            return str(value) == actual_text or str(value) in actual_text
        if operator == "in":
            if not isinstance(value, list):
                return str(value) in actual_text
            return any(str(item) in actual_text for item in value)
        if operator == "contains":
            if isinstance(value, list):
                return all(str(item) in actual_text for item in value)
            return str(value) in actual_text
        return False

    @property
    def name(self) -> str:
        return "lark_base"

    @property
    def description(self) -> str:
        return "Read Feishu Base/Bitable tables, fields, and records via lark-cli base shortcuts."

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": sorted(self._ACTIONS)},
                "base_token": {"type": "string"},
                "table_id": {"type": "string"},
                "table_name": {"type": "string"},
                "record_id": {"type": "string"},
                "fields": {"type": "array", "items": {"type": "string"}},
                "field_filters": {"type": "object"},
                "view_id": {"type": "string"},
                "offset": {"type": "integer", "minimum": 0},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "required": ["action", "base_token"],
        }

    async def execute(
        self,
        action: str,
        base_token: str,
        table_id: str | None = None,
        table_name: str | None = None,
        record_id: str | None = None,
        fields: list[str] | None = None,
        field_filters: dict[str, Any] | None = None,
        view_id: str | None = None,
        offset: int | None = None,
        limit: int | None = None,
        **kwargs: Any,
    ) -> str:
        if action == "table_list":
            args = ["base", "+table-list", "--base-token", base_token]
            if offset is not None:
                args += ["--offset", str(offset)]
            if limit is not None:
                args += ["--limit", str(limit)]
            result = await self._execute_lark(args)
            return self._summarize_items_output(
                result,
                key="items",
                item_mapper=self._map_table,
                extra={"baseToken": base_token},
            )

        resolved_table_id, resolved_table_name, resolve_error = await self._resolve_table(
            base_token=base_token,
            table_id=table_id,
            table_name=table_name,
        )
        if resolve_error:
            return resolve_error

        table_flag = ["--table-id", resolved_table_id or ""]

        if action == "field_list":
            args = ["base", "+field-list", "--base-token", base_token, *table_flag]
            if offset is not None:
                args += ["--offset", str(offset)]
            if limit is not None:
                args += ["--limit", str(limit)]
            result = await self._execute_lark(args)
            return self._summarize_items_output(
                result,
                key="items",
                item_mapper=self._map_field,
                extra={"baseToken": base_token, "tableId": resolved_table_id or "", "tableName": resolved_table_name or ""},
            )

        if action == "record_list":
            args = ["base", "+record-list", "--base-token", base_token, *table_flag]
            if view_id:
                args += ["--view-id", view_id]
            if offset is not None:
                args += ["--offset", str(offset)]
            if limit is not None:
                args += ["--limit", str(limit)]
            result = await self._execute_lark(args)
            return self._summarize_record_list_output(
                result,
                base_token=base_token,
                table_id=resolved_table_id,
                table_name=resolved_table_name,
                selected_fields=[str(name) for name in (fields or []) if str(name).strip()] or None,
                field_filters=field_filters or None,
            )

        if action == "record_get":
            if not record_id:
                return "Error: record_id is required"
            args = ["base", "+record-get", "--base-token", base_token, *table_flag, "--record-id", record_id]
            result = await self._execute_lark(args)
            return self._summarize_record_get_output(result, table_id=resolved_table_id or resolved_table_name)

        return f"Error: unsupported lark_base action: {action}"

"""Structured wrapper around the local xiaohongshu-cli binary."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool


class XiaohongshuCliTool(Tool):
    """Expose selected xiaohongshu-cli commands as a structured tool."""

    _READ_OPERATIONS = {
        "comments",
        "feed",
        "hot",
        "read",
        "search",
        "search_user",
        "status",
        "topics",
        "user",
        "user_posts",
    }
    _WRITE_OPERATIONS = {"post"}
    _HOT_CATEGORIES = {"fashion", "food", "cosmetics", "movie", "career", "love", "home", "gaming", "travel", "fitness"}
    _COMPACT_OPERATIONS = {"comments", "feed", "hot", "read", "search", "user", "user_posts"}

    def __init__(self, xhs_config: Any | None = None, workspace: Path | None = None):
        self.workspace = workspace
        self.command = getattr(xhs_config, "command", "xhs") if xhs_config else "xhs"
        self.enabled = bool(getattr(xhs_config, "enabled", False)) if xhs_config else False
        self.timeout = int(getattr(xhs_config, "timeout_s", 45) or 45) if xhs_config else 45
        self.cookie_source = str(getattr(xhs_config, "cookie_source", "auto") or "auto") if xhs_config else "auto"
        self.home_dir = str(getattr(xhs_config, "home_dir", "") or "").strip() if xhs_config else ""
        self.allow_write = bool(getattr(xhs_config, "allow_write", False)) if xhs_config else False

    @property
    def name(self) -> str:
        return "xiaohongshu_cli"

    @property
    def description(self) -> str:
        return (
            "Run Xiaohongshu queries via local xiaohongshu-cli. "
            "Read operations are enabled by default; write operations require allowWrite=true."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": sorted(self._READ_OPERATIONS | self._WRITE_OPERATIONS),
                    "description": "xiaohongshu-cli operation to execute. Write operations require allowWrite=true.",
                },
                "keyword": {"type": "string"},
                "target": {"type": "string", "description": "Note id, URL, or short index depending on operation."},
                "user_id": {"type": "string"},
                "title": {"type": "string", "description": "Title for creator post operation."},
                "body": {"type": "string", "description": "Body text for creator post operation."},
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Image file paths for creator post operation.",
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional hashtags/topics to attach when publishing.",
                },
                "is_private": {"type": "boolean", "description": "Publish as private note when true."},
                "sort": {"type": "string", "enum": ["general", "popular", "latest"]},
                "note_type": {"type": "string", "enum": ["all", "video", "image"]},
                "page": {"type": "integer", "minimum": 1},
                "cursor": {"type": "string"},
                "xsec_token": {"type": "string"},
                "fetch_all": {"type": "boolean"},
                "category": {"type": "string"},
            },
            "required": ["operation"],
        }

    async def execute(
        self,
        operation: str,
        keyword: str | None = None,
        target: str | None = None,
        user_id: str | None = None,
        title: str | None = None,
        body: str | None = None,
        images: list[str] | None = None,
        topics: list[str] | None = None,
        is_private: bool = False,
        sort: str = "general",
        note_type: str = "all",
        page: int = 1,
        cursor: str = "",
        xsec_token: str = "",
        fetch_all: bool = False,
        category: str = "food",
        **kwargs: Any,
    ) -> str:
        op = str(operation or "").strip().lower()
        if op not in self._READ_OPERATIONS and op not in self._WRITE_OPERATIONS:
            return f"Error: unsupported xiaohongshu operation: {op}"
        if not self.enabled:
            return "Error: xiaohongshu-cli tool is disabled. Enable tools.xiaohongshuCli.enabled in config."
        if op in self._WRITE_OPERATIONS and not self.allow_write:
            return (
                "Error: xiaohongshu write operations are disabled. "
                "Set tools.xiaohongshuCli.allowWrite=true to enable controlled posting."
            )
        if error := self._ensure_available():
            return error

        args_or_error = self._build_args(
            op,
            keyword=keyword,
            target=target,
            user_id=user_id,
            title=title,
            body=body,
            images=images or [],
            topics=topics or [],
            is_private=is_private,
            sort=sort,
            note_type=note_type,
            page=page,
            cursor=cursor,
            xsec_token=xsec_token,
            fetch_all=fetch_all,
            category=category,
        )
        if isinstance(args_or_error, str):
            return args_or_error

        exit_code, stdout, stderr = await self._run_command(args_or_error)
        stripped = stdout.strip()
        if stripped and (exit_code == 0 or stripped.startswith("{")):
            return self._format_output(op, stripped)

        payload = {
            "ok": False,
            "schema_version": "1",
            "error": {
                "code": "tool_execution_failed",
                "message": stderr.strip() or stripped or f"xiaohongshu-cli exited with code {exit_code}",
            },
            "meta": {"command": [self.command, *args_or_error], "exit_code": exit_code},
        }
        return json.dumps(payload, ensure_ascii=False)

    def _format_output(self, operation: str, raw_output: str) -> str:
        stripped = raw_output.strip()
        if operation not in self._COMPACT_OPERATIONS:
            return stripped
        try:
            payload = json.loads(stripped)
        except Exception:
            return stripped
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            return stripped
        compact = self._compact_payload(operation, payload)
        return json.dumps(compact, ensure_ascii=False)

    def _compact_payload(self, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
        compact: dict[str, Any] = {
            "ok": payload.get("ok", True),
            "schema_version": payload.get("schema_version", "1"),
            "operation": operation,
        }
        if operation == "search":
            compact["data"] = self._compact_search_data(payload.get("data"))
            return compact
        if operation == "read":
            compact["data"] = self._compact_note_payload(payload.get("data"))
            return compact
        if operation == "user":
            compact["data"] = self._compact_user_payload(payload.get("data"))
            return compact
        if operation in {"feed", "hot", "user_posts"}:
            compact["data"] = self._compact_item_list_payload(payload.get("data"))
            return compact
        if operation == "comments":
            compact["data"] = self._compact_comments_payload(payload.get("data"))
            return compact
        return payload

    def _compact_search_data(self, data: Any) -> dict[str, Any]:
        items = data.get("items") if isinstance(data, dict) else []
        notes = [item for item in items if isinstance(item, dict) and item.get("model_type") == "note"]
        hot_queries = [item for item in items if isinstance(item, dict) and item.get("model_type") == "hot_query"]
        note_samples = [self._extract_note_summary(item) for item in notes[:4]]
        note_samples = [item for item in note_samples if item]
        hot_query_terms = self._extract_hot_queries(hot_queries[:3])
        top_titles = [sample["title"] for sample in note_samples if sample.get("title")][:8]
        return {
            "has_more": bool(data.get("has_more")) if isinstance(data, dict) else False,
            "counts": {
                "total_items": len(items) if isinstance(items, list) else 0,
                "note_items": len(notes),
                "hot_query_items": len(hot_queries),
            },
            "engagement": self._summarize_note_engagement(note_samples),
            "signals": {
                "hot_queries": hot_query_terms[:4],
                "top_titles": top_titles[:4],
            },
            "notes": note_samples,
        }

    def _compact_item_list_payload(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"items": []}
        items = data.get("items")
        if not isinstance(items, list):
            return {"items": []}
        notes = [self._extract_note_summary(item) for item in items[:10]]
        notes = [item for item in notes if item]
        return {
            "has_more": bool(data.get("has_more")),
            "count": len(items),
            "engagement": self._summarize_note_engagement(notes),
            "items": notes,
        }

    def _compact_note_payload(self, data: Any) -> dict[str, Any]:
        note = self._extract_note_summary(data if isinstance(data, dict) else {})
        if note:
            return note
        return {"raw_keys": sorted((data or {}).keys())[:12] if isinstance(data, dict) else []}

    def _compact_user_payload(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"raw_keys": []}
        user = data.get("user") if isinstance(data.get("user"), dict) else data
        return {
            "user_id": self._first_text(user, "user_id", "userid"),
            "nickname": self._first_text(user, "nickname", "nick_name", "name"),
            "desc": self._first_text(user, "desc", "description"),
            "followers": self._first_number(user, "fans", "fans_count", "follower_count", "followers"),
            "following": self._first_number(user, "follows", "following_count", "follow_count"),
            "likes": self._first_number(user, "interaction", "liked_count", "total_liked_count"),
        }

    def _compact_comments_payload(self, data: Any) -> dict[str, Any]:
        comments = []
        if isinstance(data, dict):
            raw = data.get("comments") or data.get("items") or data.get("data")
            if isinstance(raw, list):
                comments = raw
        samples = []
        for item in comments[:10]:
            if not isinstance(item, dict):
                continue
            content = self._first_text(item, "content", "comment", "text")
            author = None
            user = item.get("user")
            if isinstance(user, dict):
                author = self._first_text(user, "nickname", "nick_name", "name")
            if content:
                samples.append({"author": author, "content": content[:160]})
        return {
            "count": len(comments),
            "comments": samples,
        }

    def _extract_note_summary(self, item: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(item, dict):
            return {}
        note = item.get("note_card") if isinstance(item.get("note_card"), dict) else item
        user = note.get("user") if isinstance(note.get("user"), dict) else {}
        interact = note.get("interact_info") if isinstance(note.get("interact_info"), dict) else {}
        publish_time = None
        tags = note.get("corner_tag_info")
        if isinstance(tags, list):
            for tag in tags:
                if isinstance(tag, dict) and str(tag.get("type") or "") == "publish_time":
                    publish_time = self._first_text(tag, "text")
                    break
        title = self._first_text(note, "display_title", "title", "desc")
        if not title and not interact:
            return {}
        return {
            "id": self._first_text(item, "id"),
            "title": title,
            "author": self._first_text(user, "nickname", "nick_name", "name"),
            "publish_time": publish_time,
            "engagement": {
                "likes": self._first_number(interact, "liked_count"),
                "comments": self._first_number(interact, "comment_count"),
            },
        }

    def _extract_hot_queries(self, items: list[dict[str, Any]]) -> list[str]:
        result: list[str] = []
        for item in items:
            hot_query = item.get("hot_query")
            if not isinstance(hot_query, dict):
                continue
            queries = hot_query.get("queries")
            if not isinstance(queries, list):
                continue
            for query in queries:
                if not isinstance(query, dict):
                    continue
                term = self._first_text(query, "search_word", "name", "id")
                if term and term not in result:
                    result.append(term)
        return result

    def _summarize_note_engagement(self, notes: list[dict[str, Any]]) -> dict[str, Any]:
        likes = [int((note.get("engagement") or {}).get("likes") or 0) for note in notes]
        comments = [int((note.get("engagement") or {}).get("comments") or 0) for note in notes]
        if not notes:
            return {"sample_size": 0}
        return {
            "sample_size": len(notes),
            "max_likes": max(likes) if likes else 0,
            "avg_likes": round(sum(likes) / len(likes), 1) if likes else 0,
            "max_comments": max(comments) if comments else 0,
            "avg_comments": round(sum(comments) / len(comments), 1) if comments else 0,
        }

    @staticmethod
    def _first_text(data: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = data.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    @staticmethod
    def _first_number(data: dict[str, Any], *keys: str) -> int | None:
        for key in keys:
            value = data.get(key)
            parsed = XiaohongshuCliTool._parse_count(value)
            if parsed is not None:
                return parsed
        return None

    @staticmethod
    def _parse_count(value: Any) -> int | None:
        if value is None or value is False:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        text = str(value).strip().replace(",", "")
        if not text:
            return None
        digits = "".join(ch for ch in text if ch.isdigit())
        if not digits:
            return None
        try:
            return int(digits)
        except ValueError:
            return None

    def _ensure_available(self) -> str | None:
        if shutil.which(self.command):
            return None
        command_path = Path(self.command).expanduser()
        if command_path.exists():
            return None
        return f"Error: xiaohongshu-cli command not found: {self.command}"

    def _build_args(
        self,
        operation: str,
        *,
        keyword: str | None,
        target: str | None,
        user_id: str | None,
        title: str | None,
        body: str | None,
        images: list[str],
        topics: list[str],
        is_private: bool,
        sort: str,
        note_type: str,
        page: int,
        cursor: str,
        xsec_token: str,
        fetch_all: bool,
        category: str,
    ) -> list[str] | str:
        args = ["--cookie-source", self.cookie_source]
        if operation == "post":
            if not title:
                return "Error: title is required for xiaohongshu post"
            if not body:
                return "Error: body is required for xiaohongshu post"
            if not images:
                return "Error: at least one image is required for xiaohongshu post"
            built = [*args, "post", "--title", title, "--body", body]
            for image_path in images:
                if str(image_path).strip():
                    built.extend(["--images", str(image_path).strip()])
            for topic in topics:
                if str(topic).strip():
                    built.extend(["--topic", str(topic).strip()])
            if is_private:
                built.append("--private")
            built.append("--json")
            return built
        if operation == "status":
            return [*args, "status", "--json"]
        if operation == "feed":
            return [*args, "feed", "--json"]
        if operation == "search":
            if not keyword:
                return "Error: keyword is required for xiaohongshu search"
            return [*args, "search", keyword, "--sort", sort, "--type", note_type, "--page", str(page), "--json"]
        if operation == "read":
            if not target:
                return "Error: target is required for xiaohongshu read"
            built = [*args, "read", target]
            if xsec_token:
                built.extend(["--xsec-token", xsec_token])
            built.append("--json")
            return built
        if operation == "comments":
            if not target:
                return "Error: target is required for xiaohongshu comments"
            built = [*args, "comments", target]
            if cursor:
                built.extend(["--cursor", cursor])
            if xsec_token:
                built.extend(["--xsec-token", xsec_token])
            if fetch_all:
                built.append("--all")
            built.append("--json")
            return built
        if operation == "hot":
            normalized = str(category or "food").strip().lower()
            if normalized not in self._HOT_CATEGORIES:
                return f"Error: unsupported xiaohongshu hot category: {category}"
            return [*args, "hot", "-c", normalized, "--json"]
        if operation == "topics":
            if not keyword:
                return "Error: keyword is required for xiaohongshu topics"
            return [*args, "topics", keyword, "--json"]
        if operation == "search_user":
            if not keyword:
                return "Error: keyword is required for xiaohongshu search_user"
            return [*args, "search-user", keyword, "--json"]
        if operation == "user":
            if not user_id:
                return "Error: user_id is required for xiaohongshu user"
            return [*args, "user", user_id, "--json"]
        if operation == "user_posts":
            if not user_id:
                return "Error: user_id is required for xiaohongshu user_posts"
            built = [*args, "user-posts", user_id]
            if cursor:
                built.extend(["--cursor", cursor])
            built.append("--json")
            return built
        return f"Error: unsupported xiaohongshu operation: {operation}"

    async def _run_command(self, args: list[str]) -> tuple[int, str, str]:
        env = os.environ.copy()
        env["OUTPUT"] = "json"
        if self.home_dir:
            env["HOME"] = self.home_dir
        process = await asyncio.create_subprocess_exec(
            self.command,
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(self.workspace) if self.workspace else None,
            env=env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=self.timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return 124, "", f"xiaohongshu-cli timed out after {self.timeout}s"
        return (
            process.returncode,
            stdout.decode("utf-8", errors="replace"),
            stderr.decode("utf-8", errors="replace"),
        )

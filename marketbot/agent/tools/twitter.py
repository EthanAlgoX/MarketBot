"""Structured wrapper around the local twitter-cli binary."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

from marketbot.agent.tools.base import Tool


class TwitterCliTool(Tool):
    """Expose selected twitter-cli commands as a structured tool."""

    _READ_OPERATIONS = {
        "article",
        "bookmarks",
        "feed",
        "followers",
        "following",
        "likes",
        "list",
        "search",
        "status",
        "tweet",
        "user",
        "user_posts",
        "whoami",
    }
    _WRITE_OPERATIONS = {
        "bookmark",
        "delete",
        "follow",
        "like",
        "post",
        "quote",
        "reply",
        "retweet",
        "unbookmark",
        "unfollow",
        "unlike",
        "unretweet",
    }
    _SEARCH_TYPES = {"Top", "Latest", "Photos", "Videos"}
    _HAS_CHOICES = {"links", "images", "videos", "media"}
    _EXCLUDE_CHOICES = {"retweets", "replies", "links"}
    _FEED_TYPES = {"for-you", "following"}
    _TEXT_PREVIEW_MAX_CHARS = 320

    def __init__(self, twitter_config: Any | None = None, workspace: Path | None = None):
        self.workspace = workspace
        self.command = getattr(twitter_config, "command", "twitter") if twitter_config else "twitter"
        self.enabled = bool(getattr(twitter_config, "enabled", False)) if twitter_config else False
        self.timeout = int(getattr(twitter_config, "timeout_s", 45) or 45) if twitter_config else 45
        self.browser = str(getattr(twitter_config, "browser", "") or "").strip()
        self.chrome_profile = str(getattr(twitter_config, "chrome_profile", "") or "").strip()
        self.proxy = str(getattr(twitter_config, "proxy", "") or "").strip()
        self.home_dir = str(getattr(twitter_config, "home_dir", "") or "").strip()
        self.allow_write = bool(getattr(twitter_config, "allow_write", False)) if twitter_config else False

    @property
    def name(self) -> str:
        return "twitter_cli"

    @property
    def description(self) -> str:
        return (
            "Run Twitter/X queries via local twitter-cli. "
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
                    "description": "twitter-cli operation to execute. Write operations require allowWrite=true.",
                },
                "query": {"type": "string"},
                "target": {"type": "string", "description": "Tweet id/url, list id, or generic operation target."},
                "screen_name": {"type": "string", "description": "Twitter/X handle, with or without @."},
                "text": {"type": "string", "description": "Tweet text for post/reply/quote operations."},
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Image file paths for post/reply/quote operations.",
                },
                "feed_type": {"type": "string", "enum": sorted(self._FEED_TYPES)},
                "search_type": {"type": "string", "enum": sorted(self._SEARCH_TYPES)},
                "from_user": {"type": "string"},
                "to_user": {"type": "string"},
                "lang": {"type": "string"},
                "since": {"type": "string"},
                "until": {"type": "string"},
                "has": {"type": "array", "items": {"type": "string", "enum": sorted(self._HAS_CHOICES)}},
                "exclude": {"type": "array", "items": {"type": "string", "enum": sorted(self._EXCLUDE_CHOICES)}},
                "min_likes": {"type": "integer", "minimum": 0},
                "min_retweets": {"type": "integer", "minimum": 0},
                "max_count": {"type": "integer", "minimum": 1},
                "full_text": {"type": "boolean"},
                "do_filter": {"type": "boolean"},
            },
            "required": ["operation"],
        }

    async def execute(
        self,
        operation: str,
        query: str | None = None,
        target: str | None = None,
        screen_name: str | None = None,
        text: str | None = None,
        images: list[str] | None = None,
        feed_type: str = "for-you",
        search_type: str = "Top",
        from_user: str | None = None,
        to_user: str | None = None,
        lang: str | None = None,
        since: str | None = None,
        until: str | None = None,
        has: list[str] | None = None,
        exclude: list[str] | None = None,
        min_likes: int | None = None,
        min_retweets: int | None = None,
        max_count: int | None = None,
        full_text: bool = False,
        do_filter: bool = False,
        **kwargs: Any,
    ) -> str:
        op = str(operation or "").strip().lower()
        if op not in self._READ_OPERATIONS and op not in self._WRITE_OPERATIONS:
            return f"Error: unsupported twitter operation: {op}"
        if not self.enabled:
            return "Error: twitter-cli tool is disabled. Enable tools.twitterCli.enabled in config."
        if op in self._WRITE_OPERATIONS and not self.allow_write:
            return (
                "Error: twitter write operations are disabled. "
                "Set tools.twitterCli.allowWrite=true to enable controlled posting."
            )
        if error := self._ensure_available():
            return error

        params = {
            "query": query,
            "target": target,
            "screen_name": screen_name,
            "text": text,
            "images": images or [],
            "feed_type": feed_type,
            "search_type": search_type,
            "from_user": from_user,
            "to_user": to_user,
            "lang": lang,
            "since": since,
            "until": until,
            "has": has or [],
            "exclude": exclude or [],
            "min_likes": min_likes,
            "min_retweets": min_retweets,
            "max_count": max_count,
            "full_text": full_text,
            "do_filter": do_filter,
        }

        args_or_error = self._build_args(op, **params)
        if isinstance(args_or_error, str):
            return args_or_error

        exit_code, stdout, stderr = await self._run_command(args_or_error)
        stripped = stdout.strip()
        if op == "search":
            return await self._handle_search_with_fallback(op, params, exit_code, stripped, stderr)
        if stripped and (exit_code == 0 or stripped.startswith("{")):
            return self._normalize_result(op, stripped)

        payload = {
            "ok": False,
            "schema_version": "1",
            "error": {
                "code": "tool_execution_failed",
                "message": stderr.strip() or stripped or f"twitter-cli exited with code {exit_code}",
            },
            "meta": {"command": [self.command, *args_or_error], "exit_code": exit_code},
        }
        return json.dumps(payload, ensure_ascii=False)

    def _normalize_result(
        self,
        operation: str,
        result: str,
        fallback_info: dict[str, Any] | None = None,
    ) -> str:
        stripped = str(result or "").strip()
        if operation not in self._READ_OPERATIONS or not stripped.startswith("{"):
            return stripped
        try:
            payload = json.loads(stripped)
        except Exception:
            return stripped
        compact = self._compact_read_payload(operation, payload, fallback_info)
        return json.dumps(compact, ensure_ascii=False)

    def _compact_read_payload(
        self,
        operation: str,
        payload: dict[str, Any],
        fallback_info: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if not isinstance(payload, dict) or payload.get("ok") is False:
            return payload

        compact: dict[str, Any] = {
            "ok": True,
            "schema_version": str(payload.get("schema_version") or "1"),
            "operation": operation,
        }
        meta = payload.get("meta")
        if isinstance(meta, dict) and meta:
            compact["meta"] = {k: meta[k] for k in list(meta.keys())[:8]}
        if fallback_info:
            compact.setdefault("meta", {})
            compact["meta"]["fallback"] = fallback_info

        data = payload.get("data")
        if isinstance(data, list):
            compact["data"] = {
                "count": len(data),
                "results": [self._compact_item(operation, item) for item in data[:8]],
            }
            return compact

        if isinstance(data, dict):
            compact["data"] = self._compact_item(operation, data)
            return compact

        compact["data"] = data
        return compact

    def _compact_item(self, operation: str, item: Any) -> Any:
        if not isinstance(item, dict):
            return item

        if operation in {"search", "tweet", "user_posts", "bookmarks", "feed", "likes", "list"}:
            return self._compact_tweet_like_item(item)
        if operation in {"followers", "following"}:
            return self._compact_profile_item(item)
        if operation in {"user", "whoami", "status"}:
            return self._compact_account_item(item)
        if operation == "article":
            return self._compact_article_item(item)
        return {k: item[k] for k in list(item.keys())[:12]}

    def _compact_tweet_like_item(self, item: dict[str, Any]) -> dict[str, Any]:
        author = item.get("author")
        metrics = item.get("metrics")
        compact: dict[str, Any] = {
            "id": item.get("id"),
            "url": self._tweet_url(item),
            "text": self._clean_text(item.get("text")),
            "createdAt": item.get("createdAtLocal") or item.get("createdAtISO") or item.get("createdAt"),
            "lang": item.get("lang"),
            "score": item.get("score"),
            "isRetweet": item.get("isRetweet"),
        }
        if isinstance(author, dict):
            compact["author"] = {
                "name": author.get("name"),
                "screenName": author.get("screenName"),
                "verified": author.get("verified"),
            }
        if isinstance(metrics, dict):
            compact["metrics"] = {
                "likes": metrics.get("likes"),
                "retweets": metrics.get("retweets"),
                "replies": metrics.get("replies"),
                "quotes": metrics.get("quotes"),
                "views": metrics.get("views"),
            }
        media = item.get("media")
        if isinstance(media, list) and media:
            compact["media"] = [{"type": media_item.get("type")} for media_item in media[:3] if isinstance(media_item, dict)]
        return compact

    def _compact_profile_item(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "screenName": item.get("screenName"),
            "description": self._clean_text(item.get("description"), limit=220),
            "verified": item.get("verified"),
            "followersCount": item.get("followersCount"),
            "followingCount": item.get("followingCount"),
        }

    def _compact_account_item(self, item: dict[str, Any]) -> dict[str, Any]:
        compact: dict[str, Any] = {}
        for key in (
            "id",
            "name",
            "screenName",
            "description",
            "verified",
            "followersCount",
            "followingCount",
            "statusesCount",
            "createdAt",
            "createdAtISO",
            "createdAtLocal",
            "authenticated",
            "authType",
        ):
            if key in item:
                compact[key] = self._clean_text(item[key], limit=220) if key == "description" else item[key]
        return compact or {k: item[k] for k in list(item.keys())[:12]}

    def _compact_article_item(self, item: dict[str, Any]) -> dict[str, Any]:
        compact: dict[str, Any] = {}
        for key in ("id", "title", "subtitle", "url", "publishedAt", "publishedAtISO", "publishedAtLocal"):
            if key in item:
                compact[key] = item[key]
        if "text" in item:
            compact["text"] = self._clean_text(item.get("text"), limit=1200)
        if "summary" in item:
            compact["summary"] = self._clean_text(item.get("summary"), limit=420)
        author = item.get("author")
        if isinstance(author, dict):
            compact["author"] = {
                "name": author.get("name"),
                "screenName": author.get("screenName"),
            }
        return compact or {k: item[k] for k in list(item.keys())[:12]}

    def _tweet_url(self, item: dict[str, Any]) -> str | None:
        tweet_id = item.get("id")
        author = item.get("author")
        if not tweet_id or not isinstance(author, dict):
            return None
        screen_name = str(author.get("screenName") or "").strip()
        if not screen_name:
            return None
        return f"https://x.com/{screen_name}/status/{tweet_id}"

    def _clean_text(self, value: Any, *, limit: int | None = None) -> Any:
        if not isinstance(value, str):
            return value
        text = " ".join(value.split())
        max_chars = limit or self._TEXT_PREVIEW_MAX_CHARS
        if len(text) <= max_chars:
            return text
        return text[: max_chars - 3].rstrip() + "..."

    async def _handle_search_with_fallback(
        self,
        operation: str,
        base_params: dict[str, Any],
        exit_code: int,
        stripped: str,
        stderr: str,
    ) -> str:
        if self._search_has_results(stripped, exit_code):
            return self._normalize_result(operation, stripped)

        last_query = base_params.get("query")
        attempts = 0
        for level, params in enumerate(self._build_search_fallback_options(base_params), start=1):
            args_or_error = self._build_args(operation, **params)
            if isinstance(args_or_error, str):
                return args_or_error
            exit_code, stdout, stderr = await self._run_command(args_or_error)
            stripped = stdout.strip()
            if self._search_has_results(stripped, exit_code):
                return self._normalize_result(
                    operation,
                    stripped,
                    fallback_info={
                        "level": level,
                        "query": params.get("query"),
                        "note": "broadened search after no data",
                    },
                )
            attempts = level
            last_query = params.get("query")

        if exit_code != 0:
            payload = {
                "ok": False,
                "schema_version": "1",
                "error": {
                    "code": "search_failure",
                    "message": stderr.strip() or stripped or f"twitter-cli exited with code {exit_code}",
            },
            "meta": {"attempts": attempts, "query": last_query},
            }
            return json.dumps(payload, ensure_ascii=False)

        return self._normalize_result(operation, stripped)

    @staticmethod
    def _search_has_results(stripped: str, exit_code: int) -> bool:
        if exit_code != 0 and not stripped.strip().startswith("{"):
            return False
        try:
            payload = json.loads(stripped)
        except Exception:
            return False
        if "data" not in payload:
            return True
        data = payload.get("data")
        if isinstance(data, list):
            return bool(data)
        if isinstance(data, dict):
            return bool(data)
        return False

    def _build_search_fallback_options(self, base_params: dict[str, Any]) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        fallback = self._clone_search_options(base_params)
        fallback["min_likes"] = None
        fallback["do_filter"] = False
        candidates.append(fallback)

        fallback2 = self._clone_search_options(base_params)
        fallback2["min_likes"] = None
        fallback2["do_filter"] = False
        fallback2["exclude"] = []
        fallback2["search_type"] = "Top"
        fallback2["query"] = self._simplify_query_for_fallback(base_params.get("query"))
        candidates.append(fallback2)

        fallback3 = self._clone_search_options(base_params)
        fallback3["min_likes"] = None
        fallback3["do_filter"] = False
        fallback3["exclude"] = []
        fallback3["max_count"] = 5
        fallback3["search_type"] = "Top"
        fallback3["query"] = self._simplify_query_for_fallback(base_params.get("query"))
        candidates.append(fallback3)

        return candidates

    @staticmethod
    def _clone_search_options(params: dict[str, Any]) -> dict[str, Any]:
        clone = dict(params)
        clone["has"] = list(params.get("has") or [])
        clone["exclude"] = list(params.get("exclude") or [])
        return clone

    @staticmethod
    def _simplify_query_for_fallback(query: str | None) -> str:
        text = " ".join(str(query or "").split()).strip()
        if not text:
            return text
        match = re.search(r"\\b[A-Z]{1,5}\\b", text)
        if match:
            ticker = match.group(0)
            if ticker not in {"A", "I", "X", "US", "USA", "AI"}:
                return f"${ticker} guidance"
        return text

    def _ensure_available(self) -> str | None:
        if shutil.which(self.command):
            return None
        command_path = Path(self.command).expanduser()
        if command_path.exists():
            return None
        return f"Error: twitter-cli command not found: {self.command}"

    def _build_args(
        self,
        operation: str,
        *,
        query: str | None,
        target: str | None,
        screen_name: str | None,
        text: str | None,
        images: list[str],
        feed_type: str,
        search_type: str,
        from_user: str | None,
        to_user: str | None,
        lang: str | None,
        since: str | None,
        until: str | None,
        has: list[str],
        exclude: list[str],
        min_likes: int | None,
        min_retweets: int | None,
        max_count: int | None,
        full_text: bool,
        do_filter: bool,
    ) -> list[str] | str:
        args: list[str] = []
        if operation == "status":
            return ["status", "--json"]
        if operation == "whoami":
            return ["whoami", "--json"]
        if operation == "feed":
            normalized_feed = str(feed_type or "for-you").strip().lower()
            if normalized_feed not in self._FEED_TYPES:
                return f"Error: unsupported twitter feed type: {feed_type}"
            args = ["feed", "--type", normalized_feed]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text, do_filter=do_filter)
        if operation == "bookmarks":
            args = ["bookmarks"]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text, do_filter=do_filter)
        if operation == "search":
            normalized_search = str(search_type or "Top").strip()
            if normalized_search not in self._SEARCH_TYPES:
                return f"Error: unsupported twitter search type: {search_type}"
            if not any([query, from_user, to_user, lang, since, until, has, exclude, min_likes is not None, min_retweets is not None]):
                return "Error: query or at least one advanced filter is required for twitter search"
            args = ["search"]
            if query:
                args.append(query)
            args.extend(["--type", normalized_search])
            if from_user:
                args.extend(["--from", self._normalize_screen_name(from_user)])
            if to_user:
                args.extend(["--to", self._normalize_screen_name(to_user)])
            if lang:
                args.extend(["--lang", str(lang).strip()])
            if since:
                args.extend(["--since", str(since).strip()])
            if until:
                args.extend(["--until", str(until).strip()])
            for item in has:
                args.extend(["--has", str(item).strip().lower()])
            for item in exclude:
                args.extend(["--exclude", str(item).strip().lower()])
            if min_likes is not None:
                args.extend(["--min-likes", str(min_likes)])
            if min_retweets is not None:
                args.extend(["--min-retweets", str(min_retweets)])
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text, do_filter=do_filter)
        if operation == "tweet":
            if not target:
                return "Error: target is required for twitter tweet"
            args = ["tweet", str(target).strip()]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text)
        if operation == "article":
            if not target:
                return "Error: target is required for twitter article"
            return ["article", str(target).strip(), "--json"]
        if operation == "list":
            if not target:
                return "Error: target is required for twitter list"
            args = ["list", str(target).strip()]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text, do_filter=do_filter)
        if operation == "user":
            if not screen_name:
                return "Error: screen_name is required for twitter user"
            return ["user", self._normalize_screen_name(screen_name), "--json"]
        if operation == "user_posts":
            if not screen_name:
                return "Error: screen_name is required for twitter user_posts"
            args = ["user-posts", self._normalize_screen_name(screen_name)]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text)
        if operation == "likes":
            if not screen_name:
                return "Error: screen_name is required for twitter likes"
            args = ["likes", self._normalize_screen_name(screen_name)]
            return self._append_common_read_flags(args, max_count=max_count, full_text=full_text, do_filter=do_filter)
        if operation == "followers":
            if not screen_name:
                return "Error: screen_name is required for twitter followers"
            return self._append_common_read_flags(
                ["followers", self._normalize_screen_name(screen_name)],
                max_count=max_count,
            )
        if operation == "following":
            if not screen_name:
                return "Error: screen_name is required for twitter following"
            return self._append_common_read_flags(
                ["following", self._normalize_screen_name(screen_name)],
                max_count=max_count,
            )
        if operation == "post":
            if not text:
                return "Error: text is required for twitter post"
            args = ["post", text]
            if target:
                args.extend(["--reply-to", str(target).strip()])
            return self._append_common_write_flags(args, images=images)
        if operation == "reply":
            if not target:
                return "Error: target is required for twitter reply"
            if not text:
                return "Error: text is required for twitter reply"
            return self._append_common_write_flags(["reply", str(target).strip(), text], images=images)
        if operation == "quote":
            if not target:
                return "Error: target is required for twitter quote"
            if not text:
                return "Error: text is required for twitter quote"
            return self._append_common_write_flags(["quote", str(target).strip(), text], images=images)
        if operation == "follow":
            if not screen_name:
                return "Error: screen_name is required for twitter follow"
            return [operation, self._normalize_screen_name(screen_name), "--json"]
        if operation == "unfollow":
            if not screen_name:
                return "Error: screen_name is required for twitter unfollow"
            return [operation, self._normalize_screen_name(screen_name), "--json"]
        if operation == "delete":
            if not target:
                return "Error: target is required for twitter delete"
            return ["delete", str(target).strip(), "--yes", "--json"]
        if operation in {"like", "unlike", "retweet", "unretweet", "bookmark", "unbookmark"}:
            if not target:
                return f"Error: target is required for twitter {operation}"
            return [operation, str(target).strip(), "--json"]
        return f"Error: unsupported twitter operation: {operation}"

    @staticmethod
    def _normalize_screen_name(value: str) -> str:
        text = str(value or "").strip().lstrip("@")
        return text

    @staticmethod
    def _append_common_read_flags(
        args: list[str],
        *,
        max_count: int | None = None,
        full_text: bool = False,
        do_filter: bool = False,
    ) -> list[str]:
        built = list(args)
        if max_count is not None:
            built.extend(["--max", str(max_count)])
        if full_text:
            built.append("--full-text")
        if do_filter:
            built.append("--filter")
        built.append("--json")
        return built

    @staticmethod
    def _append_common_write_flags(args: list[str], *, images: list[str]) -> list[str]:
        built = list(args)
        for image_path in images:
            value = str(image_path).strip()
            if value:
                built.extend(["--image", value])
        built.append("--json")
        return built

    async def _run_command(self, args: list[str]) -> tuple[int, str, str]:
        env = os.environ.copy()
        env["OUTPUT"] = "json"
        if self.browser:
            env["TWITTER_BROWSER"] = self.browser
        if self.chrome_profile:
            env["TWITTER_CHROME_PROFILE"] = self.chrome_profile
        if self.proxy:
            env["TWITTER_PROXY"] = self.proxy
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
            return 124, "", f"twitter-cli timed out after {self.timeout}s"
        return (
            process.returncode,
            stdout.decode("utf-8", errors="replace"),
            stderr.decode("utf-8", errors="replace"),
        )

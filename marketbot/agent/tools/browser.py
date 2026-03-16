"""Browser-backed tools that wrap the local bb-browser CLI."""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from marketbot.agent.tools.base import Tool


class _BrowserToolBase(Tool):
    """Shared helpers for browser-backed tool wrappers."""

    SAFE_PAGE_ACTIONS = {"open", "snapshot", "screenshot"}
    INTERACTIVE_PAGE_ACTIONS = SAFE_PAGE_ACTIONS | {"click", "fill", "press"}

    def __init__(self, browser_config: Any | None = None, workspace: Path | None = None):
        self.workspace = workspace
        self.browser_config = browser_config
        self.command = getattr(browser_config, "command", "bb-browser") if browser_config else "bb-browser"
        self.enabled = bool(getattr(browser_config, "enabled", False)) if browser_config else False
        self.mode = str(getattr(browser_config, "mode", "safe") or "safe")
        self.timeout = int(getattr(browser_config, "timeout_s", 20) or 20) if browser_config else 20
        self.allow_sites = {str(item).strip().lower() for item in (getattr(browser_config, "allow_sites", []) or [])}
        self.allow_adapters = {
            str(item).strip().lower() for item in (getattr(browser_config, "allow_adapters", []) or []) if str(item).strip()
        }
        self.adapter_catalog = {
            str(item).strip().lower() for item in (getattr(browser_config, "adapter_catalog", []) or []) if str(item).strip()
        }
        self.allow_domains = {
            str(item).strip().lower() for item in (getattr(browser_config, "allow_domains", []) or []) if str(item).strip()
        }
        self.allow_url_prefixes = [
            str(item).strip() for item in (getattr(browser_config, "allow_url_prefixes", []) or []) if str(item).strip()
        ]
        self.allow_eval = bool(getattr(browser_config, "allow_eval", False)) if browser_config else False
        self.allow_request_capture = bool(getattr(browser_config, "allow_request_capture", False)) if browser_config else False
        self.allow_request_bodies = bool(getattr(browser_config, "allow_request_bodies", False)) if browser_config else False

    def _ensure_available(self) -> str | None:
        if not self.enabled:
            return "Error: browser tools are disabled. Enable tools.browser.enabled in config."
        if not shutil.which(self.command):
            return f"Error: browser command not found: {self.command}"
        return None

    def _adapter_allowed(self, adapter: str) -> bool:
        normalized = adapter.strip().lower()
        if self.adapter_catalog:
            return normalized in self.adapter_catalog
        if self.allow_adapters:
            return normalized in self.allow_adapters
        if not self.allow_sites:
            return True
        site = normalized.split("/", 1)[0].strip()
        return site in self.allow_sites

    @staticmethod
    def _extract_http_url(value: str | None) -> str | None:
        if not value:
            return None
        candidate = str(value).strip()
        if not candidate:
            return None
        parsed = urlparse(candidate)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
            return None
        return candidate

    def _url_allowed(self, value: str | None) -> tuple[bool, str | None]:
        url = self._extract_http_url(value)
        if not url:
            return True, None

        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if host.startswith("www."):
            bare_host = host[4:]
        else:
            bare_host = host

        if self.allow_url_prefixes:
            for prefix in self.allow_url_prefixes:
                if url.startswith(prefix):
                    return True, None
            return False, f"Error: url blocked by prefix allowlist: {url}"

        if self.allow_domains:
            for allowed in self.allow_domains:
                normalized = allowed.lower()
                if bare_host == normalized or bare_host.endswith(f".{normalized}"):
                    return True, None
            return False, f"Error: url blocked by domain allowlist: {url}"

        return True, None

    async def _run(self, args: list[str], prefix_args: list[str] | None = None) -> str:
        command = [self.command, *(prefix_args or []), *args]
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(self.workspace) if self.workspace else None,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=self.timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return json.dumps({"error": f"browser command timed out after {self.timeout}s", "command": command}, ensure_ascii=False)

        payload = {
            "command": command,
            "exitCode": process.returncode,
            "stdout": stdout.decode("utf-8", errors="replace").strip(),
            "stderr": stderr.decode("utf-8", errors="replace").strip(),
        }
        return json.dumps(payload, ensure_ascii=False)


class BrowserSiteTool(_BrowserToolBase):
    """Invoke a bb-browser site adapter."""

    _ADAPTER_RE = re.compile(r"^[a-z0-9][a-z0-9\-]*/[a-z0-9][a-z0-9\-]*$", re.IGNORECASE)

    name = "browser_site"
    description = "Use a local bb-browser site adapter with the user's real browser session."
    parameters = {
        "type": "object",
        "properties": {
            "adapter": {"type": "string", "description": "Site adapter, e.g. xueqiu/hot-stock"},
            "args": {"type": "array", "items": {"type": "string"}},
            "json": {"type": "boolean", "default": True},
            "jq": {"type": "string", "description": "Optional jq expression"},
        },
        "required": ["adapter"],
    }

    async def execute(self, adapter: str, args: list[str] | None = None, json: bool = True, jq: str | None = None, **kwargs: Any) -> str:
        normalized = str(adapter or "").strip()
        if not self._ADAPTER_RE.fullmatch(normalized):
            return "Error: adapter must look like <site>/<command> using only letters, numbers, and hyphens"
        if not self._adapter_allowed(normalized):
            return f"Error: adapter blocked by allowlist: {normalized}"
        normalized_args: list[str] = []
        for raw in args or []:
            value = str(raw).strip()
            if not value:
                continue
            if value.startswith("--"):
                return f"Error: adapter args must not include raw CLI flags: {value}"
            normalized_args.append(value)
        if error := self._ensure_available():
            return error

        command = ["site", normalized, *normalized_args]
        if json:
            command.append("--json")
        if jq:
            command.extend(["--jq", jq])
        return await self._run(command)


class BrowserPageTool(_BrowserToolBase):
    """Run page-level browser actions."""

    name = "browser_page"
    description = "Open, inspect, and interact with pages through the local bb-browser CLI."
    parameters = {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["open", "snapshot", "click", "fill", "press", "screenshot", "eval"]},
            "target": {"type": "string", "description": "URL, element handle, or JS expression depending on action"},
            "value": {"type": "string", "description": "Optional action value, e.g. fill text or key name for press"},
            "tab": {"type": "string", "description": "Optional tab id"},
            "json": {"type": "boolean", "default": True},
        },
        "required": ["action"],
    }

    def _action_allowed(self, action: str) -> bool:
        if self.mode == "safe":
            return action in self.SAFE_PAGE_ACTIONS
        if self.mode == "interactive":
            return action in self.INTERACTIVE_PAGE_ACTIONS
        return True

    async def execute(
        self,
        action: str,
        target: str | None = None,
        value: str | None = None,
        tab: str | None = None,
        json: bool = True,
        **kwargs: Any,
    ) -> str:
        action_name = str(action or "").strip().lower()
        if not self._action_allowed(action_name):
            return f"Error: browser action blocked in {self.mode} mode: {action_name}"
        if action_name == "eval":
            if self.mode != "sensitive":
                return f"Error: browser eval requires sensitive mode, current={self.mode}"
            if not self.allow_eval:
                return "Error: browser eval is disabled. Enable tools.browser.allow_eval in config."
        allowed, reason = self._url_allowed(target)
        if not allowed:
            return reason or "Error: target blocked by url allowlist"
        if error := self._ensure_available():
            return error
        prefix_args: list[str] = []
        if tab:
            prefix_args.extend(["--tab", tab])

        command = [action_name]
        if target:
            command.append(target)
        if value and action_name in {"fill", "eval", "press"}:
            command.append(value)
        if json:
            command.append("--json")
        return await self._run(command, prefix_args=prefix_args)


class BrowserNetworkTool(_BrowserToolBase):
    """Run network-level browser operations."""

    name = "browser_network"
    description = "Use authenticated fetch or inspect network requests through the local bb-browser CLI."
    parameters = {
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": ["fetch", "requests"]},
            "url": {"type": "string", "description": "URL for fetch mode"},
            "withBody": {"type": "boolean", "default": False},
            "json": {"type": "boolean", "default": True},
        },
        "required": ["mode"],
    }

    async def execute(self, mode: str, url: str | None = None, withBody: bool = False, json: bool = True, **kwargs: Any) -> str:
        if self.mode != "sensitive":
            return f"Error: browser network access requires sensitive mode, current={self.mode}"
        mode_name = str(mode or "").strip().lower()
        if mode_name == "fetch":
            if not url:
                return "Error: url is required for browser_network fetch"
            allowed, reason = self._url_allowed(url)
            if not allowed:
                return reason or "Error: url blocked by allowlist"
            command = ["fetch", url]
        else:
            if not self.allow_request_capture:
                return "Error: browser request capture is disabled. Enable tools.browser.allow_request_capture in config."
            if withBody and not self.allow_request_bodies:
                return "Error: browser request bodies are disabled. Enable tools.browser.allow_request_bodies in config."
            command = ["network", "requests"]
            if withBody:
                command.append("--with-body")
        if error := self._ensure_available():
            return error
        if json:
            command.append("--json")
        return await self._run(command)

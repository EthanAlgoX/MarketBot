"""Direct OpenAI-compatible provider — bypasses LiteLLM."""

from __future__ import annotations

import hashlib
import uuid
from typing import Any
from urllib.parse import urljoin

import httpx

import json_repair
from openai import AsyncOpenAI

from marketbot.providers.base import LLMProvider, LLMResponse, ToolCallRequest


class CustomProvider(LLMProvider):
    @staticmethod
    def _extract_http_error_detail(error: Exception) -> str:
        """Return a compact provider error without leaking transport URLs into user replies."""
        if isinstance(error, httpx.HTTPStatusError):
            status = error.response.status_code
            reason = error.response.reason_phrase or "HTTP error"
            detail = ""
            try:
                payload = error.response.json()
            except Exception:
                payload = None
            if isinstance(payload, dict):
                err = payload.get("error")
                if isinstance(err, dict):
                    detail = str(err.get("message") or err.get("type") or "").strip()
                elif err is not None:
                    detail = str(err).strip()
                elif payload.get("message"):
                    detail = str(payload.get("message") or "").strip()
            if not detail:
                detail = (error.response.text or "").strip()[:240]
            detail = detail or "Check providers.custom credentials, base URL, extra headers, and model access."
            return f"AI gateway returned {status} {reason}. {detail}"
        return str(error)

    @staticmethod
    def _normalize_tool_call_id(tool_call_id: Any) -> Any:
        """Normalize tool_call_id to a backend-safe short form while preserving linkage."""
        if not isinstance(tool_call_id, str):
            return tool_call_id
        if len(tool_call_id) == 9 and tool_call_id.isalnum():
            return tool_call_id
        return hashlib.sha1(tool_call_id.encode()).hexdigest()[:9]

    @classmethod
    def _sanitize_messages(cls, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Keep assistant tool_calls[].id and tool tool_call_id in sync for strict backends."""
        allowed = frozenset({"role", "content", "tool_calls", "tool_call_id", "name", "reasoning_content"})
        sanitized = LLMProvider._sanitize_request_messages(messages, allowed)
        id_map: dict[str, str] = {}

        def map_id(value: Any) -> Any:
            if not isinstance(value, str):
                return value
            return id_map.setdefault(value, cls._normalize_tool_call_id(value))

        for clean in sanitized:
            if isinstance(clean.get("tool_calls"), list):
                normalized_tool_calls = []
                for tc in clean["tool_calls"]:
                    if not isinstance(tc, dict):
                        normalized_tool_calls.append(tc)
                        continue
                    tc_clean = dict(tc)
                    tc_clean["id"] = map_id(tc_clean.get("id"))
                    normalized_tool_calls.append(tc_clean)
                clean["tool_calls"] = normalized_tool_calls

            if "tool_call_id" in clean and clean["tool_call_id"]:
                clean["tool_call_id"] = map_id(clean["tool_call_id"])
        return sanitized

    def __init__(
        self,
        api_key: str = "no-key",
        api_base: str = "http://localhost:8000/v1",
        default_model: str = "default",
        extra_headers: dict[str, str] | None = None,
    ):
        super().__init__(api_key, api_base)
        self.default_model = default_model
        self._affinity = uuid.uuid4().hex
        self._default_headers = {"x-session-affinity": self._affinity}
        if api_key and api_key != "no-key":
            self._default_headers["Authorization"] = f"Bearer {api_key}"
        if extra_headers:
            self._default_headers.update(
                {
                    str(key): str(value)
                    for key, value in extra_headers.items()
                    if key and value is not None
                }
            )
        # Keep affinity stable for this provider instance to improve backend cache locality.
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=api_base,
            default_headers=self._default_headers,
        )

    async def chat(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None,
                   model: str | None = None, max_tokens: int = 4096, temperature: float = 0.7,
                   reasoning_effort: str | None = None) -> LLMResponse:
        kwargs: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": self._sanitize_messages(self._sanitize_empty_content(messages)),
            "max_tokens": max(1, max_tokens),
            "temperature": temperature,
        }
        if reasoning_effort:
            kwargs["reasoning_effort"] = reasoning_effort
        if tools:
            kwargs.update(tools=tools, tool_choice="auto")
        try:
            return self._parse(await self._client.chat.completions.create(**kwargs))
        except Exception as primary_error:
            try:
                return await self._chat_http_fallback(kwargs)
            except Exception as fallback_error:
                detail = self._extract_http_error_detail(fallback_error)
                if detail == str(fallback_error):
                    detail = self._extract_http_error_detail(primary_error)
                return LLMResponse(content=f"Error: {detail}", finish_reason="error")

    async def _chat_http_fallback(self, payload: dict[str, Any]) -> LLMResponse:
        """Fallback to raw HTTP for OpenAI-compatible backends with loose schemas."""
        base = str(self.api_base or "").rstrip("/") + "/"
        url = urljoin(base, "chat/completions")
        headers = dict(self._default_headers)
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=60.0, headers=headers) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return self._parse_raw_response(response.json())

    def _parse(self, response: Any) -> LLMResponse:
        choice = response.choices[0]
        msg = choice.message
        tool_calls: list[ToolCallRequest] = []
        for index, tc in enumerate(msg.tool_calls or []):
            function = getattr(tc, "function", None)
            if function is None:
                continue
            name = str(getattr(function, "name", "") or "").strip()
            if not name:
                continue
            args = getattr(function, "arguments", None)
            if isinstance(args, str):
                args = json_repair.loads(args)
            elif args is None:
                args = {}
            elif not isinstance(args, dict):
                args = {"raw": args}
            tool_calls.append(
                ToolCallRequest(
                    id=str(getattr(tc, "id", None) or f"call_{index}"),
                    name=name,
                    arguments=args,
                )
            )
        u = response.usage
        return LLMResponse(
            content=msg.content, tool_calls=tool_calls, finish_reason=choice.finish_reason or "stop",
            usage={"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens, "total_tokens": u.total_tokens} if u else {},
            reasoning_content=getattr(msg, "reasoning_content", None) or None,
        )

    def _parse_raw_response(self, response: dict[str, Any]) -> LLMResponse:
        """Parse raw OpenAI-compatible JSON from non-strict backends."""
        error_payload = response.get("error")
        if isinstance(error_payload, dict):
            message = str(error_payload.get("message") or error_payload.get("type") or error_payload).strip()
            return LLMResponse(content=f"Error: {message}", finish_reason="error")
        if error_payload is not None:
            return LLMResponse(content=f"Error: {error_payload}", finish_reason="error")
        status_code = response.get("status_code")
        status_msg = response.get("status_msg")
        if status_code is not None and status_msg is not None:
            return LLMResponse(
                content=f"Error: backend status {status_code}: {status_msg}",
                finish_reason="error",
            )

        base_resp = response.get("base_resp")
        choices = response.get("choices")
        if isinstance(choices, dict):
            choices = [choices]
        if (choices is None or (isinstance(choices, list) and not choices)) and isinstance(base_resp, dict):
            choices = base_resp.get("choices")
            if isinstance(choices, dict):
                choices = [choices]
        input_sensitive_present = "input_sensitive" in response or "input_sensitive_type" in response
        input_sensitive = response.get("input_sensitive")
        if input_sensitive or (input_sensitive_present and (not isinstance(choices, list) or not choices)):
            sensitive_type = str(response.get("input_sensitive_type") or "unknown").strip()
            return LLMResponse(
                content=f"Error: backend flagged the request as input_sensitive ({sensitive_type})",
                finish_reason="error",
            )

        if isinstance(base_resp, dict):
            nested = self._parse_raw_response(base_resp)
            if nested.finish_reason != "error":
                return nested
            if not isinstance(choices, list) or not choices:
                return nested

        if not isinstance(choices, list) or not choices:
            summary_keys = ", ".join(sorted(str(key) for key in response.keys())[:8]) if isinstance(response, dict) else ""
            summary = f"missing choices; payload keys={summary_keys}" if summary_keys else "missing choices"
            return LLMResponse(content=f"Error: {summary}", finish_reason="error")
        choice = choices[0]
        if not isinstance(choice, dict):
            return LLMResponse(content="Error: invalid choice payload", finish_reason="error")
        msg = choice.get("message")
        if msg is None:
            # Some backends flatten assistant content onto the choice itself.
            msg = {
                "content": choice.get("content"),
                "tool_calls": choice.get("tool_calls"),
                "reasoning_content": choice.get("reasoning_content"),
            }
        if not isinstance(msg, dict):
            return LLMResponse(content="Error: invalid message payload", finish_reason="error")

        tool_calls: list[ToolCallRequest] = []
        raw_tool_calls = msg.get("tool_calls")
        if isinstance(raw_tool_calls, list):
            for index, tc in enumerate(raw_tool_calls):
                if not isinstance(tc, dict):
                    continue
                function = tc.get("function")
                if not isinstance(function, dict):
                    continue
                name = str(function.get("name") or "").strip()
                if not name:
                    continue
                args = function.get("arguments")
                if isinstance(args, str):
                    args = json_repair.loads(args)
                elif args is None:
                    args = {}
                elif not isinstance(args, dict):
                    args = {"raw": args}
                tool_calls.append(
                    ToolCallRequest(
                        id=str(tc.get("id") or f"call_{index}"),
                        name=name,
                        arguments=args,
                    )
                )

        usage_raw = response.get("usage") or {}
        usage = (
            {
                "prompt_tokens": int(usage_raw.get("prompt_tokens", 0) or 0),
                "completion_tokens": int(usage_raw.get("completion_tokens", 0) or 0),
                "total_tokens": int(usage_raw.get("total_tokens", 0) or 0),
            }
            if isinstance(usage_raw, dict)
            else {}
        )
        return LLMResponse(
            content=msg.get("content"),
            tool_calls=tool_calls,
            finish_reason=str(choice.get("finish_reason") or "stop"),
            usage=usage,
            reasoning_content=msg.get("reasoning_content") or None,
        )

    def get_default_model(self) -> str:
        return self.default_model

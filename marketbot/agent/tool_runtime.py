"""Tool execution and iterative agent runtime helpers."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Awaitable, Callable

from loguru import logger


def compress_tool_result(cls: Any, tool_name: str, result: str) -> str:
    """Trim low-value tool output before feeding it back into the next LLM call."""
    if not isinstance(result, str):
        result = json.dumps(result, ensure_ascii=False)

    if len(result) <= cls._TOOL_RESULT_PROMPT_MAX_CHARS:
        return result

    if tool_name == "market_brief":
        # Preserve the structured market brief payload for explainability rendering.
        return result

    stripped = result.strip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            payload = json.loads(stripped)
        except Exception:
            payload = None
        if isinstance(payload, dict):
            summary: dict[str, Any] = {"keys": list(payload.keys())[:12]}
            for key in (
                "symbol",
                "symbols",
                "provider",
                "activeSymbol",
                "headline",
                "summary",
                "conclusion",
                "confidence",
                "warnings",
                "error",
            ):
                if key not in payload:
                    continue
                value = payload[key]
                if isinstance(value, (str, int, float, bool)) or value is None:
                    summary[key] = value
                elif isinstance(value, list):
                    summary[key] = {
                        "count": len(value),
                        "sample": value[:3],
                    }
                elif isinstance(value, dict):
                    summary[key] = {k: value[k] for k in list(value.keys())[:8]}
            compact = {
                "_truncated": True,
                "_tool": tool_name,
                "_original_chars": len(result),
                "summary": summary,
            }
            return json.dumps(compact, ensure_ascii=False)

    line_count = result.count("\n") + 1
    head = result[: cls._TOOL_RESULT_PROMPT_MAX_CHARS].rstrip()
    return (
        f"{head}\n\n"
        f"[tool output truncated for context efficiency: {len(result)} chars across {line_count} lines]"
    )


def merge_usage(total: dict[str, int], usage: dict[str, int] | None) -> dict[str, int]:
    """Merge one provider usage block into the running totals."""
    if not usage:
        return total
    total["calls"] = total.get("calls", 0) + 1
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = usage.get(key)
        if isinstance(value, int):
            total[key] = total.get(key, 0) + value
    return total


def tool_cache_key(tool_call: Any) -> str:
    """Build a stable cache key for a tool call."""
    arguments = tool_call.arguments
    try:
        raw = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
    except TypeError:
        raw = json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str)
    return f"{tool_call.name}:{raw}"


def build_cached_tool_result(tool_name: str, previous_result: str) -> str:
    """Return a compact reminder instead of duplicating the same tool output."""
    preview = previous_result[:280]
    payload = {
        "cached": True,
        "tool": tool_name,
        "note": "Identical tool call already executed earlier in this run. Reuse the previous result.",
        "preview": preview,
    }
    return json.dumps(payload, ensure_ascii=False)


async def execute_tool_calls(loop: Any, tool_calls: list) -> list[tuple[Any, str]]:
    """Execute a batch of tool calls, parallelizing only read-only calls."""
    results: list[tuple[Any, str] | None] = [None] * len(tool_calls)
    parallel_batch: list[tuple[int, Any]] = []
    parallel_pending: dict[str, tuple[int, Any]] = {}
    parallel_duplicates: dict[str, list[tuple[int, Any]]] = {}
    cache: dict[str, str] = {}

    async def _run_single(index: int, tool_call: Any) -> tuple[int, str, str]:
        normalized_args = loop._normalize_tool_arguments_for_request(tool_call.name, tool_call.arguments)
        args_str = json.dumps(normalized_args, ensure_ascii=False)
        logger.info("Tool call: {}({})", tool_call.name, args_str[:200])
        blocked = loop._tool_policy_result(tool_call.name)
        if blocked is not None:
            result = blocked
        else:
            result = await loop.tools.execute(tool_call.name, normalized_args)
        compressed = loop._compress_tool_result(tool_call.name, result)
        return index, loop._tool_cache_key(tool_call), compressed

    async def _flush_parallel_batch() -> None:
        nonlocal parallel_batch, parallel_pending, parallel_duplicates
        if not parallel_batch:
            return
        executed = await asyncio.gather(*(_run_single(idx, tc) for idx, tc in parallel_batch))
        for idx, cache_key_value, result in executed:
            cache[cache_key_value] = result
            results[idx] = (tool_calls[idx], result)
            for dup_idx, dup_call in parallel_duplicates.get(cache_key_value, []):
                results[dup_idx] = (
                    dup_call,
                    loop._build_cached_tool_result(dup_call.name, result),
                )
        parallel_batch = []
        parallel_pending = {}
        parallel_duplicates = {}

    for index, tool_call in enumerate(tool_calls):
        cache_key_value = loop._tool_cache_key(tool_call)
        if cache_key_value in cache:
            results[index] = (
                tool_call,
                loop._build_cached_tool_result(tool_call.name, cache[cache_key_value]),
            )
            continue

        if loop._is_parallel_safe_tool(tool_call.name):
            if cache_key_value in parallel_pending:
                parallel_duplicates.setdefault(cache_key_value, []).append((index, tool_call))
                continue
            parallel_batch.append((index, tool_call))
            parallel_pending[cache_key_value] = (index, tool_call)
            continue

        await _flush_parallel_batch()
        idx, cache_key_value, result = await _run_single(index, tool_call)
        cache[cache_key_value] = result
        results[idx] = (tool_calls[idx], result)

    await _flush_parallel_batch()
    ordered_results: list[tuple[Any, str]] = []
    for item in results:
        if item is not None:
            ordered_results.append(item)
    return ordered_results


async def run_agent_loop(
    loop: Any,
    initial_messages: list[dict],
    on_progress: Callable[..., Awaitable[None]] | None = None,
) -> tuple[str | None, list[str], list[dict], dict[str, int]]:
    """Run the agent iteration loop. Returns (final_content, tools_used, messages, usage)."""
    messages = initial_messages
    iteration = 0
    tool_rounds = 0
    final_content = None
    tools_used: list[str] = []
    usage_totals: dict[str, int] = {}
    loop._active_request_flags = {
        "broad_market_scan": loop._is_broad_market_scan_request(initial_messages),
        "daily_opportunity_scan": loop._DAILY_OPPORTUNITY_SKILL in loop._selected_skill_names(),
    }
    try:
        while iteration < loop.max_iterations:
            iteration += 1
            tools_for_call = loop._tool_definitions_for_request()
            if loop._active_request_flags.get("broad_market_scan") and tool_rounds >= 1:
                tools_for_call = []

            response = await loop.provider.chat(
                messages=messages,
                tools=tools_for_call,
                model=loop.model,
                temperature=loop.temperature,
                max_tokens=loop.max_tokens,
                reasoning_effort=loop.reasoning_effort,
            )
            usage_totals = loop._merge_usage(usage_totals, response.usage)
            if response.usage:
                logger.info(
                    "LLM usage iteration={} prompt={} completion={} total={}",
                    iteration,
                    response.usage.get("prompt_tokens", 0),
                    response.usage.get("completion_tokens", 0),
                    response.usage.get("total_tokens", 0),
                )

            if response.has_tool_calls:
                tool_calls = response.tool_calls

                if on_progress:
                    await on_progress(loop._tool_hint(tool_calls), tool_hint=True)

                tool_call_dicts = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                        },
                    }
                    for tc in tool_calls
                ]
                messages = loop.context.add_assistant_message(
                    messages,
                    response.content,
                    tool_call_dicts,
                    reasoning_content=response.reasoning_content,
                    thinking_blocks=response.thinking_blocks,
                )

                if len(tool_calls) > 1:
                    logger.info("Executing {} tool calls (parallel where safe)", len(tool_calls))

                for tool_call, result in await loop._execute_tool_calls(tool_calls):
                    tools_used.append(tool_call.name)
                    messages = loop.context.add_tool_result(
                        messages,
                        tool_call.id,
                        tool_call.name,
                        result,
                    )
                tool_rounds += 1
                messages, tools_used, tool_rounds = await loop._auto_append_daily_opportunity_market_brief(
                    messages,
                    tools_used,
                    tool_rounds=tool_rounds,
                )
            else:
                clean = loop._strip_think(response.content)
                # Don't persist error responses to session history — they can
                # poison the context and cause permanent 400 loops (#1303).
                if response.finish_reason == "error":
                    logger.error("LLM returned error: {}", (clean or "")[:200])
                    final_content = clean or "Sorry, I encountered an error calling the AI model."
                    break
                messages = loop.context.add_assistant_message(
                    messages,
                    clean,
                    reasoning_content=response.reasoning_content,
                    thinking_blocks=response.thinking_blocks,
                )
                final_content = clean
                break
    finally:
        loop._active_request_flags = {}

    if final_content is None and iteration >= loop.max_iterations:
        logger.warning("Max iterations ({}) reached", loop.max_iterations)
        final_content = (
            f"I reached the maximum number of tool call iterations ({loop.max_iterations}) "
            "without completing the task. You can try breaking the task into smaller steps."
        )

    return final_content, tools_used, messages, usage_totals

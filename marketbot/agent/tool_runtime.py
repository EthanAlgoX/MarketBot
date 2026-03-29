"""Tool execution and iterative agent runtime helpers."""

from __future__ import annotations

import asyncio
import json
import re
import time
from html import escape
from pathlib import Path
from typing import Any, Awaitable, Callable
from uuid import uuid4

from loguru import logger

from marketbot.providers.base import ToolCallRequest


def _fallback_preview(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        text = str(value)
        return text if len(text) <= 120 else text[:117] + "..."
    if isinstance(value, list):
        return f"{len(value)} item(s)"
    if isinstance(value, dict):
        keys = ", ".join(list(value.keys())[:4])
        return f"{{{keys}}}"
    return str(value)


def _latest_user_content(messages: list[dict[str, Any]]) -> tuple[str, int]:
    """Extract latest user text and attached image count from message content."""
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            return content, 0
        if isinstance(content, list):
            text_parts: list[str] = []
            image_count = 0
            for item in content:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "text":
                    value = item.get("text")
                    if isinstance(value, str):
                        text_parts.append(value)
                elif item.get("type") == "image_url":
                    image_count += 1
            return "\n".join(text_parts), image_count
    return "", 0


def _is_xiaohongshu_publish_request(text: str) -> bool:
    lowered = str(text or "").lower()
    publish_markers = (
        "发小红书",
        "发布小红书",
        "发布一条小红书",
        "发一条小红书",
        "发个小红书",
        "小红书发布",
        "小红书发帖",
        "发到小红书",
        "直接发送小红书",
        "publish to xiaohongshu",
        "post to xiaohongshu",
        "send to xiaohongshu",
    )
    return any(marker in lowered for marker in publish_markers)


def _is_twitter_publish_request(text: str) -> bool:
    lowered = str(text or "").lower()
    publish_markers = (
        "发推",
        "推特",
        "发推特",
        "发布推特",
        "发布一条推特",
        "发一条推特",
        "发个推特",
        "推文",
        "发推文",
        "发布推文",
        "发布一条推文",
        "发一条推文",
        "发个推文",
        "发 twitter",
        "发 x ",
        "发到 twitter",
        "发到 x",
        "发布到 twitter",
        "发布到 x",
        "tweet this",
        "post to twitter",
        "post on x",
        "publish to twitter",
        "publish on x",
        "send to twitter",
    )
    return any(marker in lowered for marker in publish_markers)


def _direct_xiaohongshu_publish_fallback(messages: list[dict[str, Any]]) -> str | None:
    """Short-circuit explicit Xiaohongshu publish requests before any LLM call."""
    text, image_count = _latest_user_content(messages)
    if not _is_xiaohongshu_publish_request(text):
        return None
    return text


def _direct_twitter_publish_fallback(messages: list[dict[str, Any]]) -> str | None:
    """Short-circuit explicit Twitter publish requests before any LLM call."""
    text, _ = _latest_user_content(messages)
    if not _is_twitter_publish_request(text):
        return None
    return text


def _extract_xiaohongshu_publish_payload(raw_text: str) -> tuple[str, str] | None:
    """Extract title/body from a free-form publish request."""
    text = str(raw_text or "").replace("\r\n", "\n")
    for marker in ("内容如下", "如下"):
        idx = text.find(marker)
        if idx >= 0:
            text = text[idx + len(marker):]
            break
    lines: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        line = line.lstrip("：:，,。 ")
        if not line:
            continue
        if line.startswith(("Current Time:", "Channel:", "Chat ID:")):
            continue
        if _is_xiaohongshu_publish_request(line):
            continue
        if "自动生成小红书图片" in line or "chrome 渲染" in line.lower():
            continue
        if line.startswith(("已收到，正在分析", "当前请求已识别为", "_Capability & Data_:", "Error:")):
            break
        lines.append(line)
    if not lines:
        return None
    title = lines[0][:100].strip()
    body_lines = lines[1:] or lines[:1]
    body = "\n".join(body_lines).strip()
    if not title or not body:
        return None
    return title, body


def _extract_twitter_publish_text(raw_text: str) -> str | None:
    """Extract tweet body from a free-form publish request."""
    text = str(raw_text or "").replace("\r\n", "\n")
    for marker in ("内容如下", "如下"):
        idx = text.find(marker)
        if idx >= 0:
            text = text[idx + len(marker):]
            break
    lines: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        line = line.lstrip("：:，,。 ")
        if not line:
            continue
        if line.startswith(("Current Time:", "Channel:", "Chat ID:")):
            continue
        if _is_twitter_publish_request(line):
            continue
        if line.startswith(("已收到，正在分析", "当前请求已识别为", "_Capability & Data_:", "Error:")):
            break
        lines.append(line)
    content = "\n".join(lines).strip()
    return content or None


def _shorten_twitter_text(text: str, limit: int = 260) -> str:
    """Compress tweet text deterministically for a one-shot retry."""
    normalized_lines = [line.strip(" -•\t") for line in str(text or "").splitlines() if line.strip()]
    if not normalized_lines:
        return ""
    title = normalized_lines[0]
    bullets = normalized_lines[1:]
    compact = title
    if bullets:
        compact += "\n" + "｜".join(bullets)
    compact = re.sub(r"\s+", " ", compact).strip()
    if len(compact) <= limit:
        return compact
    prioritized = [title]
    for bullet in bullets:
        candidate = "｜".join(prioritized + [bullet])
        if len(candidate) > limit - 1:
            break
        prioritized.append(bullet)
    compact = "｜".join(prioritized).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def _format_xiaohongshu_publish_result(result: str) -> str:
    """Return a compact user-facing publish confirmation."""
    text = str(result or "").strip()
    if not text:
        return "小红书已发送。"
    try:
        payload = json.loads(text)
    except Exception:
        return text
    if not isinstance(payload, dict):
        return text
    if payload.get("ok") is True:
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        note_id = str(data.get("id") or "").strip()
        score = data.get("score")
        message = "小红书已发送成功。"
        if note_id:
            message += f"\nID: `{note_id}`"
        if isinstance(score, (int, float)):
            message += f"\n质量分: {score}"
        return message
    error = payload.get("error")
    if isinstance(error, dict):
        detail = str(error.get("message") or error.get("type") or "").strip()
        if detail:
            return f"小红书发送失败：{detail}"
    return text


def _format_twitter_publish_result(result: str) -> str:
    """Return a compact user-facing Twitter publish confirmation."""
    text = str(result or "").strip()
    if not text:
        return "推特已发送。"
    try:
        payload = json.loads(text)
    except Exception:
        return text
    if not isinstance(payload, dict):
        return text
    if payload.get("ok") is True:
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        tweet_id = str(data.get("id") or data.get("tweet_id") or data.get("rest_id") or "").strip()
        url = str(data.get("url") or "").strip()
        message = "推特已发送成功。"
        if tweet_id:
            message += f"\nID: `{tweet_id}`"
        if url:
            message += f"\n链接: {url}"
        return message
    error = payload.get("error")
    if isinstance(error, dict):
        detail = str(error.get("message") or error.get("type") or "").strip()
        if detail:
            return f"推特发送失败：{detail}"
    return text


def _build_xiaohongshu_poster_html(title: str, body: str) -> str:
    """Render a compact centered Xiaohongshu poster as fixed-size HTML."""
    lines = [segment.strip() for segment in body.splitlines() if segment.strip()]
    body_html = "".join(f"<p>{escape(line)}</p>" for line in lines)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1080, initial-scale=1" />
  <style>
    :root {{
      --bg: linear-gradient(160deg, #f6efe4 0%, #efe2cf 45%, #e8d7be 100%);
      --ink: #1f1308;
      --muted: #6f5842;
      --card: rgba(255, 252, 246, 0.78);
      --line: rgba(92, 62, 34, 0.10);
    }}
    * {{ box-sizing: border-box; }}
    html, body {{
      width: 1080px;
      height: 1800px;
      margin: 0;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink);
      font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
    }}
    body {{
      position: relative;
    }}
    .grain {{
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.55), transparent 28%),
        radial-gradient(circle at 80% 12%, rgba(255,255,255,0.35), transparent 24%),
        radial-gradient(circle at 50% 100%, rgba(140,105,72,0.12), transparent 35%);
    }}
    .frame {{
      position: absolute;
      inset: 56px;
      border: 1px solid var(--line);
      border-radius: 48px;
      padding: 86px 72px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: var(--card);
      backdrop-filter: blur(4px);
      box-shadow: 0 24px 80px rgba(72, 45, 19, 0.08);
    }}
    .eyebrow {{
      font-size: 28px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 30px;
    }}
    h1 {{
      margin: 0;
      font-size: 80px;
      line-height: 1.08;
      letter-spacing: -0.04em;
      max-width: 820px;
    }}
    .divider {{
      width: 128px;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, #8f6742, #c38b57);
      margin: 42px 0 46px;
    }}
    .body {{
      width: 100%;
      max-width: 840px;
    }}
    .body p {{
      margin: 0 0 18px;
      font-size: 39px;
      line-height: 1.28;
      font-weight: 600;
      letter-spacing: -0.02em;
    }}
    .body p:last-child {{
      margin-bottom: 0;
    }}
    .footer {{
      margin-top: 56px;
      font-size: 24px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
    }}
  </style>
</head>
<body>
  <div class="grain"></div>
  <main class="frame">
    <div class="eyebrow">MarketBot</div>
    <h1>{escape(title)}</h1>
    <div class="divider"></div>
    <section class="body">{body_html}</section>
    <div class="footer">Xiaohongshu Auto Poster</div>
  </main>
</body>
</html>
"""


async def _render_xiaohongshu_poster(workspace: Path, title: str, body: str) -> tuple[Path, Path]:
    """Render the poster HTML to a 1080x1800 PNG through headless Chrome."""
    candidates = (
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
    )
    chrome = next((path for path in candidates if path.exists()), None)
    if chrome is None:
        raise RuntimeError("Chrome not found at /Applications/Google Chrome.app")

    output_dir = workspace / "generated" / "xiaohongshu"
    output_dir.mkdir(parents=True, exist_ok=True)
    slug = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid4().hex[:8]
    html_path = output_dir / f"{slug}.html"
    png_path = output_dir / f"{slug}.png"
    html_path.write_text(_build_xiaohongshu_poster_html(title, body), encoding="utf-8")

    process = await asyncio.create_subprocess_exec(
        str(chrome),
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1080,1800",
        f"--screenshot={png_path}",
        html_path.resolve().as_uri(),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=20)
    if process.returncode != 0 or not png_path.is_file():
        details = (stderr or stdout).decode("utf-8", errors="replace").strip()
        raise RuntimeError(details or "Chrome screenshot failed")
    return html_path, png_path


async def _direct_xiaohongshu_publish(loop: Any, messages: list[dict[str, Any]]) -> str | None:
    """Execute explicit Xiaohongshu publishing without going through LLM routing."""
    raw_text = _direct_xiaohongshu_publish_fallback(messages)
    if raw_text is None:
        return None
    if not loop.tools.has("xiaohongshu_cli"):
        return "Error: xiaohongshu_cli tool is not available."
    payload = _extract_xiaohongshu_publish_payload(raw_text)
    if payload is None:
        return "Error: 未能解析小红书标题和正文，请在“内容如下”后提供标题和正文。"
    title, body = payload
    try:
        _, image_path = await _render_xiaohongshu_poster(Path(loop.workspace), title, body)
    except Exception as exc:
        return f"Error: 自动生成小红书图片失败: {exc}"
    result = await loop.tools.execute(
        "xiaohongshu_cli",
        {
            "operation": "post",
            "title": title,
            "body": body,
            "images": [str(image_path)],
        },
    )
    return _format_xiaohongshu_publish_result(result)


async def _direct_twitter_publish(loop: Any, messages: list[dict[str, Any]]) -> str | None:
    """Execute explicit Twitter publishing without going through LLM routing."""
    raw_text = _direct_twitter_publish_fallback(messages)
    if raw_text is None:
        return None
    if not loop.tools.has("twitter_cli"):
        return "Error: twitter_cli tool is not available."
    content = _extract_twitter_publish_text(raw_text)
    if not content:
        return "Error: 未能解析推文正文，请在“内容如下”后提供正文。"
    result = await loop.tools.execute(
        "twitter_cli",
        {
            "operation": "post",
            "text": content,
        },
    )
    lowered = str(result or "").lower()
    if "(186)" in lowered or "bit shorter" in lowered:
        shortened = _shorten_twitter_text(content)
        if shortened and shortened != content:
            result = await loop.tools.execute(
                "twitter_cli",
                {
                    "operation": "post",
                    "text": shortened,
                },
            )
    return _format_twitter_publish_result(result)


def _summarize_tool_payload(tool_name: str, result: str) -> str | None:
    try:
        payload = json.loads(result)
    except Exception:
        text = result.strip()
        return text[:800] if text else None

    if not isinstance(payload, dict):
        text = json.dumps(payload, ensure_ascii=False)
        return text[:800]

    if payload.get("ok") is False:
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message") or error.get("type")
            if message:
                return f"{tool_name}: {message}"
        return json.dumps(payload, ensure_ascii=False)[:800]

    data = payload.get("data")
    if not isinstance(data, dict):
        return json.dumps(payload, ensure_ascii=False)[:800]

    list_key = next((key for key in ("results", "items", "messages", "chats", "rows") if isinstance(data.get(key), list)), None)
    if list_key:
        items = data.get(list_key) or []
        lines = [f"Latest {tool_name} result:"]
        if isinstance(data.get("total"), int):
            lines[0] += f" total={data['total']}"
        for index, item in enumerate(items[:3], start=1):
            if isinstance(item, dict):
                label = (
                    item.get("title")
                    or item.get("name")
                    or item.get("tableName")
                    or item.get("summary")
                    or item.get("fieldName")
                    or item.get("taskId")
                    or item.get("recordId")
                    or item.get("chatName")
                    or item.get("messageId")
                )
                detail = (
                    item.get("url")
                    or item.get("content")
                    or item.get("type")
                    or _fallback_preview(item.get("fields"))
                )
                segment = f"{index}. {_fallback_preview(label) or _fallback_preview(item)}"
                if detail and detail != label:
                    segment += f" | { _fallback_preview(detail) }"
                lines.append(segment)
            else:
                lines.append(f"{index}. {_fallback_preview(item)}")
        return "\n".join(lines)

    if isinstance(data.get("record"), dict):
        record = data["record"]
        return (
            f"Latest {tool_name} record: "
            f"{_fallback_preview(record.get('recordId') or record.get('record_id'))} | "
            f"{_fallback_preview(record.get('fields'))}"
        )

    if isinstance(data.get("range"), str) and isinstance(data.get("rows"), list):
        rows = data.get("rows") or []
        return (
            f"Latest {tool_name} range {data['range']}: "
            f"{len(rows)} row(s), {data.get('columnCount', 0)} column(s). "
            f"First row: {_fallback_preview(rows[0]) if rows else ''}"
        ).strip()

    return json.dumps(payload, ensure_ascii=False)[:800]


def build_provider_error_fallback(messages: list[dict[str, Any]], tools_used: list[str], provider_error: str) -> str | None:
    """Build a user-facing fallback when the provider fails after successful tool calls."""
    if not tools_used:
        return None

    trailing_tool_messages: list[dict[str, Any]] = []
    for message in reversed(messages):
        if message.get("role") != "tool":
            if trailing_tool_messages:
                break
            continue
        trailing_tool_messages.append(message)
    if not trailing_tool_messages:
        return None

    trailing_tool_messages.reverse()
    summaries: list[str] = []
    for message in trailing_tool_messages[-3:]:
        tool_name = str(message.get("name", "tool"))
        content = str(message.get("content", "") or "")
        summary = _summarize_tool_payload(tool_name, content)
        if summary:
            summaries.append(summary)

    if not summaries:
        return None

    error_line = provider_error.strip().splitlines()[0][:180]
    return (
        "The AI provider failed while composing the final answer, but the latest tool call succeeded.\n\n"
        + "\n\n".join(summaries)
        + f"\n\nProvider error: {error_line}"
    )


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
    direct_publish = await _direct_xiaohongshu_publish(loop, initial_messages)
    if direct_publish is not None:
        return direct_publish, ["xiaohongshu_cli"], initial_messages, {}
    direct_twitter_publish = await _direct_twitter_publish(loop, initial_messages)
    if direct_twitter_publish is not None:
        return direct_twitter_publish, ["twitter_cli"], initial_messages, {}

    messages = initial_messages
    iteration = 0
    tool_rounds = 0
    final_content = None
    tools_used: list[str] = []
    usage_totals: dict[str, int] = {}
    loop._active_request_flags = {
        "broad_market_scan": loop._is_broad_market_scan_request(initial_messages),
        "daily_opportunity_scan": loop._DAILY_OPPORTUNITY_SKILL in loop._selected_skill_names(),
        "xiaohongshu_request": loop._is_xiaohongshu_request(initial_messages),
        "xiaohongshu_research": "xiaohongshu-browser-research" in loop._selected_skill_names(),
        "twitter_request": loop._is_twitter_request(initial_messages),
        "twitter_research": "twitter-browser-research" in loop._selected_skill_names(),
        "lark_request": loop._is_lark_request(initial_messages),
    }
    pseudo_tool_retry_used = False
    loop._twitter_news_fallback_done = False
    try:
        while iteration < loop.max_iterations:
            iteration += 1
            loop._current_tool_rounds = tool_rounds
            tools_for_call = loop._tool_definitions_for_request()
            if loop._active_request_flags.get("broad_market_scan") and tool_rounds >= 1:
                tools_for_call = []
            if pseudo_tool_retry_used:
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
                    fallback = await _maybe_run_twitter_news_fallback(
                        loop,
                        tool_call,
                        result,
                        messages,
                        tools_used,
                        tool_rounds,
                    )
                    if fallback:
                        messages, tools_used, tool_rounds = fallback
                tool_rounds += 1
                messages, tools_used, tool_rounds = await loop._auto_append_daily_opportunity_market_brief(
                    messages,
                    tools_used,
                    tool_rounds=tool_rounds,
                )
            else:
                clean = loop._strip_think(response.content)
                if (
                    _looks_like_pseudo_tool_output(clean)
                    and not response.has_tool_calls
                    and tools_used
                    and not pseudo_tool_retry_used
                    and iteration < loop.max_iterations
                ):
                    logger.warning("Model returned pseudo tool-call text after tool rounds; forcing no-tool summary retry")
                    messages = loop.context.add_assistant_message(
                        messages,
                        None,
                        reasoning_content=response.reasoning_content,
                        thinking_blocks=response.thinking_blocks,
                    )
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "Do not call tools again. Using only the tool results already in this conversation, "
                                "answer the user directly in plain text or markdown. "
                                "Do not output <minimax:tool_call>, <invoke ...>, XML, JSON tool stubs, "
                                "or any tool-call syntax."
                            ),
                        }
                    )
                    pseudo_tool_retry_used = True
                    continue
                # Don't persist error responses to session history — they can
                # poison the context and cause permanent 400 loops (#1303).
                if response.finish_reason == "error":
                    logger.error("LLM returned error: {}", (clean or "")[:200])
                    fallback = build_provider_error_fallback(messages, tools_used, clean or "")
                    final_content = fallback or clean or "Sorry, I encountered an error calling the AI model."
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
        loop._current_tool_rounds = 0
        loop._active_request_flags = {}
        loop._twitter_news_fallback_done = False

    if final_content is None and iteration >= loop.max_iterations:
        logger.warning("Max iterations ({}) reached", loop.max_iterations)
        final_content = (
            f"I reached the maximum number of tool call iterations ({loop.max_iterations}) "
            "without completing the task. You can try breaking the task into smaller steps."
        )

    return final_content, tools_used, messages, usage_totals


def _looks_like_pseudo_tool_output(content: str | None) -> bool:
    """Return True when the model emitted textual tool-call markup instead of a final answer."""
    normalized = str(content or "").strip().lower()
    if not normalized:
        return False
    return any(
        marker in normalized
        for marker in (
            "<minimax:tool_call>",
            "</minimax:tool_call>",
            "<invoke name=",
            "minimax:tool_call",
        )
    )


async def _maybe_run_twitter_news_fallback(
    loop: Any,
    tool_call: ToolCallRequest,
    result: str,
    messages: list[dict[str, Any]],
    tools_used: list[str],
    tool_rounds: int,
) -> tuple[list[dict[str, Any]], list[str], int] | None:
    if not loop._active_request_flags.get("twitter_research"):
        return None
    if tool_call.name != "twitter_cli":
        return None
    if getattr(loop, "_twitter_news_fallback_done", False):
        return None
    if not _twitter_result_empty(result):
        return None

    query = tool_call.arguments.get("query") if isinstance(tool_call.arguments, dict) else None
    symbol = _extract_ticker_from_query(query)
    if not symbol:
        return None

    definitions = loop.tools.get_definitions()
    if not any(
        isinstance(definition.get("function"), dict)
        and str(definition["function"].get("name") or "").strip() == "market_news"
        for definition in definitions
    ):
        return None

    arguments = {"symbols": [symbol], "limit": 5}
    news_call = ToolCallRequest(
        id=f"twitter-news-{symbol}-{int(time.time() * 1000)}",
        name="market_news",
        arguments=arguments,
    )

    messages = loop.context.add_assistant_message(
        messages,
        "",
        [
            {
                "id": news_call.id,
                "type": "function",
                "function": {
                    "name": news_call.name,
                    "arguments": json.dumps(news_call.arguments, ensure_ascii=False),
                },
            }
        ],
    )

    fallback_result = await loop.tools.execute(news_call.name, news_call.arguments)
    compressed = loop._compress_tool_result(news_call.name, fallback_result)
    tools_used.append(news_call.name)
    messages = loop.context.add_tool_result(
        messages,
        news_call.id,
        news_call.name,
        compressed,
    )
    loop._twitter_news_fallback_done = True
    return messages, tools_used, tool_rounds + 1


def _twitter_result_empty(result: str) -> bool:
    stripped = str(result or "").strip()
    if not stripped:
        return True
    try:
        payload = json.loads(stripped)
    except Exception:
        return True
    if payload.get("ok") is False:
        return True
    data = payload.get("data")
    if isinstance(data, dict):
        if "results" in data:
            return not bool(data.get("results"))
        return not bool(data)
    if isinstance(data, list):
        return not bool(data)
    return False


def _extract_ticker_from_query(query: Any) -> str | None:
    text = " ".join(str(query or "").split()).strip()
    if not text:
        return None
    match = re.search(r"\$?([A-Z]{1,5})\b", text)
    if not match:
        return None
    ticker = match.group(0).lstrip("$")
    if ticker in {"A", "I", "X", "US", "USA", "AI"}:
        return None
    return ticker

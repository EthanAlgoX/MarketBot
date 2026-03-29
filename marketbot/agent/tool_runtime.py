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
        "发送小红书",
        "发送一条小红书",
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
        "发送推特",
        "发送一条推特",
        "发送推文",
        "发送一条推文",
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


def _is_xiaohongshu_research_request(text: str) -> bool:
    lowered = str(text or "").lower()
    platform_markers = ("xiaohongshu", "小红书", "rednote")
    intent_markers = ("搜索", "热门", "帖子", "风格", "内容", "search", "hot", "style", "content")
    return any(marker in lowered for marker in platform_markers) and any(marker in lowered for marker in intent_markers)


def _direct_xiaohongshu_research_fallback(messages: list[dict[str, Any]]) -> str | None:
    """Short-circuit explicit Xiaohongshu research requests before any LLM call."""
    text, _ = _latest_user_content(messages)
    if _is_xiaohongshu_publish_request(text):
        return None
    if _is_twitter_publish_request(text):
        return None
    if not _is_xiaohongshu_research_request(text):
        return None
    return text


def _should_disable_twitter_auto_image(text: str) -> bool:
    """Return True when the publish request explicitly asks for a text-only tweet."""
    lowered = str(text or "").lower()
    markers = (
        "纯文本",
        "纯文字",
        "不要图",
        "不带图",
        "无需配图",
        "不要配图",
        "仅发文字",
        "text only",
        "text-only",
        "without image",
        "no image",
        "no poster",
    )
    return any(marker in lowered for marker in markers)


def _should_auto_generate_twitter_image(text: str) -> bool:
    """Return True when the publish request should include an auto-generated Twitter image."""
    lowered = str(text or "").lower()
    if _should_disable_twitter_auto_image(lowered):
        return False
    markers = (
        "自动生图",
        "自动配图",
        "自动生成图片",
        "自动生成推特图片",
        "自动生成推文图片",
        "带图发",
        "配图发",
        "生成海报",
        "生成卡片",
        "auto image",
        "auto poster",
        "auto card",
        "with image",
        "with poster",
    )
    if any(marker in lowered for marker in markers):
        return True
    visual_terms = ("图片", "配图", "带图", "海报", "卡片", "image", "poster", "card", "visual")
    intent_terms = ("自动", "生成", "附", "配", "带", "auto", "generate", "attach", "include", "with")
    if any(term in lowered for term in visual_terms) and any(term in lowered for term in intent_terms):
        return True
    return _is_twitter_publish_request(lowered)


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
        if _should_auto_generate_twitter_image(line):
            continue
        if line.startswith(("已收到，正在分析", "当前请求已识别为", "_Capability & Data_:", "Error:")):
            break
        lines.append(line)
    return _normalize_twitter_publish_text(lines)


def _extract_xiaohongshu_research_keyword(raw_text: str) -> str:
    """Choose a deterministic Xiaohongshu search keyword from the request."""
    text = str(raw_text or "")
    keyword_map = (
        ("金融", "金融"),
        ("财经", "财经"),
        ("理财", "理财"),
        ("股票", "股票"),
        ("基金", "基金"),
        ("港股", "港股"),
        ("a股", "A股"),
        ("美股", "美股"),
        ("交易", "交易"),
    )
    lowered = text.lower()
    for marker, keyword in keyword_map:
        if marker.lower() in lowered:
            return keyword
    return "金融"


def _normalize_twitter_publish_text(lines: list[str]) -> str | None:
    """Normalize tweet copy into a readable title-plus-bullets layout."""
    normalized_lines = [str(line).strip(" \t") for line in lines if str(line).strip()]
    if not normalized_lines:
        return None
    title = normalized_lines[0].strip()
    bullets = [_normalize_twitter_bullet(line) for line in normalized_lines[1:]]
    bullets = [line for line in bullets if line]
    if not bullets:
        return title or None
    return "\n".join([title, "", *bullets]).strip()


def _normalize_twitter_bullet(line: str) -> str:
    """Normalize a single tweet bullet while preserving its meaning."""
    text = str(line or "").strip()
    if not text:
        return ""
    if text.startswith(("•", "-", "*")):
        text = text[1:].strip()
    text = re.sub(r"\s+", " ", text)
    return f"• {text}"


def _twitter_weighted_length(text: str) -> int:
    """Approximate Twitter weighted length conservatively for mixed CJK text."""
    total = 0
    for char in str(text or ""):
        if char == "\n":
            total += 1
        elif ord(char) < 128:
            total += 1
        else:
            total += 2
    return total


def _truncate_twitter_text(text: str, limit: int) -> str:
    """Truncate text by conservative Twitter-weighted length."""
    if not text:
        return ""
    ellipsis = "…"
    budget = max(1, limit - _twitter_weighted_length(ellipsis))
    result: list[str] = []
    used = 0
    for char in str(text):
        weight = 1 if char == "\n" or ord(char) < 128 else 2
        if used + weight > budget:
            break
        result.append(char)
        used += weight
    compact = "".join(result).rstrip(" ｜|,-、，。")
    return compact + ellipsis if compact else ellipsis


def _append_twitter_segment(base: str, segment: str) -> str:
    """Append a segment preserving multiline tweet layout."""
    if not base:
        return segment
    separator = "\n\n" if "\n" not in base else "\n"
    return f"{base}{separator}{segment}"


def _shorten_twitter_text(text: str, limit: int = 240) -> str:
    """Compress tweet text deterministically while preserving readable layout."""
    normalized_lines = [line.strip(" -•\t") for line in str(text or "").splitlines() if line.strip()]
    if not normalized_lines:
        return ""
    title = normalized_lines[0]
    bullets = normalized_lines[1:]
    compact = "\n".join([title, *[f"• {bullet}" for bullet in bullets]]).strip()
    if _twitter_weighted_length(compact) <= limit:
        return compact
    compact = title.strip()
    included_bullets = 0
    for bullet in bullets:
        bullet_line = f"• {bullet}".strip()
        candidate = _append_twitter_segment(compact, bullet_line)
        if _twitter_weighted_length(candidate) > limit:
            if included_bullets == 0:
                return _append_twitter_segment(compact, _truncate_twitter_text(bullet_line, max(40, limit - _twitter_weighted_length(compact) - 2)))
            break
        compact = candidate
        included_bullets += 1
    if compact and _twitter_weighted_length(compact) <= limit:
        return compact
    if title and _twitter_weighted_length(title) > limit:
        return _truncate_twitter_text(title, limit)
    if title and bullets:
        first_focus = _append_twitter_segment(title, f"• {bullets[0]}")
        if _twitter_weighted_length(first_focus) <= limit:
            return first_focus
        return _truncate_twitter_text(first_focus, limit)
    return _truncate_twitter_text(compact, limit)


def _twitter_retry_candidates(text: str) -> list[str]:
    """Build progressively shorter retry bodies for Twitter length errors."""
    normalized_lines = [line.strip(" -•\t") for line in str(text or "").splitlines() if line.strip()]
    if not normalized_lines:
        return []
    title = normalized_lines[0]
    bullets = normalized_lines[1:]
    candidates: list[str] = []
    for candidate in (
        _shorten_twitter_text(text, limit=240),
        _shorten_twitter_text(text, limit=210),
        _shorten_twitter_text(title if not bullets else "\n".join([title, bullets[0]]), limit=180),
        _truncate_twitter_text(title, 120),
    ):
        normalized = candidate.strip()
        if normalized and normalized != text and normalized not in candidates:
            candidates.append(normalized)
    return candidates


def _twitter_duplicate_retry_candidates(text: str) -> list[str]:
    """Build minimal variants for Twitter duplicate-content rejections."""
    base = str(text or "").strip()
    if not base:
        return []
    candidates: list[str] = []
    variants = (
        f"{base}\n\n#MarketBot",
        f"{base}\n\nvia MarketBot",
        f"{base}\n\n更新版",
    )
    for candidate in variants:
        normalized = candidate.strip()
        if (
            normalized
            and normalized != base
            and normalized not in candidates
            and _twitter_weighted_length(normalized) <= 280
        ):
            candidates.append(normalized)
    return candidates


def _prepare_twitter_post_text(text: str, *, with_image: bool) -> str:
    """Prepare final tweet text for publish mode."""
    normalized = str(text or "").strip()
    if not normalized:
        return ""
    if not with_image:
        return normalized
    return _shorten_twitter_text(normalized, limit=180)


def _extract_twitter_publish_id(result: str) -> str | None:
    """Extract tweet id from a twitter publish result payload."""
    try:
        payload = json.loads(str(result or "").strip())
    except Exception:
        return None
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        return None
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    tweet_id = str(data.get("id") or data.get("tweet_id") or data.get("rest_id") or "").strip()
    return tweet_id or None


def _tweet_payload_has_media(result: str) -> bool:
    """Return True when a fetched tweet payload includes media entries."""
    try:
        payload = json.loads(str(result or "").strip())
    except Exception:
        return False
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        return False
    data = payload.get("data")
    if isinstance(data, dict):
        media = data.get("media")
        return isinstance(media, list) and bool(media)
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            media = first.get("media")
            return isinstance(media, list) and bool(media)
    return False


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


def _summarize_xiaohongshu_titles(notes: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    """Infer style and content themes from note titles."""
    titles = [str((note or {}).get("title") or "").strip() for note in notes if str((note or {}).get("title") or "").strip()]
    joined = "\n".join(titles)
    style: list[str] = []
    content: list[str] = []

    if any(token in joined for token in ("复盘", "总结", "周记", "月报")):
        style.append("复盘总结型")
    if any(token in joined for token in ("教程", "方法", "步骤", "入门", "建议")):
        style.append("方法教程型")
    if any(token in joined for token in ("避坑", "不要", "提醒", "风险")):
        style.append("避坑提醒型")
    if any(token in joined for token in ("清单", "盘点", "合集", "模板")):
        style.append("清单模板型")
    if any(char in joined for char in ("？", "!", "！")) or any(token in joined for token in ("为什么", "如何", "到底")):
        style.append("问题钩子标题")
    if any(any(ch.isdigit() for ch in title) for title in titles):
        style.append("数字结果导向")
    if not style:
        style.append("经验分享型")

    if any(token in joined for token in ("副业", "赚钱", "变现", "收入")):
        content.append("个人赚钱路径与副业变现")
    if any(token in joined for token in ("理财", "存钱", "基金", "资产配置")):
        content.append("个人理财与资产配置")
    if any(token in joined for token in ("股票", "A股", "港股", "美股", "交易")):
        content.append("股票市场观察与交易经验")
    if any(token in joined for token in ("风险", "回撤", "仓位", "止损")):
        content.append("风险控制与仓位管理")
    if any(token in joined for token in ("心态", "认知", "情绪", "复盘")):
        content.append("交易心态与认知复盘")
    if not content:
        content.append("金融入门、理财经验和市场热点解读")

    return style[:4], content[:4]


def _format_xiaohongshu_research_result(keyword: str, result: str) -> str:
    """Turn compact xiaohongshu_cli search JSON into a concise user-facing analysis."""
    text = str(result or "").strip()
    try:
        payload = json.loads(text)
    except Exception:
        return text
    if not isinstance(payload, dict):
        return text
    if payload.get("ok") is not True:
        error = payload.get("error")
        if isinstance(error, dict):
            detail = str(error.get("message") or error.get("type") or "").strip()
            if detail:
                return f"小红书搜索失败：{detail}"
        return text
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    notes = data.get("notes") if isinstance(data.get("notes"), list) else []
    titles = [str((note or {}).get("title") or "").strip() for note in notes if str((note or {}).get("title") or "").strip()]
    style, content = _summarize_xiaohongshu_titles(notes)
    engagement = data.get("engagement") if isinstance(data.get("engagement"), dict) else {}
    lines = [f"小红书热门“{keyword}”相关帖子，当前更像这几种风格："]
    lines.extend(f"- {item}" for item in style)
    lines.append("")
    lines.append("内容方向主要集中在：")
    lines.extend(f"- {item}" for item in content)
    if titles:
        lines.append("")
        lines.append("样本标题：")
        lines.extend(f"- {title}" for title in titles[:4])
    sample_size = engagement.get("sample_size")
    avg_likes = engagement.get("avg_likes")
    if sample_size:
        lines.append("")
        lines.append(f"样本量: {sample_size}")
        if isinstance(avg_likes, (int, float)):
            lines.append(f"平均点赞: {avg_likes}")
    lines.append("")
    lines.append("判断依据：以上结论基于热门标题样本的归纳，不是全文内容分析。")
    return "\n".join(lines)


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


def _resolve_local_chrome() -> Path:
    """Return a local Chrome/Chromium binary suitable for headless screenshot rendering."""
    candidates = (
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
    )
    chrome = next((path for path in candidates if path.exists()), None)
    if chrome is None:
        raise RuntimeError("Chrome not found at /Applications/Google Chrome.app")
    return chrome


async def _render_html_to_png(
    *,
    workspace: Path,
    scope: str,
    html: str,
    width: int,
    height: int,
) -> tuple[Path, Path]:
    """Render HTML to PNG through local headless Chrome."""
    chrome = _resolve_local_chrome()
    output_dir = workspace / "generated" / scope
    output_dir.mkdir(parents=True, exist_ok=True)
    slug = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid4().hex[:8]
    html_path = output_dir / f"{slug}.html"
    png_path = output_dir / f"{slug}.png"
    html_path.write_text(html, encoding="utf-8")

    process = await asyncio.create_subprocess_exec(
        str(chrome),
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
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


async def _render_xiaohongshu_poster(workspace: Path, title: str, body: str) -> tuple[Path, Path]:
    """Render the poster HTML to a 1080x1800 PNG through headless Chrome."""
    return await _render_html_to_png(
        workspace=workspace,
        scope="xiaohongshu",
        html=_build_xiaohongshu_poster_html(title, body),
        width=1080,
        height=1800,
    )


def _resolve_publish_workspace(loop: Any) -> Path:
    """Resolve a writable workspace for generated publisher assets."""
    value = getattr(loop, "workspace", None)
    return Path(value) if value else Path("/tmp")


def _build_twitter_poster_html(title: str, body: str) -> str:
    """Render a concise Twitter/X card style poster."""
    lines = [segment.strip("• ").strip() for segment in body.splitlines() if segment.strip()]
    bullet_html = "".join(f"<li>{escape(line)}</li>" for line in lines[:5])
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1600, initial-scale=1" />
  <style>
    :root {{
      --bg0: #0b1220;
      --bg1: #14213d;
      --ink: #f3f6fb;
      --muted: #9fb2c8;
      --line: rgba(255,255,255,0.08);
      --accent: #4fd1c5;
      --accent2: #60a5fa;
      --card: rgba(10, 17, 30, 0.66);
    }}
    * {{ box-sizing: border-box; }}
    html, body {{
      width: 1600px;
      height: 900px;
      margin: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(96,165,250,0.22), transparent 30%),
        radial-gradient(circle at bottom right, rgba(79,209,197,0.18), transparent 28%),
        linear-gradient(145deg, var(--bg0) 0%, var(--bg1) 100%);
      color: var(--ink);
      font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    }}
    body {{ padding: 54px; }}
    .card {{
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 36px;
      border: 1px solid var(--line);
      background: var(--card);
      box-shadow: 0 32px 80px rgba(0,0,0,0.28);
      padding: 48px 56px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }}
    .top {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
    }}
    .brand {{
      font-size: 24px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
    }}
    .badge {{
      font-size: 22px;
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(79,209,197,0.12);
      color: #a8fff7;
      border: 1px solid rgba(79,209,197,0.28);
    }}
    h1 {{
      margin: 0;
      max-width: 1180px;
      font-size: 72px;
      line-height: 1.05;
      letter-spacing: -0.045em;
    }}
    ul {{
      margin: 30px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px 28px;
    }}
    li {{
      font-size: 31px;
      line-height: 1.24;
      color: var(--ink);
      padding: 20px 22px;
      border-radius: 22px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
    }}
    .footer {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: 24px;
      letter-spacing: 0.02em;
    }}
    .line {{
      width: 220px;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
    }}
  </style>
</head>
<body>
  <main class="card">
    <section>
      <div class="top">
        <div class="brand">MarketBot</div>
        <div class="badge">X Post Visual</div>
      </div>
      <h1>{escape(title)}</h1>
      <ul>{bullet_html}</ul>
    </section>
    <footer class="footer">
      <div class="line"></div>
      <div>twitter-cli auto image</div>
    </footer>
  </main>
</body>
</html>
"""


def _extract_twitter_poster_payload(text: str) -> tuple[str, str]:
    """Split normalized tweet text into poster title/body."""
    normalized_lines = [line.strip() for line in str(text or "").splitlines() if line.strip()]
    title = normalized_lines[0] if normalized_lines else "MarketBot"
    bullets = [line for line in normalized_lines[1:] if line]
    body = "\n".join(bullets[:5]) or title
    return title, body


async def _render_twitter_poster(workspace: Path, text: str) -> tuple[Path, Path]:
    """Render a Twitter/X share image from normalized tweet text."""
    title, body = _extract_twitter_poster_payload(text)
    return await _render_html_to_png(
        workspace=workspace,
        scope="twitter",
        html=_build_twitter_poster_html(title, body),
        width=1600,
        height=900,
    )


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
        _, image_path = await _render_xiaohongshu_poster(_resolve_publish_workspace(loop), title, body)
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
    images: list[str] = []
    if _should_auto_generate_twitter_image(raw_text):
        try:
            _, image_path = await _render_twitter_poster(_resolve_publish_workspace(loop), content)
        except Exception:
            image_path = None
        if image_path is not None:
            images.append(str(image_path))
    post_text = _prepare_twitter_post_text(content, with_image=bool(images))
    result = await loop.tools.execute(
        "twitter_cli",
        {
            "operation": "post",
            "text": post_text,
            "images": images,
        },
    )
    lowered = str(result or "").lower()
    if "(186)" in lowered or "bit shorter" in lowered:
        for shortened in _twitter_retry_candidates(post_text):
            result = await loop.tools.execute(
                "twitter_cli",
                {
                    "operation": "post",
                    "text": shortened,
                    "images": images,
                },
            )
            lowered = str(result or "").lower()
            if "(186)" not in lowered and "bit shorter" not in lowered:
                break
    lowered = str(result or "").lower()
    if "(187)" in lowered or "duplicate" in lowered:
        for variant in _twitter_duplicate_retry_candidates(post_text):
            result = await loop.tools.execute(
                "twitter_cli",
                {
                    "operation": "post",
                    "text": variant,
                    "images": images,
                },
            )
            lowered = str(result or "").lower()
            if "(187)" not in lowered and "duplicate" not in lowered:
                break
    formatted = _format_twitter_publish_result(result)
    tweet_id = _extract_twitter_publish_id(result)
    if images and tweet_id:
        try:
            verify = await loop.tools.execute(
                "twitter_cli",
                {
                    "operation": "tweet",
                    "target": tweet_id,
                    "full_text": True,
                    "max_count": 1,
                },
            )
        except Exception:
            verify = None
        if verify is not None and not _tweet_payload_has_media(verify):
            return f"{formatted}\n注意：发推成功，但未校验到配图已挂载，请打开链接确认。"
    return formatted


async def _direct_xiaohongshu_research(loop: Any, messages: list[dict[str, Any]]) -> str | None:
    """Execute explicit Xiaohongshu research without going through LLM routing."""
    raw_text = _direct_xiaohongshu_research_fallback(messages)
    if raw_text is None:
        return None
    if not loop.tools.has("xiaohongshu_cli"):
        return "Error: xiaohongshu_cli tool is not available."
    keyword = _extract_xiaohongshu_research_keyword(raw_text)
    result = await loop.tools.execute(
        "xiaohongshu_cli",
        {
            "operation": "search",
            "keyword": keyword,
            "sort": "popular",
            "note_type": "image",
            "page": 1,
        },
    )
    return _format_xiaohongshu_research_result(keyword, result)


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
    direct_xhs_research = await _direct_xiaohongshu_research(loop, initial_messages)
    if direct_xhs_research is not None:
        return direct_xhs_research, ["xiaohongshu_cli"], initial_messages, {}
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

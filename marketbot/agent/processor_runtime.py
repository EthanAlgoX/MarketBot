"""Helper logic extracted from MessageProcessor."""

from __future__ import annotations

import asyncio
from typing import Any

from loguru import logger

from marketbot.bus.events import OutboundMessage


def rewrite_sensitive_market_shortcuts(message: str) -> str:
    """Expand terse market-analysis shortcuts that some upstream backends misclassify."""
    normalized = str(message or "").strip()
    daily_market_scan_prompt = (
        "请做一份今日市场机会扫描。"
        "基于公开市场数据和当前工具返回的数据，分析美股、港股、A股和加密市场中值得关注的机会、主题、代表标的、催化剂与风险。"
        "优先使用 market_snapshot、market_news、market_macro、market_brief 这条固定 market tool 链路。"
        "工具调用阶段优先一次性完成 market_snapshot、market_news、market_macro，并尽量同时纳入 market_brief。"
        "不要把 <minimax:tool_call>、<invoke ...>、XML、函数调用标记或伪工具调用文本写进用户可见正文。"
        "如果工具不可用或当前轮次已经不能再调用工具，就直接输出最终 markdown 报告，不要在正文里请求继续调工具。"
        "不要优先使用 exec、web_fetch、web_search、browser_site、market_social_sentiment、market_fundamentals 或泛化网页抓取作为兜底。"
        "如果没有高置信机会，请明确写出今日无高置信机会，并给出观察名单。"
        "最终 markdown 尽量使用固定结构：# 📅 每日机会扫描、## 1. Market Regime、## 2. High-Conviction Setups、## 3. Watchlist、## 4. Invalidations、## 5. Data Gaps。"
        "如果实时报价覆盖很差或宏观字段大面积为空，不要输出 confidence=0.54、score=-0.08、止损位、仓位建议、轻仓跟进等伪精度内容。"
        "周末或休市且数据 degraded 时，Watchlist 最多保留 2 个有近期催化的标的，不要塞没有催化剂支持的代码。"
        "不要把超过 14 天的旧新闻当成主催化剂，不要写配置建议如 FRED API Key；统一概括为 macro data unavailable 或 live data unavailable。"
        "避免把少量资产快照直接上升为系统性结论；单点异常数据必须标记为 unverified outlier。"
        "如果当前是周末或主要市场休市时段，请按下一交易日观察名单输出，而不是给出盘中执行建议。"
        "完成首轮取数后直接输出最终答案，不要继续追加价格历史、额外验证或补充工具轮次。"
        "用户可见答案里不要出现 provider、后端、API 名称、HTTP 状态码或数据源厂商名。"
        "周末或休市时最多保留 3 个观察项，并优先使用固定篮子内已有标的；不要引入当前工具输出里没有出现过的新代码。"
    )
    rewrites = {
        "每日机会": daily_market_scan_prompt,
        "每日机会分析": daily_market_scan_prompt,
        "今日机会": daily_market_scan_prompt,
    }
    return rewrites.get(normalized, message)


async def handle_slash_command(processor: Any, cmd: str, session: Any, channel: str, chat_id: str) -> OutboundMessage | None:
    """Handle slash commands like /new, /help, /stop."""
    if cmd == "/new":
        return await handle_new_session(processor, session, channel, chat_id)
    if cmd == "/help":
        return handle_help(channel, chat_id)
    if cmd == "/stop":
        return handle_stop(channel, chat_id)
    return None


async def handle_new_session(processor: Any, session: Any, channel: str, chat_id: str) -> OutboundMessage | None:
    """Handle /new command by archiving remaining memory and clearing the session."""
    lock = processor._consolidation_locks.setdefault(session.key, asyncio.Lock())
    processor._consolidating.add(session.key)
    try:
        async with lock:
            snapshot = session.messages[session.last_consolidated:]
            if snapshot:
                from marketbot.session.manager import Session

                temp = Session(key=session.key)
                temp.messages = list(snapshot)
                if not await processor._consolidate_memory(temp, archive_all=True):
                    return OutboundMessage(
                        channel=channel,
                        chat_id=chat_id,
                        content="Memory archival failed, session not cleared. Please try again.",
                    )
    except Exception:
        logger.exception("/new archival failed for {}", session.key)
        return OutboundMessage(
            channel=channel,
            chat_id=chat_id,
            content="Memory archival failed, session not cleared. Please try again.",
        )
    finally:
        processor._consolidating.discard(session.key)

    session.clear()
    await processor.sessions.save_async(session)
    processor.sessions.invalidate(session.key)
    return OutboundMessage(channel=channel, chat_id=chat_id, content="New session started.")


def handle_help(channel: str, chat_id: str) -> OutboundMessage:
    """Handle /help command."""
    return OutboundMessage(
        channel=channel,
        chat_id=chat_id,
        content="🐂 marketbot commands:\n/new — Start a new conversation\n/stop — Stop the current task\n/help — Show available commands",
    )


def handle_stop(channel: str, chat_id: str) -> OutboundMessage:
    """Handle /stop command."""
    return OutboundMessage(
        channel=channel,
        chat_id=chat_id,
        content="Task cancellation is not yet implemented.",
    )

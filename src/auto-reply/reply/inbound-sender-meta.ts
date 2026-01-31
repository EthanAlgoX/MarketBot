/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { MsgContext } from "../templating.js";
import { normalizeChatType } from "../../channels/chat-type.js";
import { listSenderLabelCandidates, resolveSenderLabel } from "../../channels/sender-label.js";

export function formatInboundBodyWithSenderMeta(params: { body: string; ctx: MsgContext }): string {
  const body = params.body;
  if (!body.trim()) {
    return body;
  }
  const chatType = normalizeChatType(params.ctx.ChatType);
  if (!chatType || chatType === "direct") {
    return body;
  }
  if (hasSenderMetaLine(body, params.ctx)) {
    return body;
  }

  const senderLabel = resolveSenderLabel({
    name: params.ctx.SenderName,
    username: params.ctx.SenderUsername,
    tag: params.ctx.SenderTag,
    e164: params.ctx.SenderE164,
    id: params.ctx.SenderId,
  });
  if (!senderLabel) {
    return body;
  }

  return `${body}\n[from: ${senderLabel}]`;
}

function hasSenderMetaLine(body: string, ctx: MsgContext): boolean {
  if (/(^|\n)\[from:/i.test(body)) {
    return true;
  }
  const candidates = listSenderLabelCandidates({
    name: ctx.SenderName,
    username: ctx.SenderUsername,
    tag: ctx.SenderTag,
    e164: ctx.SenderE164,
    id: ctx.SenderId,
  });
  if (candidates.length === 0) {
    return false;
  }
  return candidates.some((candidate) => {
    const escaped = escapeRegExp(candidate);
    // Envelope bodies look like "[Signal ...] Alice: hi".
    // Treat the post-header sender prefix as already having sender metadata.
    const pattern = new RegExp(`(^|\\n|\\]\\s*)${escaped}:\\s`, "i");
    return pattern.test(body);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

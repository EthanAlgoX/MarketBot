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

import type { MsgContext } from "../auto-reply/templating.js";
import { normalizeChatType } from "./chat-type.js";

function extractConversationId(from?: string): string | undefined {
  const trimmed = from?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parts = trimmed.split(":").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

function shouldAppendId(id: string): boolean {
  if (/^[0-9]+$/.test(id)) {
    return true;
  }
  if (id.includes("@g.us")) {
    return true;
  }
  return false;
}

export function resolveConversationLabel(ctx: MsgContext): string | undefined {
  const explicit = ctx.ConversationLabel?.trim();
  if (explicit) {
    return explicit;
  }

  const threadLabel = ctx.ThreadLabel?.trim();
  if (threadLabel) {
    return threadLabel;
  }

  const chatType = normalizeChatType(ctx.ChatType);
  if (chatType === "direct") {
    return ctx.SenderName?.trim() || ctx.From?.trim() || undefined;
  }

  const base =
    ctx.GroupChannel?.trim() ||
    ctx.GroupSubject?.trim() ||
    ctx.GroupSpace?.trim() ||
    ctx.From?.trim() ||
    "";
  if (!base) {
    return undefined;
  }

  const id = extractConversationId(ctx.From);
  if (!id) {
    return base;
  }
  if (!shouldAppendId(id)) {
    return base;
  }
  if (base === id) {
    return base;
  }
  if (base.includes(id)) {
    return base;
  }
  if (base.toLowerCase().includes(" id:")) {
    return base;
  }
  if (base.startsWith("#") || base.startsWith("@")) {
    return base;
  }
  return `${base} id:${id}`;
}

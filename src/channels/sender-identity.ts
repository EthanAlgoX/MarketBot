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

export function validateSenderIdentity(ctx: MsgContext): string[] {
  const issues: string[] = [];

  const chatType = normalizeChatType(ctx.ChatType);
  const isDirect = chatType === "direct";

  const senderId = ctx.SenderId?.trim() || "";
  const senderName = ctx.SenderName?.trim() || "";
  const senderUsername = ctx.SenderUsername?.trim() || "";
  const senderE164 = ctx.SenderE164?.trim() || "";

  if (!isDirect) {
    if (!senderId && !senderName && !senderUsername && !senderE164) {
      issues.push("missing sender identity (SenderId/SenderName/SenderUsername/SenderE164)");
    }
  }

  if (senderE164) {
    if (!/^\+\d{3,}$/.test(senderE164)) {
      issues.push(`invalid SenderE164: ${senderE164}`);
    }
  }

  if (senderUsername) {
    if (senderUsername.includes("@")) {
      issues.push(`SenderUsername should not include "@": ${senderUsername}`);
    }
    if (/\s/.test(senderUsername)) {
      issues.push(`SenderUsername should not include whitespace: ${senderUsername}`);
    }
  }

  if (ctx.SenderId != null && !senderId) {
    issues.push("SenderId is set but empty");
  }

  return issues;
}

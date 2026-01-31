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

import { resolveMessagePrefix } from "../../../agents/identity.js";
import { formatInboundEnvelope, type EnvelopeFormatOptions } from "../../../auto-reply/envelope.js";
import type { loadConfig } from "../../../config/config.js";
import type { WebInboundMsg } from "../types.js";

export function formatReplyContext(msg: WebInboundMsg) {
  if (!msg.replyToBody) {
    return null;
  }
  const sender = msg.replyToSender ?? "unknown sender";
  const idPart = msg.replyToId ? ` id:${msg.replyToId}` : "";
  return `[Replying to ${sender}${idPart}]\n${msg.replyToBody}\n[/Replying]`;
}

export function buildInboundLine(params: {
  cfg: ReturnType<typeof loadConfig>;
  msg: WebInboundMsg;
  agentId: string;
  previousTimestamp?: number;
  envelope?: EnvelopeFormatOptions;
}) {
  const { cfg, msg, agentId, previousTimestamp, envelope } = params;
  // WhatsApp inbound prefix: channels.whatsapp.messagePrefix > legacy messages.messagePrefix > identity/defaults
  const messagePrefix = resolveMessagePrefix(cfg, agentId, {
    configured: cfg.channels?.whatsapp?.messagePrefix,
    hasAllowFrom: (cfg.channels?.whatsapp?.allowFrom?.length ?? 0) > 0,
  });
  const prefixStr = messagePrefix ? `${messagePrefix} ` : "";
  const replyContext = formatReplyContext(msg);
  const baseLine = `${prefixStr}${msg.body}${replyContext ? `\n\n${replyContext}` : ""}`;

  // Wrap with standardized envelope for the agent.
  return formatInboundEnvelope({
    channel: "WhatsApp",
    from: msg.chatType === "group" ? msg.from : msg.from?.replace(/^whatsapp:/, ""),
    timestamp: msg.timestamp,
    body: baseLine,
    chatType: msg.chatType,
    sender: {
      name: msg.senderName,
      e164: msg.senderE164,
      id: msg.senderJid,
    },
    previousTimestamp,
    envelope,
  });
}

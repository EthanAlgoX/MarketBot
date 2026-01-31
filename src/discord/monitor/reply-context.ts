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

import type { Guild, Message, User } from "@buape/carbon";

import { formatAgentEnvelope, type EnvelopeFormatOptions } from "../../auto-reply/envelope.js";
import { formatDiscordUserTag, resolveTimestampMs } from "./format.js";

export function resolveReplyContext(
  message: Message,
  resolveDiscordMessageText: (message: Message, options?: { includeForwarded?: boolean }) => string,
  options?: { envelope?: EnvelopeFormatOptions },
): string | null {
  const referenced = message.referencedMessage;
  if (!referenced?.author) {
    return null;
  }
  const referencedText = resolveDiscordMessageText(referenced, {
    includeForwarded: true,
  });
  if (!referencedText) {
    return null;
  }
  const fromLabel = referenced.author ? buildDirectLabel(referenced.author) : "Unknown";
  const body = `${referencedText}\n[discord message id: ${referenced.id} channel: ${referenced.channelId} from: ${formatDiscordUserTag(referenced.author)} user id:${referenced.author?.id ?? "unknown"}]`;
  return formatAgentEnvelope({
    channel: "Discord",
    from: fromLabel,
    timestamp: resolveTimestampMs(referenced.timestamp),
    body,
    envelope: options?.envelope,
  });
}

export function buildDirectLabel(author: User) {
  const username = formatDiscordUserTag(author);
  return `${username} user id:${author.id}`;
}

export function buildGuildLabel(params: { guild?: Guild; channelName: string; channelId: string }) {
  const { guild, channelName, channelId } = params;
  return `${guild?.name ?? "Guild"} #${channelName} channel id:${channelId}`;
}

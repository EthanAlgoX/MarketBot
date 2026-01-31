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

import { chunkText } from "../../../auto-reply/chunk.js";
import { sendMessageIMessage } from "../../../imessage/send.js";
import { resolveChannelMediaMaxBytes } from "../media-limits.js";
import type { ChannelOutboundAdapter } from "../types.js";

export const imessageOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: chunkText,
  chunkerMode: "text",
  textChunkLimit: 4000,
  sendText: async ({ cfg, to, text, accountId, deps }) => {
    const send = deps?.sendIMessage ?? sendMessageIMessage;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg, accountId }) =>
        cfg.channels?.imessage?.accounts?.[accountId]?.mediaMaxMb ??
        cfg.channels?.imessage?.mediaMaxMb,
      accountId,
    });
    const result = await send(to, text, {
      maxBytes,
      accountId: accountId ?? undefined,
    });
    return { channel: "imessage", ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, deps }) => {
    const send = deps?.sendIMessage ?? sendMessageIMessage;
    const maxBytes = resolveChannelMediaMaxBytes({
      cfg,
      resolveChannelLimitMb: ({ cfg, accountId }) =>
        cfg.channels?.imessage?.accounts?.[accountId]?.mediaMaxMb ??
        cfg.channels?.imessage?.mediaMaxMb,
      accountId,
    });
    const result = await send(to, text, {
      mediaUrl,
      maxBytes,
      accountId: accountId ?? undefined,
    });
    return { channel: "imessage", ...result };
  },
};

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

import { describe, expect, it } from "vitest";

import { applyGroupGating } from "./group-gating.js";

const baseConfig = {
  channels: {
    whatsapp: {
      groupPolicy: "open",
      groups: { "*": { requireMention: true } },
    },
  },
  session: { store: "/tmp/marketbot-sessions.json" },
} as const;

describe("applyGroupGating", () => {
  it("treats reply-to-bot as implicit mention", () => {
    const groupHistories = new Map();
    const result = applyGroupGating({
      cfg: baseConfig as unknown as ReturnType<
        typeof import("../../../config/config.js").loadConfig
      >,
      msg: {
        id: "m1",
        from: "123@g.us",
        conversationId: "123@g.us",
        to: "+15550000",
        accountId: "default",
        body: "following up",
        timestamp: Date.now(),
        chatType: "group",
        chatId: "123@g.us",
        selfJid: "15551234567@s.whatsapp.net",
        selfE164: "+15551234567",
        replyToId: "m0",
        replyToBody: "bot said hi",
        replyToSender: "+15551234567",
        replyToSenderJid: "15551234567@s.whatsapp.net",
        replyToSenderE164: "+15551234567",
        sendComposing: async () => {},
        reply: async () => {},
        sendMedia: async () => {},
      },
      conversationId: "123@g.us",
      groupHistoryKey: "whatsapp:default:group:123@g.us",
      agentId: "main",
      sessionKey: "agent:main:whatsapp:group:123@g.us",
      baseMentionConfig: { mentionRegexes: [] },
      groupHistories,
      groupHistoryLimit: 10,
      groupMemberNames: new Map(),
      logVerbose: () => {},
      replyLogger: { debug: () => {} },
    });

    expect(result.shouldProcess).toBe(true);
  });
});

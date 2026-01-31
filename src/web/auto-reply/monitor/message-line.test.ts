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

import { buildInboundLine } from "./message-line.js";

describe("buildInboundLine", () => {
  it("prefixes group messages with sender", () => {
    const line = buildInboundLine({
      cfg: {
        agents: { defaults: { workspace: "/tmp/marketbot" } },
        channels: { whatsapp: { messagePrefix: "" } },
      } as never,
      agentId: "main",
      msg: {
        from: "123@g.us",
        conversationId: "123@g.us",
        to: "+15550009999",
        accountId: "default",
        body: "ping",
        timestamp: 1700000000000,
        chatType: "group",
        chatId: "123@g.us",
        senderJid: "111@s.whatsapp.net",
        senderE164: "+15550001111",
        senderName: "Bob",
        sendComposing: async () => undefined,
        reply: async () => undefined,
        sendMedia: async () => undefined,
      } as never,
    });

    expect(line).toContain("Bob (+15550001111):");
    expect(line).toContain("ping");
  });
});

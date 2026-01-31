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
import type { WebInboundMsg } from "./types.js";
import { isBotMentionedFromTargets, resolveMentionTargets } from "./mentions.js";

const makeMsg = (overrides: Partial<WebInboundMsg>): WebInboundMsg =>
  ({
    id: "m1",
    from: "120363401234567890@g.us",
    conversationId: "120363401234567890@g.us",
    to: "15551234567@s.whatsapp.net",
    accountId: "default",
    body: "",
    chatType: "group",
    chatId: "120363401234567890@g.us",
    sendComposing: async () => {},
    reply: async () => {},
    sendMedia: async () => {},
    ...overrides,
  }) as WebInboundMsg;

describe("isBotMentionedFromTargets", () => {
  const mentionCfg = { mentionRegexes: [/\bmarketbot\b/i] };

  it("ignores regex matches when other mentions are present", () => {
    const msg = makeMsg({
      body: "@MarketBot please help",
      mentionedJids: ["19998887777@s.whatsapp.net"],
      selfE164: "+15551234567",
      selfJid: "15551234567@s.whatsapp.net",
    });
    const targets = resolveMentionTargets(msg);
    expect(isBotMentionedFromTargets(msg, mentionCfg, targets)).toBe(false);
  });

  it("matches explicit self mentions", () => {
    const msg = makeMsg({
      body: "hey",
      mentionedJids: ["15551234567@s.whatsapp.net"],
      selfE164: "+15551234567",
      selfJid: "15551234567@s.whatsapp.net",
    });
    const targets = resolveMentionTargets(msg);
    expect(isBotMentionedFromTargets(msg, mentionCfg, targets)).toBe(true);
  });

  it("falls back to regex when no mentions are present", () => {
    const msg = makeMsg({
      body: "marketbot can you help?",
      selfE164: "+15551234567",
      selfJid: "15551234567@s.whatsapp.net",
    });
    const targets = resolveMentionTargets(msg);
    expect(isBotMentionedFromTargets(msg, mentionCfg, targets)).toBe(true);
  });
});

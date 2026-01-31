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

import type { MsgContext } from "../auto-reply/templating.js";
import { resolveConversationLabel } from "./conversation-label.js";

describe("resolveConversationLabel", () => {
  it("prefers ConversationLabel when present", () => {
    const ctx: MsgContext = { ConversationLabel: "Pinned Label", ChatType: "group" };
    expect(resolveConversationLabel(ctx)).toBe("Pinned Label");
  });

  it("uses SenderName for direct chats when available", () => {
    const ctx: MsgContext = { ChatType: "direct", SenderName: "Ada", From: "telegram:99" };
    expect(resolveConversationLabel(ctx)).toBe("Ada");
  });

  it("derives Telegram-like group labels with numeric id suffix", () => {
    const ctx: MsgContext = { ChatType: "group", GroupSubject: "Ops", From: "telegram:group:42" };
    expect(resolveConversationLabel(ctx)).toBe("Ops id:42");
  });

  it("does not append ids for #rooms/channels", () => {
    const ctx: MsgContext = {
      ChatType: "channel",
      GroupSubject: "#general",
      From: "slack:channel:C123",
    };
    expect(resolveConversationLabel(ctx)).toBe("#general");
  });

  it("appends ids for WhatsApp-like group ids when a subject exists", () => {
    const ctx: MsgContext = {
      ChatType: "group",
      GroupSubject: "Family",
      From: "whatsapp:group:123@g.us",
    };
    expect(resolveConversationLabel(ctx)).toBe("Family id:123@g.us");
  });
});

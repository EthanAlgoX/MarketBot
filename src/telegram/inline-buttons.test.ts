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

import { resolveTelegramTargetChatType } from "./inline-buttons.js";

describe("resolveTelegramTargetChatType", () => {
  it("returns 'direct' for positive numeric IDs", () => {
    expect(resolveTelegramTargetChatType("5232990709")).toBe("direct");
    expect(resolveTelegramTargetChatType("123456789")).toBe("direct");
  });

  it("returns 'group' for negative numeric IDs", () => {
    expect(resolveTelegramTargetChatType("-123456789")).toBe("group");
    expect(resolveTelegramTargetChatType("-1001234567890")).toBe("group");
  });

  it("handles telegram: prefix from normalizeTelegramMessagingTarget", () => {
    expect(resolveTelegramTargetChatType("telegram:5232990709")).toBe("direct");
    expect(resolveTelegramTargetChatType("telegram:-123456789")).toBe("group");
    expect(resolveTelegramTargetChatType("TELEGRAM:5232990709")).toBe("direct");
  });

  it("handles tg/group prefixes and topic suffixes", () => {
    expect(resolveTelegramTargetChatType("tg:5232990709")).toBe("direct");
    expect(resolveTelegramTargetChatType("telegram:group:-1001234567890")).toBe("group");
    expect(resolveTelegramTargetChatType("telegram:group:-1001234567890:topic:456")).toBe("group");
    expect(resolveTelegramTargetChatType("-1001234567890:456")).toBe("group");
  });

  it("returns 'unknown' for usernames", () => {
    expect(resolveTelegramTargetChatType("@username")).toBe("unknown");
    expect(resolveTelegramTargetChatType("telegram:@username")).toBe("unknown");
  });

  it("returns 'unknown' for empty strings", () => {
    expect(resolveTelegramTargetChatType("")).toBe("unknown");
    expect(resolveTelegramTargetChatType("   ")).toBe("unknown");
  });
});

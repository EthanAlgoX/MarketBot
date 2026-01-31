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

import { parseTelegramTarget, stripTelegramInternalPrefixes } from "./targets.js";

describe("stripTelegramInternalPrefixes", () => {
  it("strips telegram prefix", () => {
    expect(stripTelegramInternalPrefixes("telegram:123")).toBe("123");
  });

  it("strips telegram+group prefixes", () => {
    expect(stripTelegramInternalPrefixes("telegram:group:-100123")).toBe("-100123");
  });

  it("does not strip group prefix without telegram prefix", () => {
    expect(stripTelegramInternalPrefixes("group:-100123")).toBe("group:-100123");
  });

  it("is idempotent", () => {
    expect(stripTelegramInternalPrefixes("@mychannel")).toBe("@mychannel");
  });
});

describe("parseTelegramTarget", () => {
  it("parses plain chatId", () => {
    expect(parseTelegramTarget("-1001234567890")).toEqual({
      chatId: "-1001234567890",
    });
  });

  it("parses @username", () => {
    expect(parseTelegramTarget("@mychannel")).toEqual({
      chatId: "@mychannel",
    });
  });

  it("parses chatId:topicId format", () => {
    expect(parseTelegramTarget("-1001234567890:123")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 123,
    });
  });

  it("parses chatId:topic:topicId format", () => {
    expect(parseTelegramTarget("-1001234567890:topic:456")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 456,
    });
  });

  it("trims whitespace", () => {
    expect(parseTelegramTarget("  -1001234567890:99  ")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 99,
    });
  });

  it("does not treat non-numeric suffix as topicId", () => {
    expect(parseTelegramTarget("-1001234567890:abc")).toEqual({
      chatId: "-1001234567890:abc",
    });
  });

  it("strips internal prefixes before parsing", () => {
    expect(parseTelegramTarget("telegram:group:-1001234567890:topic:456")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 456,
    });
  });
});

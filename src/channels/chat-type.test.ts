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

import { normalizeChatType } from "./chat-type.js";

describe("normalizeChatType", () => {
  it("normalizes common inputs", () => {
    expect(normalizeChatType("direct")).toBe("direct");
    expect(normalizeChatType("dm")).toBe("direct");
    expect(normalizeChatType("group")).toBe("group");
    expect(normalizeChatType("channel")).toBe("channel");
  });

  it("returns undefined for empty/unknown values", () => {
    expect(normalizeChatType(undefined)).toBeUndefined();
    expect(normalizeChatType("")).toBeUndefined();
    expect(normalizeChatType("nope")).toBeUndefined();
    expect(normalizeChatType("room")).toBeUndefined();
  });
});

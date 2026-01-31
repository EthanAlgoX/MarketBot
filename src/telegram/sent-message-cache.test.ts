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

import { afterEach, describe, expect, it } from "vitest";
import { clearSentMessageCache, recordSentMessage, wasSentByBot } from "./sent-message-cache.js";

describe("sent-message-cache", () => {
  afterEach(() => {
    clearSentMessageCache();
  });

  it("records and retrieves sent messages", () => {
    recordSentMessage(123, 1);
    recordSentMessage(123, 2);
    recordSentMessage(456, 10);

    expect(wasSentByBot(123, 1)).toBe(true);
    expect(wasSentByBot(123, 2)).toBe(true);
    expect(wasSentByBot(456, 10)).toBe(true);
    expect(wasSentByBot(123, 3)).toBe(false);
    expect(wasSentByBot(789, 1)).toBe(false);
  });

  it("handles string chat IDs", () => {
    recordSentMessage("123", 1);
    expect(wasSentByBot("123", 1)).toBe(true);
    expect(wasSentByBot(123, 1)).toBe(true);
  });

  it("clears cache", () => {
    recordSentMessage(123, 1);
    expect(wasSentByBot(123, 1)).toBe(true);

    clearSentMessageCache();
    expect(wasSentByBot(123, 1)).toBe(false);
  });
});

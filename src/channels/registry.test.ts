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

import {
  formatChannelSelectionLine,
  listChatChannels,
  normalizeChatChannelId,
} from "./registry.js";

describe("channel registry", () => {
  it("normalizes aliases", () => {
    expect(normalizeChatChannelId("imsg")).toBe("imessage");
    expect(normalizeChatChannelId("gchat")).toBe("googlechat");
    expect(normalizeChatChannelId("google-chat")).toBe("googlechat");
    expect(normalizeChatChannelId("web")).toBeNull();
  });

  it("keeps Telegram first in the default order", () => {
    const channels = listChatChannels();
    expect(channels[0]?.id).toBe("telegram");
  });

  it("does not include MS Teams by default", () => {
    const channels = listChatChannels();
    expect(channels.some((channel) => channel.id === "msteams")).toBe(false);
  });

  it("formats selection lines with docs labels", () => {
    const channels = listChatChannels();
    const first = channels[0];
    if (!first) {
      throw new Error("Missing channel metadata.");
    }
    const line = formatChannelSelectionLine(first, (path, label) =>
      [label, path].filter(Boolean).join(":"),
    );
    expect(line).not.toContain("Docs:");
    expect(line).toContain("/channels/telegram");
    expect(line).toContain("https://marketbot.ai");
  });
});

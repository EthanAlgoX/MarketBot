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

import type { MarketBotConfig } from "../config/config.js";
import { buildSlackThreadingToolContext } from "./threading-tool-context.js";

const emptyCfg = {} as MarketBotConfig;

describe("buildSlackThreadingToolContext", () => {
  it("uses top-level replyToMode by default", () => {
    const cfg = {
      channels: {
        slack: { replyToMode: "first" },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "channel" },
    });
    expect(result.replyToMode).toBe("first");
  });

  it("uses chat-type replyToMode overrides for direct messages when configured", () => {
    const cfg = {
      channels: {
        slack: {
          replyToMode: "off",
          replyToModeByChatType: { direct: "all" },
        },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "direct" },
    });
    expect(result.replyToMode).toBe("all");
  });

  it("uses top-level replyToMode for channels when no channel override is set", () => {
    const cfg = {
      channels: {
        slack: {
          replyToMode: "off",
          replyToModeByChatType: { direct: "all" },
        },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "channel" },
    });
    expect(result.replyToMode).toBe("off");
  });

  it("falls back to top-level when no chat-type override is set", () => {
    const cfg = {
      channels: {
        slack: {
          replyToMode: "first",
        },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "direct" },
    });
    expect(result.replyToMode).toBe("first");
  });

  it("uses legacy dm.replyToMode for direct messages when no chat-type override exists", () => {
    const cfg = {
      channels: {
        slack: {
          replyToMode: "off",
          dm: { replyToMode: "all" },
        },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "direct" },
    });
    expect(result.replyToMode).toBe("all");
  });

  it("uses all mode when ThreadLabel is present", () => {
    const cfg = {
      channels: {
        slack: { replyToMode: "off" },
      },
    } as MarketBotConfig;
    const result = buildSlackThreadingToolContext({
      cfg,
      accountId: null,
      context: { ChatType: "channel", ThreadLabel: "some-thread" },
    });
    expect(result.replyToMode).toBe("all");
  });

  it("defaults to off when no replyToMode is configured", () => {
    const result = buildSlackThreadingToolContext({
      cfg: emptyCfg,
      accountId: null,
      context: { ChatType: "direct" },
    });
    expect(result.replyToMode).toBe("off");
  });
});

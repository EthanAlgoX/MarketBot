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

import { resolveSlackChannelConfig } from "./channel-config.js";

describe("resolveSlackChannelConfig", () => {
  it("uses defaultRequireMention when channels config is empty", () => {
    const res = resolveSlackChannelConfig({
      channelId: "C1",
      channels: {},
      defaultRequireMention: false,
    });
    expect(res).toEqual({ allowed: true, requireMention: false });
  });

  it("defaults defaultRequireMention to true when not provided", () => {
    const res = resolveSlackChannelConfig({
      channelId: "C1",
      channels: {},
    });
    expect(res).toEqual({ allowed: true, requireMention: true });
  });

  it("prefers explicit channel/fallback requireMention over defaultRequireMention", () => {
    const res = resolveSlackChannelConfig({
      channelId: "C1",
      channels: { "*": { requireMention: true } },
      defaultRequireMention: false,
    });
    expect(res).toMatchObject({ requireMention: true });
  });

  it("uses wildcard entries when no direct channel config exists", () => {
    const res = resolveSlackChannelConfig({
      channelId: "C1",
      channels: { "*": { allow: true, requireMention: false } },
      defaultRequireMention: true,
    });
    expect(res).toMatchObject({
      allowed: true,
      requireMention: false,
      matchKey: "*",
      matchSource: "wildcard",
    });
  });

  it("uses direct match metadata when channel config exists", () => {
    const res = resolveSlackChannelConfig({
      channelId: "C1",
      channels: { C1: { allow: true, requireMention: false } },
      defaultRequireMention: true,
    });
    expect(res).toMatchObject({
      matchKey: "C1",
      matchSource: "direct",
    });
  });
});

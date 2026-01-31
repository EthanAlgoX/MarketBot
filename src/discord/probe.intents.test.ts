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

import { resolveDiscordPrivilegedIntentsFromFlags } from "./probe.js";

describe("resolveDiscordPrivilegedIntentsFromFlags", () => {
  it("reports disabled when no bits set", () => {
    expect(resolveDiscordPrivilegedIntentsFromFlags(0)).toEqual({
      presence: "disabled",
      guildMembers: "disabled",
      messageContent: "disabled",
    });
  });

  it("reports enabled when full intent bits set", () => {
    const flags = (1 << 12) | (1 << 14) | (1 << 18);
    expect(resolveDiscordPrivilegedIntentsFromFlags(flags)).toEqual({
      presence: "enabled",
      guildMembers: "enabled",
      messageContent: "enabled",
    });
  });

  it("reports limited when limited intent bits set", () => {
    const flags = (1 << 13) | (1 << 15) | (1 << 19);
    expect(resolveDiscordPrivilegedIntentsFromFlags(flags)).toEqual({
      presence: "limited",
      guildMembers: "limited",
      messageContent: "limited",
    });
  });

  it("prefers enabled over limited when both set", () => {
    const flags = (1 << 12) | (1 << 13) | (1 << 14) | (1 << 15) | (1 << 18) | (1 << 19);
    expect(resolveDiscordPrivilegedIntentsFromFlags(flags)).toEqual({
      presence: "enabled",
      guildMembers: "enabled",
      messageContent: "enabled",
    });
  });
});

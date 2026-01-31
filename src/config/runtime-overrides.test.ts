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

import { beforeEach, describe, expect, it } from "vitest";
import {
  applyConfigOverrides,
  getConfigOverrides,
  resetConfigOverrides,
  setConfigOverride,
  unsetConfigOverride,
} from "./runtime-overrides.js";
import type { MarketBotConfig } from "./types.js";

describe("runtime overrides", () => {
  beforeEach(() => {
    resetConfigOverrides();
  });

  it("sets and applies nested overrides", () => {
    const cfg = {
      messages: { responsePrefix: "[marketbot]" },
    } as MarketBotConfig;
    setConfigOverride("messages.responsePrefix", "[debug]");
    const next = applyConfigOverrides(cfg);
    expect(next.messages?.responsePrefix).toBe("[debug]");
  });

  it("merges object overrides without clobbering siblings", () => {
    const cfg = {
      channels: { whatsapp: { dmPolicy: "pairing", allowFrom: ["+1"] } },
    } as MarketBotConfig;
    setConfigOverride("channels.whatsapp.dmPolicy", "open");
    const next = applyConfigOverrides(cfg);
    expect(next.channels?.whatsapp?.dmPolicy).toBe("open");
    expect(next.channels?.whatsapp?.allowFrom).toEqual(["+1"]);
  });

  it("unsets overrides and prunes empty branches", () => {
    setConfigOverride("channels.whatsapp.dmPolicy", "open");
    const removed = unsetConfigOverride("channels.whatsapp.dmPolicy");
    expect(removed.ok).toBe(true);
    expect(removed.removed).toBe(true);
    expect(Object.keys(getConfigOverrides()).length).toBe(0);
  });

  it("rejects prototype pollution paths", () => {
    const attempts = ["__proto__.polluted", "constructor.polluted", "prototype.polluted"];
    for (const path of attempts) {
      const result = setConfigOverride(path, true);
      expect(result.ok).toBe(false);
      expect(Object.keys(getConfigOverrides()).length).toBe(0);
    }
  });
});

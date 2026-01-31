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
import { resolveNativeSkillsEnabled } from "./commands.js";

describe("resolveNativeSkillsEnabled", () => {
  it("uses provider defaults for auto", () => {
    expect(
      resolveNativeSkillsEnabled({
        providerId: "discord",
        globalSetting: "auto",
      }),
    ).toBe(true);
    expect(
      resolveNativeSkillsEnabled({
        providerId: "telegram",
        globalSetting: "auto",
      }),
    ).toBe(true);
    expect(
      resolveNativeSkillsEnabled({
        providerId: "slack",
        globalSetting: "auto",
      }),
    ).toBe(false);
    expect(
      resolveNativeSkillsEnabled({
        providerId: "whatsapp",
        globalSetting: "auto",
      }),
    ).toBe(false);
  });

  it("honors explicit provider settings", () => {
    expect(
      resolveNativeSkillsEnabled({
        providerId: "slack",
        providerSetting: true,
        globalSetting: "auto",
      }),
    ).toBe(true);
    expect(
      resolveNativeSkillsEnabled({
        providerId: "discord",
        providerSetting: false,
        globalSetting: true,
      }),
    ).toBe(false);
  });
});

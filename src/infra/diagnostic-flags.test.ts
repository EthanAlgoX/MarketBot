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
import { isDiagnosticFlagEnabled, resolveDiagnosticFlags } from "./diagnostic-flags.js";

describe("diagnostic flags", () => {
  it("merges config + env flags", () => {
    const cfg = {
      diagnostics: { flags: ["telegram.http", "cache.*"] },
    } as MarketBotConfig;
    const env = {
      MARKETBOT_DIAGNOSTICS: "foo,bar",
    } as NodeJS.ProcessEnv;

    const flags = resolveDiagnosticFlags(cfg, env);
    expect(flags).toEqual(expect.arrayContaining(["telegram.http", "cache.*", "foo", "bar"]));
    expect(isDiagnosticFlagEnabled("telegram.http", cfg, env)).toBe(true);
    expect(isDiagnosticFlagEnabled("cache.hit", cfg, env)).toBe(true);
    expect(isDiagnosticFlagEnabled("foo", cfg, env)).toBe(true);
  });

  it("treats env true as wildcard", () => {
    const env = { MARKETBOT_DIAGNOSTICS: "1" } as NodeJS.ProcessEnv;
    expect(isDiagnosticFlagEnabled("anything.here", undefined, env)).toBe(true);
  });

  it("treats env false as disabled", () => {
    const env = { MARKETBOT_DIAGNOSTICS: "0" } as NodeJS.ProcessEnv;
    expect(isDiagnosticFlagEnabled("telegram.http", undefined, env)).toBe(false);
  });
});

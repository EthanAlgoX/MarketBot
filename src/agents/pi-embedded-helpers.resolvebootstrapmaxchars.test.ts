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
import { DEFAULT_BOOTSTRAP_MAX_CHARS, resolveBootstrapMaxChars } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";

const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});
describe("resolveBootstrapMaxChars", () => {
  it("returns default when unset", () => {
    expect(resolveBootstrapMaxChars()).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });
  it("uses configured value when valid", () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: 12345 } },
    } as MarketBotConfig;
    expect(resolveBootstrapMaxChars(cfg)).toBe(12345);
  });
  it("falls back when invalid", () => {
    const cfg = {
      agents: { defaults: { bootstrapMaxChars: -1 } },
    } as MarketBotConfig;
    expect(resolveBootstrapMaxChars(cfg)).toBe(DEFAULT_BOOTSTRAP_MAX_CHARS);
  });
});

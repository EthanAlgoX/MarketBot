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

import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".marketbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", MARKETBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".marketbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", MARKETBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".marketbot"));
  });

  it("uses MARKETBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", MARKETBOT_STATE_DIR: "/var/lib/marketbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/marketbot"));
  });

  it("expands ~ in MARKETBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", MARKETBOT_STATE_DIR: "~/marketbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/marketbot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { MARKETBOT_STATE_DIR: "C:\\State\\marketbot" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\marketbot");
  });
});

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

import { toBoolean } from "./utils.js";

describe("toBoolean", () => {
  it("parses yes/no and 1/0", () => {
    expect(toBoolean("yes")).toBe(true);
    expect(toBoolean("1")).toBe(true);
    expect(toBoolean("no")).toBe(false);
    expect(toBoolean("0")).toBe(false);
  });

  it("returns undefined for on/off strings", () => {
    expect(toBoolean("on")).toBeUndefined();
    expect(toBoolean("off")).toBeUndefined();
  });

  it("passes through boolean values", () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });
});

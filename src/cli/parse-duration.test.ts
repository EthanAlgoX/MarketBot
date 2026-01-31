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

import { parseDurationMs } from "./parse-duration.js";

describe("parseDurationMs", () => {
  it("parses bare ms", () => {
    expect(parseDurationMs("10000")).toBe(10_000);
  });

  it("parses seconds suffix", () => {
    expect(parseDurationMs("10s")).toBe(10_000);
  });

  it("parses minutes suffix", () => {
    expect(parseDurationMs("1m")).toBe(60_000);
  });

  it("parses hours suffix", () => {
    expect(parseDurationMs("2h")).toBe(7_200_000);
  });

  it("parses days suffix", () => {
    expect(parseDurationMs("2d")).toBe(172_800_000);
  });

  it("supports decimals", () => {
    expect(parseDurationMs("0.5s")).toBe(500);
  });
});

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

import { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./signal.js";

describe("signal target normalization", () => {
  it("normalizes uuid targets by stripping uuid:", () => {
    expect(normalizeSignalMessagingTarget("uuid:123E4567-E89B-12D3-A456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("normalizes signal:uuid targets", () => {
    expect(normalizeSignalMessagingTarget("signal:uuid:123E4567-E89B-12D3-A456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("accepts uuid prefixes for target detection", () => {
    expect(looksLikeSignalTargetId("uuid:123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(looksLikeSignalTargetId("signal:uuid:123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("accepts compact UUIDs for target detection", () => {
    expect(looksLikeSignalTargetId("123e4567e89b12d3a456426614174000")).toBe(true);
    expect(looksLikeSignalTargetId("uuid:123e4567e89b12d3a456426614174000")).toBe(true);
  });

  it("rejects invalid uuid prefixes", () => {
    expect(looksLikeSignalTargetId("uuid:")).toBe(false);
    expect(looksLikeSignalTargetId("uuid:not-a-uuid")).toBe(false);
  });
});

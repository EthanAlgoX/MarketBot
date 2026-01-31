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

import { normalizeFingerprint } from "./fingerprint.js";

describe("normalizeFingerprint", () => {
  it("strips sha256 prefixes and separators", () => {
    expect(normalizeFingerprint("sha256:AA:BB:cc")).toBe("aabbcc");
    expect(normalizeFingerprint("SHA-256 11-22-33")).toBe("112233");
    expect(normalizeFingerprint("aa:bb:cc")).toBe("aabbcc");
  });
});

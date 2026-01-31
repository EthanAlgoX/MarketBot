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

import { createDedupeCache } from "./dedupe.js";

describe("createDedupeCache", () => {
  it("marks duplicates within TTL", () => {
    const cache = createDedupeCache({ ttlMs: 1000, maxSize: 10 });
    expect(cache.check("a", 100)).toBe(false);
    expect(cache.check("a", 500)).toBe(true);
  });

  it("expires entries after TTL", () => {
    const cache = createDedupeCache({ ttlMs: 1000, maxSize: 10 });
    expect(cache.check("a", 100)).toBe(false);
    expect(cache.check("a", 1501)).toBe(false);
  });

  it("evicts oldest entries when over max size", () => {
    const cache = createDedupeCache({ ttlMs: 10_000, maxSize: 2 });
    expect(cache.check("a", 100)).toBe(false);
    expect(cache.check("b", 200)).toBe(false);
    expect(cache.check("c", 300)).toBe(false);
    expect(cache.check("a", 400)).toBe(false);
  });

  it("prunes expired entries even when refreshed keys are older in insertion order", () => {
    const cache = createDedupeCache({ ttlMs: 100, maxSize: 10 });
    expect(cache.check("a", 0)).toBe(false);
    expect(cache.check("b", 50)).toBe(false);
    expect(cache.check("a", 120)).toBe(false);
    expect(cache.check("c", 200)).toBe(false);
    expect(cache.size()).toBe(2);
  });
});

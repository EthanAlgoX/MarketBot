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

import {
  resolveLayerSelection,
  resolveMemoryLayer,
  resolveMemoryPriority,
  resolvePriorityExpiryMs,
} from "./memory-meta.js";

describe("memory meta", () => {
  it("resolves layered selection", () => {
    expect(resolveLayerSelection({})).toEqual(["l0", "l1", "l2"]);
    expect(resolveLayerSelection({ depth: "l0" })).toEqual(["l0"]);
    expect(resolveLayerSelection({ maxDepth: "l1" })).toEqual(["l0", "l1"]);
    expect(resolveLayerSelection({ depth: "l1", maxDepth: "l2" })).toEqual(["l1", "l2"]);
  });

  it("classifies layer by path", () => {
    expect(resolveMemoryLayer({ source: "memory", relPath: "memory/.abstract" })).toBe("l0");
    expect(resolveMemoryLayer({ source: "memory", relPath: "memory/insights/2026-02.md" })).toBe(
      "l1",
    );
    expect(resolveMemoryLayer({ source: "memory", relPath: "memory/2026-02-17.md" })).toBe("l2");
    expect(resolveMemoryLayer({ source: "sessions", relPath: "sessions/a.jsonl" })).toBe("l2");
  });

  it("classifies priority by tags and computes expiry", () => {
    const content = "# Task\nKeep this [P1]\n";
    const layer = resolveMemoryLayer({
      source: "memory",
      relPath: "memory/2026-02-17.md",
      content,
    });
    const priority = resolveMemoryPriority({
      source: "memory",
      relPath: "memory/2026-02-17.md",
      layer,
      content,
    });
    expect(priority).toBe("p1");
    const expiresAt = resolvePriorityExpiryMs({
      priority,
      referenceMs: 0,
      p1Days: 90,
      p2Days: 30,
    });
    expect(expiresAt).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

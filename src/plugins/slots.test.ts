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
import { applyExclusiveSlotSelection } from "./slots.js";

describe("applyExclusiveSlotSelection", () => {
  it("selects the slot and disables other entries for the same kind", () => {
    const config: MarketBotConfig = {
      plugins: {
        slots: { memory: "memory-core" },
        entries: {
          "memory-core": { enabled: true },
          memory: { enabled: true },
        },
      },
    };

    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "memory",
      selectedKind: "memory",
      registry: {
        plugins: [
          { id: "memory-core", kind: "memory" },
          { id: "memory", kind: "memory" },
        ],
      },
    });

    expect(result.changed).toBe(true);
    expect(result.config.plugins?.slots?.memory).toBe("memory");
    expect(result.config.plugins?.entries?.["memory-core"]?.enabled).toBe(false);
    expect(result.warnings).toContain(
      'Exclusive slot "memory" switched from "memory-core" to "memory".',
    );
    expect(result.warnings).toContain('Disabled other "memory" slot plugins: memory-core.');
  });

  it("does nothing when the slot already matches", () => {
    const config: MarketBotConfig = {
      plugins: {
        slots: { memory: "memory" },
        entries: {
          memory: { enabled: true },
        },
      },
    };

    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "memory",
      selectedKind: "memory",
      registry: { plugins: [{ id: "memory", kind: "memory" }] },
    });

    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.config).toBe(config);
  });

  it("warns when the slot falls back to a default", () => {
    const config: MarketBotConfig = {
      plugins: {
        entries: {
          memory: { enabled: true },
        },
      },
    };

    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "memory",
      selectedKind: "memory",
      registry: { plugins: [{ id: "memory", kind: "memory" }] },
    });

    expect(result.changed).toBe(true);
    expect(result.warnings).toContain(
      'Exclusive slot "memory" switched from "memory-core" to "memory".',
    );
  });

  it("skips changes when no exclusive slot applies", () => {
    const config: MarketBotConfig = {};
    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "custom",
    });

    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(0);
    expect(result.config).toBe(config);
  });
});

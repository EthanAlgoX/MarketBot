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

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempHome } from "./test-helpers.js";

describe("config compaction settings", () => {
  it("preserves memory flush config values", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".marketbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "marketbot.json"),
        JSON.stringify(
          {
            agents: {
              defaults: {
                compaction: {
                  mode: "safeguard",
                  reserveTokensFloor: 12_345,
                  memoryFlush: {
                    enabled: false,
                    softThresholdTokens: 1234,
                    prompt: "Write notes.",
                    systemPrompt: "Flush memory now.",
                  },
                },
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.agents?.defaults?.compaction?.reserveTokensFloor).toBe(12_345);
      expect(cfg.agents?.defaults?.compaction?.mode).toBe("safeguard");
      expect(cfg.agents?.defaults?.compaction?.memoryFlush?.enabled).toBe(false);
      expect(cfg.agents?.defaults?.compaction?.memoryFlush?.softThresholdTokens).toBe(1234);
      expect(cfg.agents?.defaults?.compaction?.memoryFlush?.prompt).toBe("Write notes.");
      expect(cfg.agents?.defaults?.compaction?.memoryFlush?.systemPrompt).toBe("Flush memory now.");
    });
  });

  it("defaults compaction mode to safeguard", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".marketbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "marketbot.json"),
        JSON.stringify(
          {
            agents: {
              defaults: {
                compaction: {
                  reserveTokensFloor: 9000,
                },
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();

      expect(cfg.agents?.defaults?.compaction?.mode).toBe("safeguard");
      expect(cfg.agents?.defaults?.compaction?.reserveTokensFloor).toBe(9000);
    });
  });
});

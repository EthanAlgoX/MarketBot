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

import { beforeEach, describe, expect, it, vi } from "vitest";

const readConfigFileSnapshot = vi.fn();
const writeConfigFile = vi.fn().mockResolvedValue(undefined);
const loadConfig = vi.fn().mockReturnValue({});

vi.mock("../config/config.js", () => ({
  CONFIG_PATH: "/tmp/marketbot.json",
  readConfigFileSnapshot,
  writeConfigFile,
  loadConfig,
}));

describe("models set + fallbacks", () => {
  beforeEach(() => {
    readConfigFileSnapshot.mockReset();
    writeConfigFile.mockClear();
  });

  it("normalizes z.ai provider in models set", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/marketbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {},
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    const { modelsSetCommand } = await import("./models/set.js");

    await modelsSetCommand("z.ai/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { primary: "zai/glm-4.7" },
        models: { "zai/glm-4.7": {} },
      },
    });
  });

  it("normalizes z-ai provider in models fallbacks add", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/marketbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: { agents: { defaults: { model: { fallbacks: [] } } } },
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    const { modelsFallbacksAddCommand } = await import("./models/fallbacks.js");

    await modelsFallbacksAddCommand("z-ai/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { fallbacks: ["zai/glm-4.7"] },
        models: { "zai/glm-4.7": {} },
      },
    });
  });

  it("normalizes provider casing in models set", async () => {
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/marketbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {},
      issues: [],
      legacyIssues: [],
    });

    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    const { modelsSetCommand } = await import("./models/set.js");

    await modelsSetCommand("Z.AI/glm-4.7", runtime);

    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const written = writeConfigFile.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(written.agents).toEqual({
      defaults: {
        model: { primary: "zai/glm-4.7" },
        models: { "zai/glm-4.7": {} },
      },
    });
  });
});

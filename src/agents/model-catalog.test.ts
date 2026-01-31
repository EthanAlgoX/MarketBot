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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketBotConfig } from "../config/config.js";
import {
  __setModelCatalogImportForTest,
  loadModelCatalog,
  resetModelCatalogCacheForTest,
} from "./model-catalog.js";

type PiSdkModule = typeof import("./pi-model-discovery.js");

vi.mock("./models-config.js", () => ({
  ensureMarketBotModelsJson: vi.fn().mockResolvedValue({ agentDir: "/tmp", wrote: false }),
}));

vi.mock("./agent-paths.js", () => ({
  resolveMarketBotAgentDir: () => "/tmp/marketbot",
}));

describe("loadModelCatalog", () => {
  beforeEach(() => {
    resetModelCatalogCacheForTest();
  });

  afterEach(() => {
    __setModelCatalogImportForTest();
    resetModelCatalogCacheForTest();
    vi.restoreAllMocks();
  });

  it("retries after import failure without poisoning the cache", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let call = 0;

    __setModelCatalogImportForTest(async () => {
      call += 1;
      if (call === 1) {
        throw new Error("boom");
      }
      return {
        AuthStorage: class {},
        ModelRegistry: class {
          getAll() {
            return [{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }];
          }
        },
      } as unknown as PiSdkModule;
    });

    const cfg = {} as MarketBotConfig;
    const first = await loadModelCatalog({ config: cfg });
    expect(first).toEqual([]);

    const second = await loadModelCatalog({ config: cfg });
    expect(second).toEqual([{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }]);
    expect(call).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns partial results on discovery errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    __setModelCatalogImportForTest(
      async () =>
        ({
          AuthStorage: class {},
          ModelRegistry: class {
            getAll() {
              return [
                { id: "gpt-4.1", name: "GPT-4.1", provider: "openai" },
                {
                  get id() {
                    throw new Error("boom");
                  },
                  provider: "openai",
                  name: "bad",
                },
              ];
            }
          },
        }) as unknown as PiSdkModule,
    );

    const result = await loadModelCatalog({ config: {} as MarketBotConfig });
    expect(result).toEqual([{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai" }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

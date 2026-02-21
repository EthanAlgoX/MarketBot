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

import { describe, expect, it, vi } from "vitest";

describe("web fetch strategy config", () => {
  it("accepts fetch strategy and firecrawl proxy/cache options", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      tools: {
        web: {
          fetch: {
            strategy: "race",
            readability: true,
            firecrawl: {
              enabled: true,
              proxy: "stealth",
              storeInCache: false,
            },
          },
        },
      },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects invalid fetch strategy", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      tools: {
        web: {
          fetch: {
            strategy: "parallel",
          },
        },
      },
    });
    expect(res.ok).toBe(false);
  });

  it("rejects invalid firecrawl proxy mode", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      tools: {
        web: {
          fetch: {
            firecrawl: {
              proxy: "super-stealth",
            },
          },
        },
      },
    });
    expect(res.ok).toBe(false);
  });
});

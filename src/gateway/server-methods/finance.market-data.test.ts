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

const mocks = vi.hoisted(() => ({
  loadConfigResult: {} as Record<string, unknown>,
  getQuotes: vi.fn(),
  getMarketData: vi.fn(),
  getNews: vi.fn(),
  getFundamentals: vi.fn(),
}));

vi.mock("../../config/config.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../config/config.js")>("../../config/config.js");
  return {
    ...actual,
    loadConfig: () => mocks.loadConfigResult,
  };
});

vi.mock("../../finance/client.js", () => ({
  MarketDataClient: class MarketDataClient {
    async getQuotes(...args: Parameters<typeof mocks.getQuotes>) {
      return await mocks.getQuotes(...args);
    }
    async getMarketData(...args: Parameters<typeof mocks.getMarketData>) {
      return await mocks.getMarketData(...args);
    }
    async getNews(...args: Parameters<typeof mocks.getNews>) {
      return await mocks.getNews(...args);
    }
    async getFundamentals(...args: Parameters<typeof mocks.getFundamentals>) {
      return await mocks.getFundamentals(...args);
    }
  },
}));

import { financeHandlers } from "./finance.js";

type Capture = {
  ok: boolean | null;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
};

async function invokeHandler(
  method: keyof typeof financeHandlers,
  params: Record<string, unknown>,
): Promise<Capture> {
  const capture: Capture = { ok: null, result: null, error: null };
  await financeHandlers[method]({
    req: { id: "test-1", method, params } as any,
    params,
    client: null,
    isWebchatConnect: false,
    context: {} as any,
    respond: (ok, result, error) => {
      capture.ok = ok;
      capture.result = (result ?? null) as Record<string, unknown> | null;
      capture.error = (error ?? null) as Record<string, unknown> | null;
    },
  });
  return capture;
}

describe("finance market data handlers", () => {
  beforeEach(() => {
    mocks.loadConfigResult = {};
    mocks.getQuotes.mockReset();
    mocks.getMarketData.mockReset();
    mocks.getNews.mockReset();
    mocks.getFundamentals.mockReset();
  });

  it("returns market status payload", async () => {
    const response = await invokeHandler("finance.market.status", {});
    expect(response.ok).toBe(true);
    expect(response.error).toBeNull();
    expect(response.result?.engine).toMatchObject({
      name: "market-data",
      preferredProvider: "openbb",
    });
  });

  it("returns partial snapshot with warnings instead of failing the whole request", async () => {
    mocks.getQuotes.mockRejectedValue(new Error("openbb quote failed"));
    mocks.getMarketData.mockImplementation(
      async (input: { symbol: string; timeframe?: string; limit?: number }) => {
        if (input.symbol === "MSFT") {
          throw new Error("series unavailable");
        }
        return {
          symbol: input.symbol,
          source: "yahoo",
          series: [
            { ts: 1700000000000, iso: "2023-11-14T00:00:00.000Z", close: 100 },
            { ts: 1700003600000, iso: "2023-11-14T01:00:00.000Z", close: 101 },
          ],
        };
      },
    );
    mocks.getNews.mockRejectedValue(new Error("openbb news failed"));
    mocks.getFundamentals.mockRejectedValue(new Error("openbb fundamentals failed"));

    const response = await invokeHandler("finance.market.snapshot", {
      symbols: ["AAPL", "MSFT"],
      activeSymbol: "AAPL",
      timeframe: "1mo",
      newsLimit: 2,
    });

    expect(response.ok).toBe(true);
    expect(response.error).toBeNull();
    const result = response.result as {
      items: Array<{ symbol: string; points: unknown[]; error: string | null }>;
      warnings: string[];
    };
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.symbol).toBe("AAPL");
    expect(result.items[0]?.points.length).toBeGreaterThan(0);
    expect(result.items[1]?.symbol).toBe("MSFT");
    expect(result.items[1]?.error).toContain("series unavailable");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).not.toMatch(/\bopenbb\b/i);
    expect(result.warnings.join(" ")).toContain("connector");
  });
});

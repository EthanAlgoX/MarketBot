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
  diskCache: new Map<string, { cachedAtMs: number; payload: Record<string, unknown> }>(),
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

vi.mock("../../finance/gateway-disk-cache.js", () => ({
  buildGatewayFinanceCacheKey: (scope: string, params: unknown) =>
    `${scope}:${JSON.stringify(params ?? {})}`,
  getGatewayFinanceCacheDir: () => "/tmp/marketbot-finance-cache-test",
  readGatewayFinanceCache: async (key: string, maxAgeMs: number) => {
    const hit = mocks.diskCache.get(key);
    if (!hit) {
      return null;
    }
    const ageMs = Date.now() - hit.cachedAtMs;
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
      return null;
    }
    return { payload: hit.payload, cachedAtMs: hit.cachedAtMs, ageMs };
  },
  writeGatewayFinanceCache: async (key: string, payload: Record<string, unknown>) => {
    mocks.diskCache.set(key, { cachedAtMs: Date.now(), payload });
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
    mocks.diskCache.clear();
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

  it("returns flow snapshot across multi-asset buckets", async () => {
    mocks.getQuotes.mockImplementation(async (symbols: string[]) =>
      symbols.map((symbol, index) => ({
        symbol,
        shortName: `Name-${symbol}`,
        currency: "USD",
        exchange: "TEST",
        regularMarketPrice: 100 + index,
        regularMarketChangePercent: (index + 1) / 100,
        regularMarketTime: 1700000000 + index * 60,
      })),
    );
    mocks.getNews.mockImplementation(async (params: { query: string }) => [
      {
        title: `${params.query} catalyst headline`,
        link: "https://example.com/news",
        source: "unit-test",
        pubDate: "2026-02-20",
      },
    ]);

    const response = await invokeHandler("finance.flow.snapshot", {
      topN: 5,
      locale: "US",
      reasonNewsLimit: 2,
    });

    expect(response.ok).toBe(true);
    expect(response.error).toBeNull();
    const result = response.result as {
      overview: {
        liquidityRegime: string;
        summary: string;
        metrics: unknown[];
        assetFlows: unknown[];
      };
      buckets: Array<{
        assetClass: string;
        label: string;
        items: Array<{ symbol: string; reason: string }>;
      }>;
      warnings: string[];
    };
    expect(result.overview.liquidityRegime).toBeTruthy();
    expect(result.overview.summary.length).toBeGreaterThan(0);
    expect(result.overview.metrics.length).toBeGreaterThan(0);
    expect(result.overview.assetFlows.length).toBe(3);
    expect(result.buckets.length).toBeGreaterThanOrEqual(5);
    expect(result.buckets.every((bucket) => bucket.items.length <= 5)).toBe(true);
    expect(result.buckets[0]?.items[0]?.symbol).toBeTruthy();
    expect(result.buckets[0]?.items[0]?.reason).toContain("新闻驱动");
    expect(result.warnings).toBeDefined();
  });

  it("returns seven-point flow detail analysis for a selected symbol", async () => {
    mocks.getQuotes.mockResolvedValue([
      {
        symbol: "AAPL",
        regularMarketPrice: 188.12,
        regularMarketChangePercent: 0.0123,
        regularMarketTime: 1700005000,
      },
    ]);
    mocks.getMarketData.mockResolvedValue({
      symbol: "AAPL",
      source: "yahoo",
      series: Array.from({ length: 12 }).map((_, index) => ({
        ts: 1700000000000 + index * 60_000,
        iso: new Date(1700000000000 + index * 60_000).toISOString(),
        close: 100 + index,
      })),
    });
    mocks.getNews.mockResolvedValue([
      {
        title: "Apple rally extends after earnings momentum",
        link: "https://example.com/apple",
        source: "unit-test",
        pubDate: "2026-02-20",
      },
    ]);

    const response = await invokeHandler("finance.flow.detail", {
      symbol: "AAPL",
      assetClass: "usStocks",
      locale: "US",
    });

    expect(response.ok).toBe(true);
    expect(response.error).toBeNull();
    const result = response.result as {
      symbol: string;
      points: Array<{ close: number }>;
      analysis: { trend: string; summary: string; changePercent7d: number | null };
      news: Array<{ title: string }>;
      warnings: string[];
    };
    expect(result.symbol).toBe("AAPL");
    expect(result.points).toHaveLength(7);
    expect(result.analysis.trend).toBeTruthy();
    expect(result.analysis.summary.length).toBeGreaterThan(0);
    expect(
      typeof result.analysis.changePercent7d === "number" ||
        result.analysis.changePercent7d === null,
    ).toBe(true);
    expect(result.news[0]?.title).toContain("Apple");
    expect(result.warnings).toBeDefined();
  });

  it("serves flow snapshot from disk cache on repeated requests", async () => {
    mocks.getQuotes.mockImplementation(async (symbols: string[]) =>
      symbols.map((symbol, index) => ({
        symbol,
        shortName: `Name-${symbol}`,
        currency: "USD",
        exchange: "TEST",
        regularMarketPrice: 100 + index,
        regularMarketChangePercent: 0.01,
        regularMarketTime: 1700000000 + index,
      })),
    );
    mocks.getNews.mockResolvedValue([
      {
        title: "cached-news",
        link: "https://example.com/cached-news",
      },
    ]);

    const first = await invokeHandler("finance.flow.snapshot", {
      topN: 3,
      locale: "US",
    });
    expect(first.ok).toBe(true);
    const callsAfterFirst = mocks.getQuotes.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await invokeHandler("finance.flow.snapshot", {
      topN: 3,
      locale: "US",
    });
    expect(second.ok).toBe(true);
    expect(mocks.getQuotes.mock.calls.length).toBe(callsAfterFirst);
    const secondResult = second.result as { cache?: { hit?: boolean } };
    expect(secondResult.cache?.hit).toBe(true);
  });

  it("honors cacheTtlMs override for flow snapshot responses", async () => {
    mocks.getQuotes.mockImplementation(async (symbols: string[]) =>
      symbols.map((symbol, index) => ({
        symbol,
        shortName: `Name-${symbol}`,
        currency: "USD",
        exchange: "TEST",
        regularMarketPrice: 100 + index,
        regularMarketChangePercent: 0.01,
        regularMarketTime: 1700000000 + index,
      })),
    );
    mocks.getNews.mockResolvedValue([
      {
        title: "ttl-test",
        link: "https://example.com/ttl-test",
      },
    ]);

    const response = await invokeHandler("finance.flow.snapshot", {
      topN: 3,
      locale: "US",
      cacheTtlMs: 45000,
    });

    expect(response.ok).toBe(true);
    const result = response.result as { cache?: { ttlMs?: number } };
    expect(result.cache?.ttlMs).toBe(45000);
  });
});

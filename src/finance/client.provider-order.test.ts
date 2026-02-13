import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  const registries: Array<Map<string, any>> = [];
  const createRegistry = vi.fn(() => registries.shift() ?? new Map<string, any>());
  return {
    calls,
    registries,
    createRegistry,
  };
});

vi.mock("./providers.js", () => ({
  createFinanceProviderRegistry: mocks.createRegistry,
  normalizeFinanceProviderId: (value: string) => value.trim().toLowerCase(),
}));

import { MarketDataClient } from "./client.js";

function makeProvider(params: { id: string; failMarketData?: boolean; marketSymbol?: string }) {
  return {
    id: params.id,
    label: params.id,
    capabilities: {
      marketData: true,
      quotes: true,
      fundamentals: true,
      news: true,
    },
    getMarketData: async () => {
      mocks.calls.push(params.id);
      if (params.failMarketData) {
        throw new Error(`${params.id} failed`);
      }
      return {
        symbol: params.marketSymbol ?? params.id.toUpperCase(),
        source: "unknown" as const,
        series: [
          {
            ts: 1_700_000_000_000,
            iso: "2026-02-01T00:00:00.000Z",
            close: 100,
          },
        ],
      };
    },
    getQuotes: async () => {
      mocks.calls.push(`quote:${params.id}`);
      return [];
    },
  };
}

describe("MarketDataClient provider order", () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    mocks.registries.length = 0;
    mocks.createRegistry.mockClear();
  });

  it("prioritizes explicit provider before providerOrder", async () => {
    mocks.registries.push(
      new Map<string, any>([
        ["alpha", makeProvider({ id: "alpha", marketSymbol: "ALPHA" })],
        ["beta", makeProvider({ id: "beta", marketSymbol: "BETA" })],
      ]),
    );

    const client = new MarketDataClient({
      provider: "beta",
      providerOrder: ["alpha"],
      cacheTtlMs: 0,
    });

    const result = await client.getMarketData({ symbol: "aapl", timeframe: "6mo" });

    expect(result.symbol).toBe("BETA");
    expect(mocks.calls).toEqual(["beta"]);
  });

  it("falls back to next provider when first fails", async () => {
    mocks.registries.push(
      new Map<string, any>([
        ["primary", makeProvider({ id: "primary", failMarketData: true })],
        ["secondary", makeProvider({ id: "secondary", marketSymbol: "SECONDARY" })],
      ]),
    );

    const client = new MarketDataClient({
      providerOrder: ["primary", "secondary"],
      cacheTtlMs: 0,
    });

    const result = await client.getMarketData({ symbol: "msft", timeframe: "6mo" });

    expect(result.symbol).toBe("SECONDARY");
    expect(mocks.calls).toEqual(["primary", "secondary"]);
  });

  it("auto-prioritizes openbb when connected and no provider is explicitly set", async () => {
    mocks.registries.push(
      new Map<string, any>([
        ["openbb", makeProvider({ id: "openbb", marketSymbol: "OPENBB" })],
        ["yahoo", makeProvider({ id: "yahoo", marketSymbol: "YAHOO" })],
      ]),
    );

    const client = new MarketDataClient({ cacheTtlMs: 0 });
    const result = await client.getMarketData({ symbol: "nvda", timeframe: "6mo" });

    expect(result.symbol).toBe("OPENBB");
    expect(mocks.calls).toEqual(["openbb"]);
  });
});

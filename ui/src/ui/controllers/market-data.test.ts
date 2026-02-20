import { describe, expect, it, vi } from "vitest";

import {
  applyMag7Preset,
  loadMarketDataStatus,
  runMarketDataSnapshot,
  type MarketDataState,
} from "./market-data";

function createState(overrides: Partial<MarketDataState> = {}): MarketDataState {
  return {
    client: null,
    connected: true,
    marketDataLoading: false,
    marketDataError: null,
    marketDataSymbolsText: "",
    marketDataTimeframe: "6mo",
    marketDataNewsLimit: "5",
    marketDataActiveSymbol: "AAPL",
    marketDataStatus: null,
    marketDataSnapshot: null,
    ...overrides,
  };
}

describe("market-data controller", () => {
  it("applies magnificent seven preset", () => {
    const state = createState({
      marketDataSymbolsText: "TSM\nAMD",
      marketDataActiveSymbol: "TSM",
    });
    applyMag7Preset(state);
    expect(state.marketDataSymbolsText).toContain("AAPL");
    expect(state.marketDataSymbolsText).toContain("TSLA");
    expect(state.marketDataActiveSymbol).toBe("AAPL");
  });

  it("loads status and snapshot with empty symbols fallback", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "finance.market.snapshot") {
        return {
          nowIso: "2026-02-20T00:00:00.000Z",
          symbols: ["AAPL", "MSFT"],
          timeframe: "6mo",
          locale: "US",
          provider: "openbb",
          activeSymbol: "AAPL",
          items: [],
          news: [],
          fundamentals: { symbol: "AAPL" },
          warnings: [],
        };
      }
      if (method === "finance.market.status") {
        return {
          nowIso: "2026-02-20T00:00:01.000Z",
          engine: { name: "market-data" },
        };
      }
      return {};
    });
    const state = createState({
      client: {
        request,
      } as any,
      marketDataSymbolsText: "",
      marketDataActiveSymbol: "NVDA",
    });

    await runMarketDataSnapshot(state);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe("finance.market.snapshot");
    expect(request.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"],
        activeSymbol: "NVDA",
      }),
    );
    expect(request.mock.calls[1]).toEqual(["finance.market.status", {}]);
    expect(state.marketDataSnapshot?.activeSymbol).toBe("AAPL");
    expect(state.marketDataStatus?.engine?.name).toBe("market-data");
    expect(state.marketDataLoading).toBe(false);
  });

  it("records errors and clears loading when request fails", async () => {
    const state = createState({
      client: {
        request: vi.fn(async () => {
          throw new Error("network failed");
        }),
      } as any,
    });

    await runMarketDataSnapshot(state);

    expect(state.marketDataLoading).toBe(false);
    expect(state.marketDataError).toContain("network failed");
  });

  it("loads market status independently", async () => {
    const state = createState({
      client: {
        request: vi.fn(async () => ({
          nowIso: "2026-02-20T00:00:00.000Z",
          engine: { name: "market-data", preferredProvider: "openbb" },
        })),
      } as any,
    });
    await loadMarketDataStatus(state);
    expect(state.marketDataStatus?.engine?.preferredProvider).toBe("openbb");
  });
});

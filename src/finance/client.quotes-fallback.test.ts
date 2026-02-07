import { describe, expect, it, vi } from "vitest";

vi.mock("./browser-client.js", () => ({
  fetchTextWithBrowser: vi.fn(async () => {
    throw new Error("network fail");
  }),
}));

import { MarketDataClient } from "./client.js";
import type { MarketSeries } from "./types.js";

describe("finance client quotes fallback", () => {
  it("does not throw when fallback series has no closes", async () => {
    const client = new MarketDataClient({ cacheTtlMs: 0 });
    (
      client as unknown as {
        getMarketData: (p: {
          symbol: string;
          timeframe?: string;
          limit?: number;
        }) => Promise<MarketSeries>;
      }
    ).getMarketData = async () => ({
      symbol: "00700.HK",
      source: "yahoo",
      series: [{ ts: 1_700_000_000_000, iso: "2026-02-07T00:00:00.000Z" }],
    });

    const quotes = await client.getQuotes(["00700.HK"]);
    expect(quotes[0]?.symbol).toBe("00700.HK");
    expect(quotes[0]?.regularMarketPrice).toBeUndefined();
  });
});

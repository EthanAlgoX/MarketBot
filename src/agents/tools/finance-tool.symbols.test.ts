import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFinanceTool } from "./finance-tool.js";

const { quoteCalls, marketDataCalls } = vi.hoisted(() => ({
  quoteCalls: [] as string[][],
  marketDataCalls: [] as string[],
}));

vi.mock("../../finance/client.js", () => {
  class MarketDataClient {
    async getQuotes(symbols: string[]) {
      quoteCalls.push(symbols);
      return symbols.map((symbol) => ({ symbol, regularMarketPrice: 100 }));
    }

    async getMarketData(params: { symbol: string }) {
      marketDataCalls.push(params.symbol);
      return {
        symbol: params.symbol,
        source: "yahoo",
        series: [],
      };
    }
  }
  return { MarketDataClient };
});

describe("finance tool symbol parsing", () => {
  beforeEach(() => {
    quoteCalls.length = 0;
    marketDataCalls.length = 0;
  });

  it("splits comma-separated symbol input for quote", async () => {
    const tool = createFinanceTool();
    const result = await tool.execute("call", {
      action: "quote",
      symbol: "AAPL, MSFT，NVDA",
    });

    expect(quoteCalls).toEqual([["AAPL", "MSFT", "NVDA"]]);
    expect(result.details).toMatchObject({
      symbols: ["AAPL", "MSFT", "NVDA"],
    });
  });

  it("accepts multi-symbol market_data via symbols array", async () => {
    const tool = createFinanceTool();
    const result = await tool.execute("call", {
      action: "market_data",
      symbols: ["AAPL,MSFT", "NVDA"],
    });

    expect(marketDataCalls).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(result.details).toMatchObject({
      symbols: ["AAPL", "MSFT", "NVDA"],
      series: [{ symbol: "AAPL" }, { symbol: "MSFT" }, { symbol: "NVDA" }],
    });
  });
});

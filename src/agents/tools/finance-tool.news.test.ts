import { describe, expect, it, vi } from "vitest";

import { createFinanceTool } from "./finance-tool.js";

vi.mock("../../finance/client.js", () => {
  class MarketDataClient {
    async getNews(params: { query: string }) {
      return [{ title: `q=${params.query}` }];
    }
  }
  return { MarketDataClient };
});

describe("finance tool: news", () => {
  it("accepts symbol as query fallback", async () => {
    const tool = createFinanceTool();
    const res = await tool.execute("call", { action: "news", symbol: "XAUUSD=X" });
    expect(res.details).toMatchObject({
      query: "XAUUSD=X",
      items: [{ title: "q=XAUUSD=X" }],
    });
  });
});

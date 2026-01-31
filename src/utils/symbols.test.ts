import { describe, expect, it } from "vitest";

import { normalizeYahooSymbol, resolveSymbolFromText } from "./symbols.js";

describe("symbol helpers", () => {
  it("resolves Chinese company names", () => {
    expect(resolveSymbolFromText("分析谷歌股票")).toBe("GOOGL");
    expect(resolveSymbolFromText("看一下苹果走势")).toBe("AAPL");
  });

  it("resolves explicit tickers", () => {
    expect(resolveSymbolFromText("GOOGL short-term view")).toBe("GOOGL");
  });

  it("normalizes Yahoo crypto symbols", () => {
    expect(normalizeYahooSymbol("btc")).toBe("BTC-USD");
    expect(normalizeYahooSymbol("ETH")).toBe("ETH-USD");
  });
});

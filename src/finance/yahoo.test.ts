import { describe, expect, it } from "vitest";
import {
  normalizeYahooSymbol,
  parseYahooChart,
  parseYahooJsonFromText,
  parseYahooQuotes,
} from "./yahoo.js";

describe("finance yahoo", () => {
  it("normalizes symbols", () => {
    expect(normalizeYahooSymbol("btc/usd")).toBe("BTC-USD");
    expect(normalizeYahooSymbol("eurusd")).toBe("EURUSD=X");
    expect(normalizeYahooSymbol("^GSPC")).toBe("^GSPC");
  });

  it("parses chart data", () => {
    const json = {
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              currency: "USD",
              exchangeName: "NMS",
              timezone: "America/New_York",
              regularMarketPrice: 180,
              regularMarketTime: 1700000000,
            },
            timestamp: [1700000000, 1700003600],
            indicators: {
              quote: [
                {
                  open: [179, 180],
                  high: [181, 182],
                  low: [178, 179],
                  close: [180, 181],
                  volume: [1000, 1500],
                },
              ],
            },
          },
        ],
      },
    };

    const series = parseYahooChart(json);
    expect(series.symbol).toBe("AAPL");
    expect(series.series).toHaveLength(2);
    expect(series.series[0].open).toBe(179);
  });

  it("parses json from text", () => {
    const text = 'noise {"ok":true} trailing';
    const parsed = parseYahooJsonFromText(text) as { ok: boolean };
    expect(parsed.ok).toBe(true);
  });

  it("parses quotes", () => {
    const json = {
      quoteResponse: {
        result: [
          {
            symbol: "AAPL",
            shortName: "Apple",
            currency: "USD",
            regularMarketPrice: 180,
            regularMarketChange: 2,
            regularMarketChangePercent: 1.1,
            regularMarketTime: 1700000000,
            marketState: "CLOSED",
          },
        ],
      },
    };
    const quotes = parseYahooQuotes(json);
    expect(quotes[0].symbol).toBe("AAPL");
    expect(quotes[0].regularMarketPrice).toBe(180);
  });
});

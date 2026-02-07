import { describe, expect, it } from "vitest";
import { parseStooqDailyCsv, parseStooqQuoteFromDailyCsv, resolveStooqSymbol } from "./stooq.js";

describe("finance stooq", () => {
  it("resolves US equity symbols", () => {
    expect(resolveStooqSymbol("AAPL")).toBe("aapl.us");
    expect(resolveStooqSymbol("msft")).toBe("msft.us");
    expect(resolveStooqSymbol("^GSPC")).toBeNull();
  });

  it("parses daily CSV rows", () => {
    const csv = `Date,Open,High,Low,Close,Volume
2026-01-02,100,110,95,105,12345
2026-01-03,105,112,101,111,23456
`;
    const series = parseStooqDailyCsv(csv, "AAPL");
    expect(series.symbol).toBe("AAPL");
    expect(series.series).toHaveLength(2);
    expect(series.series[0].close).toBe(105);
  });

  it("derives a quote from latest close", () => {
    const csv = `Date,Open,High,Low,Close,Volume
2026-01-02,100,110,95,105,12345
2026-01-03,105,112,101,111,23456
`;
    const quote = parseStooqQuoteFromDailyCsv(csv, "AAPL");
    expect(quote.symbol).toBe("AAPL");
    expect(quote.regularMarketPrice).toBe(111);
    expect(quote.regularMarketChange).toBe(6);
    expect(quote.regularMarketChangePercent).toBeCloseTo(6 / 105);
  });
});

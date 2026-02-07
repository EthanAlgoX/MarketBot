import { describe, expect, it } from "vitest";

import { summarizeLocalFile } from "./file-summary.js";

describe("summarizeLocalFile", () => {
  it("summarizes a csv file", async () => {
    const summary = await summarizeLocalFile({
      filePath: "example/portfolio_holdings.csv",
      cwd: process.cwd(),
    });
    expect(summary.type).toBe("csv");
    expect(summary.csv?.rows).toBeGreaterThan(0);
    expect(summary.csv?.columns.length).toBeGreaterThan(0);
    expect(summary.csv?.portfolio?.uniqueSymbols).toBeGreaterThan(0);
  });

  it("adds numeric + time series summaries when a date column exists", async () => {
    const summary = await summarizeLocalFile({
      filePath: "example/market_indices.csv",
      cwd: process.cwd(),
    });
    expect(summary.type).toBe("csv");
    expect(summary.csv?.numericProfile?.length).toBeGreaterThan(0);
    expect(summary.csv?.timeSeries?.dateColumn).toBe("日期");
    expect(summary.csv?.timeSeries?.changes.length).toBeGreaterThan(0);
  });
});

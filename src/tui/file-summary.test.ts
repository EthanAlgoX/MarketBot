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
});

import { describe, expect, it } from "vitest";
import { resolveYahooRange } from "./timeframe.js";

describe("finance timeframe", () => {
  it("maps intraday intervals", () => {
    expect(resolveYahooRange("1m")).toEqual({ range: "1d", interval: "1m" });
    expect(resolveYahooRange("1d")).toEqual({ range: "1d", interval: "5m" });
  });

  it("maps longer ranges", () => {
    expect(resolveYahooRange("6mo")).toEqual({ range: "6mo", interval: "1d" });
    expect(resolveYahooRange("1y")).toEqual({ range: "1y", interval: "1d" });
  });
});

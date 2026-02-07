import { describe, expect, it } from "vitest";
import { buildComparison } from "./compare.js";
import type { MarketSeries } from "./types.js";

function series(symbol: string, closes: number[]): MarketSeries {
  return {
    symbol,
    source: "unknown",
    series: closes.map((close, i) => ({
      ts: 1700000000 + i * 60,
      iso: `t${i}`,
      close,
    })),
  };
}

describe("finance compare", () => {
  it("builds correlation matrix and per-asset summaries", () => {
    const a = series("AAA", [100, 110, 99, 120, 115]);
    const b = series("BBB", [50, 55, 49.5, 60, 57.5]);
    const bench = series("SPY", [100, 103, 101, 104, 106]);

    const result = buildComparison({ series: [a, b], timeframe: "6mo", benchmark: bench });
    expect(result.assets).toHaveLength(2);
    expect(result.correlation?.symbols).toEqual(["AAA", "BBB"]);
    expect(result.correlation?.matrix).toHaveLength(2);
    expect(result.correlation?.matrix[0]).toHaveLength(2);

    const aaa = result.assets.find((x) => x.symbol === "AAA")!;
    expect(aaa.points).toBe(5);
    expect(aaa.latestClose).toBe(115);
    expect(aaa.periodReturnPercent).toBeTypeOf("number");
    expect(aaa.beta).toBeTypeOf("number");
  });
});

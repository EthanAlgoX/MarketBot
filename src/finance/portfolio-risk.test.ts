import { describe, expect, it } from "vitest";
import { buildPortfolioRisk } from "./portfolio-risk.js";
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

describe("finance portfolio risk", () => {
  it("computes basic portfolio risk metrics and contributions", () => {
    const a = series("AAA", [100, 110, 99, 120, 115, 125]);
    const b = series("BBB", [50, 55, 49.5, 60, 57.5, 62.5]);
    const bench = series("SPY", [100, 101, 99, 102, 103, 104]);

    const seriesBySymbol = new Map<string, MarketSeries>([
      ["AAA", a],
      ["BBB", b],
    ]);
    const weights = new Map<string, number>([
      ["AAA", 0.6],
      ["BBB", 0.4],
    ]);

    const result = buildPortfolioRisk({
      seriesBySymbol,
      weights,
      timeframe: "6mo",
      benchmark: bench,
    });

    expect(result.positions).toHaveLength(2);
    expect(result.volatility).toBeTypeOf("number");
    expect(result.maxDrawdown).toBeTypeOf("number");
    expect(result.valueAtRisk95).toBeTypeOf("number");
    expect(result.beta).toBeTypeOf("number");
    expect(result.contributions?.length).toBe(2);

    const pctSum = (result.contributions ?? []).reduce(
      (acc, c) => acc + (c.riskContributionPercent ?? 0),
      0,
    );
    expect(pctSum).toBeGreaterThan(99);
    expect(pctSum).toBeLessThan(101);
  });
});

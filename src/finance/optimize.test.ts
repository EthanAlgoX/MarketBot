import { describe, expect, it } from "vitest";
import { buildMinVarianceWeights } from "./optimize.js";
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

describe("finance optimize", () => {
  it("allocates more weight to lower variance asset (min variance)", () => {
    const lowVar = series("LOW", [100, 100.5, 101, 101.5, 102, 102.5, 103, 103.5]);
    const highVar = series("HIGH", [100, 110, 90, 120, 80, 115, 85, 105]);

    const seriesBySymbol = new Map<string, MarketSeries>([
      ["LOW", lowVar],
      ["HIGH", highVar],
    ]);

    const weights = buildMinVarianceWeights({ seriesBySymbol, symbols: ["LOW", "HIGH"] });
    const wLow = weights.get("LOW")!;
    const wHigh = weights.get("HIGH")!;

    expect(wLow + wHigh).toBeCloseTo(1, 10);
    expect(wLow).toBeGreaterThan(wHigh);
  });
});

import { describe, expect, it } from "vitest";
import { beta, correlation, returnsFromCloses, sharpeRatio, stdev, variance } from "./stats.js";

describe("finance stats", () => {
  it("computes returns from closes", () => {
    expect(returnsFromCloses([100, 110, 99]).map((v) => Number(v.toFixed(6)))).toEqual([0.1, -0.1]);
  });

  it("computes variance/stdev", () => {
    const v = variance([1, 2, 3, 4]);
    expect(v).toBeDefined();
    expect(stdev([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(v!), 12);
  });

  it("computes correlation for proportional series", () => {
    const a = [0.1, -0.1, 0.2, 0.05];
    const b = a.map((v) => v * 2);
    expect(correlation(a, b)).toBeCloseTo(1, 8);
  });

  it("computes beta vs benchmark", () => {
    const benchmark = [0.02, -0.01, 0.03, 0.0, 0.01];
    const asset = benchmark.map((v) => v * 1.5);
    expect(beta(asset, benchmark)).toBeCloseTo(1.5, 8);
  });

  it("computes sharpe ratio for positive mean returns", () => {
    const returns = [0.01, 0.02, -0.005, 0.015, 0.0];
    const sharpe = sharpeRatio(returns, 252);
    expect(sharpe).toBeTypeOf("number");
    expect(sharpe!).toBeGreaterThan(0);
  });
});

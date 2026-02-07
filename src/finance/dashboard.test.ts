import { describe, expect, it } from "vitest";

import { analyzeRisk, analyzeTechnicals } from "./analysis.js";
import { buildDecisionDashboard } from "./dashboard.js";
import type { MarketSeries, Quote } from "./types.js";

function makeSeries(params: { symbol: string; closes: number[]; startTs: number }): MarketSeries {
  const points = params.closes.map((close, idx) => {
    const ts = params.startTs + idx * 86_400_000;
    return {
      ts,
      iso: new Date(ts).toISOString(),
      open: close,
      high: close,
      low: close,
      close,
      volume: 1_000_000,
    };
  });
  return { symbol: params.symbol, source: "unknown", series: points };
}

describe("finance dashboard", () => {
  it("labels an uptrend near MA as buy", () => {
    // Upward drift with enough points for MAs.
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i * 0.2);
    const series = makeSeries({ symbol: "TEST", closes, startTs: Date.UTC(2026, 0, 1) });
    const technicals = analyzeTechnicals(series, "6mo");
    const risk = analyzeRisk(series, "6mo");
    const quote: Quote = {
      symbol: "TEST",
      currency: "USD",
      exchange: "NMS",
      regularMarketPrice: closes.at(-1),
      regularMarketTime: Date.UTC(2026, 1, 1),
    };
    const dash = buildDecisionDashboard({
      symbol: "TEST",
      series,
      quote,
      technicals,
      risk,
      news: [],
    });
    expect(dash.symbol).toBe("TEST");
    expect(["buy", "watch", "sell"]).toContain(dash.level);
    // Should not crash and should have a one-sentence summary.
    expect(dash.oneSentence.length).toBeGreaterThan(5);
  });

  it("tends to sell in a clear downtrend", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 200 - i * 1.5);
    const series = makeSeries({ symbol: "DOWN", closes, startTs: Date.UTC(2026, 0, 1) });
    const technicals = analyzeTechnicals(series, "6mo");
    const risk = analyzeRisk(series, "6mo");
    const dash = buildDecisionDashboard({
      symbol: "DOWN",
      series,
      quote: { symbol: "DOWN", regularMarketPrice: closes.at(-1) },
      technicals,
      risk,
      news: [],
    });
    expect(dash.level).toBe("sell");
  });
});

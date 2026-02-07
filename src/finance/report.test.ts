import { describe, expect, it } from "vitest";

import { buildDecisionDashboard } from "./dashboard.js";
import { analyzeRisk, analyzeTechnicals } from "./analysis.js";
import type { MarketSeries, Quote } from "./types.js";
import { buildEquityResearchReport, formatEquityResearchReportMarkdown } from "./report.js";

function mkSeries(symbol: string, closes: number[]): MarketSeries {
  return {
    symbol,
    source: "test",
    series: closes.map((close, idx) => ({
      ts: 1_700_000_000_000 + idx * 86_400_000,
      iso: new Date(1_700_000_000_000 + idx * 86_400_000).toISOString(),
      close,
      open: close,
      high: close,
      low: close,
      volume: 1000,
    })),
  };
}

describe("finance report", () => {
  it("formats a research-style markdown report", () => {
    const series = mkSeries("NVDA", [10, 10.5, 10.25, 10.8, 11, 11.5, 11.3, 12]);
    const quote: Quote = {
      symbol: "NVDA",
      currency: "USD",
      regularMarketPrice: 12,
      regularMarketTime: Date.parse("2026-02-07T00:00:00.000Z"),
    };
    const technicals = analyzeTechnicals(series, "6mo");
    const risk = analyzeRisk(series, "6mo");
    const dash = buildDecisionDashboard({
      symbol: "NVDA",
      series,
      quote,
      technicals,
      risk,
      news: [],
    });
    const report = buildEquityResearchReport({
      symbol: "NVDA",
      timeframe: "6mo",
      series,
      quote,
      technicals,
      risk,
      dashboard: dash,
      news: [],
    });

    const md = formatEquityResearchReportMarkdown(report, { reportType: "simple" });
    expect(md).toContain("NVDA");
    expect(md).toContain("价格表现");
    expect(md).toContain("交易计划");
    expect(md).toContain("技术面");
    expect(md).toContain("风险");
  });
});

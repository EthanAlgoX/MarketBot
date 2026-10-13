import { describe, expect, it } from "vitest";
import { localIntelligenceDate, matchIntelligence } from "./intelligence-match.js";

describe("financial topic matching", () => {
  it("matches the author's bitcoin topic and rejects unrelated posts", () => {
    const subscription = {
      includeTerms: ["bitcoin", "比特币", "BTC"],
      excludeTerms: ["广告", "sponsored"],
    };
    expect(
      matchIntelligence({ title: "Bitcoin custody", excerpt: "BTC research" }, subscription),
    ).toEqual(["bitcoin", "BTC"]);
    expect(matchIntelligence({ title: "My hiking trip", excerpt: "photos" }, subscription)).toEqual(
      [],
    );
    expect(
      matchIntelligence({ title: "Bitcoin sponsored promotion", excerpt: "" }, subscription),
    ).toEqual([]);
  });
  it("does not confuse a ticker with a longer asset symbol and handles Chinese topics", () => {
    expect(
      matchIntelligence(
        { title: "BTCST", excerpt: "" },
        { includeTerms: ["BTC"], excludeTerms: [] },
      ),
    ).toEqual([]);
    expect(
      matchIntelligence(
        { title: "国内半导体行业公告", excerpt: "" },
        { includeTerms: ["半导体"], excludeTerms: [] },
      ),
    ).toEqual(["半导体"]);
  });
  it("uses the user's local calendar date across the UTC day boundary", () => {
    expect(localIntelligenceDate(new Date("2026-10-11T20:00:00Z"), "Asia/Shanghai")).toBe(
      "2026-10-12",
    );
    expect(localIntelligenceDate(new Date("2026-10-11T20:00:00Z"), "America/New_York")).toBe(
      "2026-10-11",
    );
  });
});

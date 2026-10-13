import type { IntelligenceRecommendation } from "@marketbot/contracts";
import { describe, expect, it } from "vitest";
import { groupIntelligenceEvents, intelligenceArticleUrl } from "./intelligence-events.js";
import { previewIntelligenceMatch } from "./intelligence-match.js";

const item = (
  id: string,
  sourceId: string,
  values: Partial<IntelligenceRecommendation> = {},
): IntelligenceRecommendation => ({
  id,
  sourceId,
  sourceName: sourceId,
  title: "Bitcoin custody update",
  excerpt: "BTC",
  url: `https://news.example/${id}`,
  author: null,
  publishedAt: "2026-10-12T01:00:00Z",
  firstSeenAt: "2026-10-12T03:00:00Z",
  reason: "BTC",
  matchedTerms: ["BTC"],
  contentRevision: 1,
  feedback: "unread",
  ...values,
});

describe("conservative financial event candidates", () => {
  it("removes tracking only and preserves meaningful article queries", () => {
    expect(
      intelligenceArticleUrl("https://news.example/read?id=12&utm_source=rss&fbclid=x#part"),
    ).toBe("https://news.example/read?id=12");
    const groups = groupIntelligenceEvents([
      item("a", "one", { url: "https://news.example/read?id=12&utm_source=rss" }),
      item("b", "two", {
        url: "https://news.example/read?id=12#part",
        title: "Different copied headline",
      }),
      item("c", "three", { url: "https://news.example/read?id=13", title: "Other article" }),
    ]);
    expect(groups[0]).toMatchObject({
      basis: "same_article_url",
      association: "candidate",
      recommendationIds: ["a", "b"],
      sourceIds: ["one", "two"],
    });
    expect(groups[1]?.recommendationIds).toEqual(["c"]);
  });
  it("associates exact same UTC-day titles from different sources without semantic inference", () => {
    const groups = groupIntelligenceEvents([
      item("a", "one"),
      item("b", "two", {
        title: "Ｂｉｔｃｏｉｎ  custody update",
        publishedAt: "2026-10-12T09:00:00+08:00",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.basis).toBe("exact_title_utc_day");
  });
  it("never joins recurring, undated, merely similar or same-source titles", () => {
    const input = [
      item("a", "one"),
      item("b", "one"),
      item("c", "two", { publishedAt: "2026-10-13T01:00:00Z" }),
      item("d", "three", { publishedAt: null }),
      item("e", "four", { title: "Bitcoin custody update 2" }),
    ];
    const groups = groupIntelligenceEvents(input);
    expect(groups).toHaveLength(5);
    expect(groups.every((group) => group.basis === "single")).toBe(true);
    expect(groups.flatMap((group) => group.recommendationIds).sort()).toEqual(
      input.map((entry) => entry.id).sort(),
    );
  });
  it("keeps term boundaries and exclusion priority in the shared three-state matcher", () => {
    const rule = { includeTerms: ["BTC"], excludeTerms: ["sponsored"] };
    expect(previewIntelligenceMatch({ title: "BTC custody", excerpt: "" }, rule).status).toBe(
      "matched",
    );
    expect(previewIntelligenceMatch({ title: "BTC sponsored", excerpt: "" }, rule)).toEqual({
      status: "excluded",
      matchedTerms: ["BTC"],
      excludedTerms: ["sponsored"],
    });
    expect(previewIntelligenceMatch({ title: "BTCST", excerpt: "" }, rule).status).toBe("review");
  });
});

import { randomUUID } from "node:crypto";
import { createDb } from "@marketbot/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IntelligenceService } from "./intelligence-service.js";

const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("owned cached previews and immutable grouped PostgreSQL archives", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const userId = `news-preview-${randomUUID()}`;
  const foreignId = `${userId}-foreign`;
  const feed = vi.fn();
  const service = new IntelligenceService(prisma, feed);
  let sourceId = "";
  const rule = { sourceId: null, includeTerms: ["BTC"], excludeTerms: ["sponsored"] };
  beforeAll(async () => {
    for (const id of [userId, foreignId])
      await prisma.user.create({ data: { id, name: "Fixture", email: `${id}@example.test` } });
    for (const owner of [userId, foreignId]) {
      const source = await prisma.intelligenceSource.create({
        data: {
          userId: owner,
          name: owner === userId ? "First source" : "Foreign private source",
          kind: "market",
          url: `https://example.test/${owner}`,
          status: "ok",
          lastSuccessAt: new Date(),
        },
      });
      if (owner === userId) sourceId = source.id;
      for (const [key, title] of [
        ["match", "BTC custody"],
        ["exclude", "BTC sponsored"],
        ["review", "BTCST token"],
      ]) {
        const content = await prisma.intelligenceContent.create({
          data: {
            sourceId: source.id,
            sourceName: source.name,
            externalKey: key!,
            hash: key!,
            revision: 1,
            title: title!,
            excerpt: "Public RSS excerpt",
            url: `https://example.test/${key}`,
            publishedAt: new Date("2026-10-12T01:00:00Z"),
            firstSeenAt: new Date(),
          },
        });
        if (owner === userId && key === "match")
          await prisma.intelligenceRecommendation.create({
            data: {
              userId,
              contentId: content.id,
              subscriptionSnapshot: [],
              reason: "Fixture topic",
              matchedTerms: ["BTC"],
            },
          });
      }
    }
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, foreignId] } } });
    await prisma.$disconnect();
    await pool.end();
  });
  it("returns real stored matched/excluded/review samples without writes or HTTP", async () => {
    const before = await prisma.intelligenceRecommendation.count({ where: { userId } });
    const preview = await service.previewSubscription(userId, rule);
    expect(preview.coverage).toMatchObject({
      status: "available",
      sampleCount: 3,
      truncated: false,
    });
    expect(preview.samples.map((sample) => sample.status).sort()).toEqual([
      "excluded",
      "matched",
      "review",
    ]);
    expect(preview.sources.map((source) => source.name)).toEqual(["First source"]);
    expect(feed).not.toHaveBeenCalled();
    expect(await prisma.intelligenceRecommendation.count({ where: { userId } })).toBe(before);
    expect(await prisma.intelligenceSubscription.count({ where: { userId } })).toBe(0);
  });
  it("conceals foreign source IDs and distinguishes uncollected and failed coverage", async () => {
    await expect(
      service.previewSubscription(foreignId, { ...rule, sourceId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const pending = await prisma.intelligenceSource.create({
      data: {
        userId,
        name: "Not yet captured",
        kind: "author",
        url: `https://example.test/pending/${userId}`,
      },
    });
    expect(
      (await service.previewSubscription(userId, { ...rule, sourceId: pending.id })).coverage,
    ).toMatchObject({ status: "unavailable", uncollectedSourceCount: 1, sampleCount: 0 });
    await prisma.intelligenceSource.update({ where: { id: sourceId }, data: { status: "failed" } });
    expect((await service.previewSubscription(userId, { ...rule, sourceId })).coverage.status).toBe(
      "partial",
    );
  });
  it("stores group decisions in the new archive envelope and never regroups old editions", async () => {
    const source = await prisma.intelligenceSource.create({
      data: {
        userId,
        name: "Second source",
        kind: "market",
        url: `https://example.test/second/${userId}`,
        status: "ok",
        lastSuccessAt: new Date(),
      },
    });
    const content = await prisma.intelligenceContent.create({
      data: {
        sourceId: source.id,
        sourceName: source.name,
        externalKey: "other-report",
        hash: "other-report",
        revision: 1,
        title: "BTC custody",
        excerpt: "Different public source",
        url: "https://example.test/other-report",
        publishedAt: new Date("2026-10-12T04:00:00Z"),
        firstSeenAt: new Date(),
      },
    });
    await prisma.intelligenceRecommendation.create({
      data: {
        userId,
        contentId: content.id,
        subscriptionSnapshot: [],
        reason: "Fixture topic",
        matchedTerms: ["BTC"],
      },
    });
    const brief = await service.publishBrief(userId, new Date(Date.now() + 1000));
    expect(brief.grouping?.groups).toHaveLength(1);
    expect(brief.grouping?.groups[0]?.sourceNames).toEqual(
      expect.arrayContaining(["First source", "Second source"]),
    );
    const stored = (await prisma.intelligenceBrief.findUniqueOrThrow({ where: { id: brief.id } }))
      .snapshot;
    expect(stored).toMatchObject({
      snapshotVersion: 1,
      grouping: { algorithmVersion: "exact-link-or-title-utc-v1" },
    });
    await service.feedback(userId, brief.items[0]!.id, "useful");
    expect((await service.list(userId)).briefs.find((entry) => entry.id === brief.id)).toEqual(
      brief,
    );
    expect(
      (await prisma.intelligenceBrief.findUniqueOrThrow({ where: { id: brief.id } })).snapshot,
    ).toEqual(stored);
    const legacy = await prisma.intelligenceBrief.create({
      data: {
        userId,
        date: "2026-10-01",
        timezone: "UTC",
        snapshot: brief.items,
        windowStart: new Date("2026-10-01T00:00:00Z"),
        windowEnd: new Date("2026-10-02T00:00:00Z"),
        totalCount: brief.items.length,
      },
    });
    const view = (await service.list(userId)).briefs.find((entry) => entry.id === legacy.id);
    expect(view?.items).toEqual(brief.items);
    expect(view?.grouping).toBeNull();
    expect(
      (await prisma.intelligenceBrief.findUniqueOrThrow({ where: { id: legacy.id } })).snapshot,
    ).toEqual(brief.items);
  });
  it("bounds the cache scan, reports truncation, and chooses the latest captured revision", async () => {
    const now = new Date();
    await prisma.intelligenceContent.createMany({
      data: Array.from({ length: 102 }, (_, index) => ({
        sourceId,
        sourceName: "First source",
        externalKey: `bounded-${index}`,
        hash: `bounded-${index}`,
        revision: 1,
        title: "BTC sample",
        excerpt: "RSS only",
        url: `https://example.test/bounded/${index}`,
        firstSeenAt: now,
        capturedAt: new Date(now.getTime() + index),
      })),
    });
    await prisma.intelligenceContent.create({
      data: {
        sourceId,
        sourceName: "First source",
        externalKey: "bounded-101",
        hash: "bounded-revision",
        revision: 2,
        title: "BTC sample updated",
        excerpt: "RSS only",
        url: "https://example.test/bounded/101",
        firstSeenAt: now,
        capturedAt: new Date(now.getTime() + 200),
      },
    });
    const preview = await service.previewSubscription(userId, { ...rule, sourceId });
    expect(preview.coverage).toMatchObject({
      scannedRevisionCount: 100,
      sampleCount: 99,
      truncated: true,
    });
    expect(preview.samples[0]).toMatchObject({ title: "BTC sample updated", contentRevision: 2 });
    expect(preview.samples.filter((sample) => sample.url.endsWith("/101"))).toHaveLength(1);
  });
  it("exposes an honest bounded retention policy without deleting archives", async () => {
    const view = await service.list(userId);
    expect(view.retentionPolicy).toMatchObject({
      excerptCharacters: 500,
      fullArticleFetched: false,
      rawFeedRetained: false,
      automaticDeletion: false,
      archiveIndependentOfSourceCache: true,
    });
    expect(view.grouping?.groups.flatMap((group) => group.recommendationIds).sort()).toEqual(
      view.recommendations.map((entry) => entry.id).sort(),
    );
  });
});

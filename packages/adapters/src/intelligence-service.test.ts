import { randomUUID } from "node:crypto";
import { createDb } from "@marketbot/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IntelligenceService } from "./intelligence-service.js";

const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("financial intelligence PostgreSQL workflow", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const userId = `intelligence-test-${randomUUID()}`;
  let sourceId = "";
  let excerpt = "Bitcoin research";
  const feed = vi.fn(async () => [
    {
      key: "bitcoin",
      title: "Bitcoin custody",
      excerpt,
      url: "https://example.test/bitcoin",
      author: "Test author",
      publishedAt: new Date("2026-10-12T00:00:00Z"),
    },
    {
      key: "unrelated",
      title: "A hiking trip",
      excerpt: "Nature",
      url: "https://example.test/hike",
      author: "Test author",
      publishedAt: null,
    },
  ]);
  const service = new IntelligenceService(prisma, feed);
  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: "Test reader", email: `${userId}@example.test` },
    });
    const source = await prisma.intelligenceSource.create({
      data: { userId, name: "Author feed", kind: "author", url: `https://example.test/${userId}` },
    });
    sourceId = source.id;
    await service.createSubscription(userId, {
      name: "Author's Bitcoin posts",
      sourceId,
      includeTerms: ["Bitcoin", "BTC"],
      excludeTerms: ["sponsored"],
    });
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await pool.end();
  });
  it("collects only topic-relevant posts and repeated sync does not duplicate them", async () => {
    await service.syncDue();
    await service.requestSync(userId);
    await service.syncDue();
    const view = await service.list(userId);
    expect(view.sources[0]?.status).toBe("ok");
    expect(view.recommendations).toHaveLength(1);
    expect(view.recommendations[0]?.title).toBe("Bitcoin custody");
    expect(await prisma.intelligenceContent.count({ where: { sourceId } })).toBe(2);
  });
  it("publishes one immutable daily revision under concurrent retries", async () => {
    const now = new Date(Date.now() + 1000);
    const [a, b] = await Promise.all([
      service.publishBrief(userId, now),
      service.publishBrief(userId, now),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.items).toHaveLength(1);
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(1);
    excerpt = "Bitcoin updated research";
    await service.requestSync(userId);
    await service.syncDue();
    const view = await service.list(userId);
    expect(view.recommendations).toHaveLength(2);
    expect(view.recommendations.map((item) => item.contentRevision).sort()).toEqual([1, 2]);
    expect(view.briefs[0]?.items[0]?.excerpt).toBe("Bitcoin research");
  });
  it("keeps feedback separate from an archived recommendation and rejects another user's IDs", async () => {
    const before = await service.list(userId);
    const id = before.recommendations[0]!.id;
    await service.feedback(userId, id, "useful");
    expect(
      (await service.list(userId)).recommendations.find((item) => item.id === id)?.feedback,
    ).toBe("useful");
    expect(await prisma.intelligenceFeedback.count({ where: { recommendationId: id } })).toBe(1);
    await expect(service.feedback("other-user", id, "irrelevant")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.createSubscription("other-user", {
        name: "forged",
        sourceId,
        includeTerms: ["BTC"],
        excludeTerms: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await service.list(userId)).briefs[0]?.items).toEqual(before.briefs[0]?.items);
  });
  it("source failure is visible and does not replace previous content with empty results", async () => {
    feed.mockRejectedValueOnce(new Error("Private upstream detail"));
    await service.requestSync(userId);
    await service.syncDue();
    const view = await service.list(userId);
    expect(view.sources[0]?.status).toBe("failed");
    expect(view.sources[0]?.lastError).not.toContain("Private");
    expect(view.recommendations).toHaveLength(2);
  });
  it("keeps earlier editions immutable and deduplicates concurrent corrections", async () => {
    const before = await service.list(userId);
    const original = before.briefs[0]!;
    const now = new Date(Date.now() + 2000);
    const [a, b] = await Promise.all([
      service.correctBrief(userId, original.id, original.version, "补充来源修订", now),
      service.correctBrief(userId, original.id, original.version, "补充来源修订", now),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.parentId).toBe(original.id);
    expect(a.version).toBe(2);
    expect(a.coverage.totalCount).toBe(2);
    expect((await service.list(userId)).briefs.find((item) => item.id === original.id)).toEqual(
      original,
    );
    await expect(
      service.correctBrief(userId, original.id, 1, "不同的更正", now),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.correctBrief("other-user", original.id, 1, "forged", now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(2);
  });
  it("fences disabled sources, versions subscriptions and applies user digest preferences", async () => {
    const subscription = (await service.list(userId)).subscriptions[0]!;
    const updated = await service.setSubscriptionEnabled(
      userId,
      subscription.id,
      subscription.revision,
      false,
    );
    expect(updated.revision).toBe(2);
    await expect(
      service.setSubscriptionEnabled(userId, subscription.id, 1, true),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.setSourceEnabled("other-user", sourceId, false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await service.setSourceEnabled(userId, sourceId, false)).enabled).toBe(false);
    const calls = feed.mock.calls.length;
    await service.requestSync(userId);
    await service.syncDue();
    expect(feed.mock.calls.length).toBe(calls);
    await expect(
      service.updatePreferences(userId, {
        timezone: "invalid/timezone",
        digestHour: 9,
        pushEnabled: false,
        quietStart: 23,
        quietEnd: 7,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const prefs = {
      timezone: "America/New_York",
      digestHour: 10,
      pushEnabled: false,
      quietStart: 23,
      quietEnd: 7,
    };
    expect(await service.updatePreferences(userId, prefs)).toEqual(prefs);
    expect((await service.list(userId)).preferences).toEqual(prefs);
  });
  it("orders newly discovered archive posts by their actual publication date", async () => {
    await service.setSourceEnabled(userId, sourceId, true);
    const subscription = (await service.list(userId)).subscriptions[0]!;
    await service.setSubscriptionEnabled(userId, subscription.id, subscription.revision, true);
    feed.mockResolvedValueOnce([
      {
        key: "recent",
        title: "Bitcoin recent publication",
        excerpt: "Bitcoin",
        url: "https://example.test/recent",
        author: "Test author",
        publishedAt: new Date("2026-10-13T00:00:00Z"),
      },
      {
        key: "archive",
        title: "Bitcoin older archive discovered later",
        excerpt: "Bitcoin",
        url: "https://example.test/archive",
        author: "Test author",
        publishedAt: new Date("2025-01-01T00:00:00Z"),
      },
    ]);
    await service.requestSync(userId);
    await service.syncDue();
    const records = (await service.list(userId)).recommendations;
    expect(records[0]?.title).toBe("Bitcoin recent publication");
    expect(records.at(-1)?.title).toBe("Bitcoin older archive discovered later");
  });
});

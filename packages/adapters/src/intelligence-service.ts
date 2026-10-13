import { createHash, randomUUID } from "node:crypto";
import type {
  IntelligenceBrief,
  IntelligenceList,
  IntelligencePreferences,
  IntelligencePreview,
  IntelligenceRecommendation,
  IntelligenceSource,
  IntelligenceSubscription,
} from "@marketbot/contracts";
import { IntelligenceBriefSchema } from "@marketbot/contracts";
import {
  groupIntelligenceEvents,
  INTELLIGENCE_GROUP_ALGORITHM,
  localIntelligenceDate,
  matchIntelligence,
  previewIntelligenceMatch,
} from "@marketbot/core";
import type { Prisma, PrismaClient } from "@marketbot/db";
import type { FeedItem } from "./feed-source.js";
import { fetchFinancialFeed } from "./feed-source.js";
import { assertSafeRemoteUrl } from "./remote-mcp.js";

type SourceInput = { name: string; url: string; kind: "market" | "macro" | "author" };
type SubscriptionInput = {
  name: string;
  sourceId: string | null;
  includeTerms: string[];
  excludeTerms: string[];
};
type SourceRow = Prisma.IntelligenceSourceGetPayload<Record<string, never>>;
type SubscriptionRow = Prisma.IntelligenceSubscriptionGetPayload<Record<string, never>>;
type RecommendationRow = Prisma.IntelligenceRecommendationGetPayload<{
  include: { content: true };
}>;
function sourceView(row: SourceRow): IntelligenceSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    kind: row.kind as IntelligenceSource["kind"],
    enabled: row.enabled,
    status: row.status as IntelligenceSource["status"],
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}
function subscriptionView(row: SubscriptionRow): IntelligenceSubscription {
  return {
    id: row.id,
    name: row.name,
    sourceId: row.sourceId,
    includeTerms: row.includeTerms,
    excludeTerms: row.excludeTerms,
    revision: row.revision,
    enabled: row.enabled,
  };
}
function recommendationView(row: RecommendationRow): IntelligenceRecommendation {
  const content = row.content;
  return {
    id: row.id,
    sourceName: content.sourceName,
    sourceId: content.sourceId,
    author: content.author,
    title: content.title,
    excerpt: content.excerpt,
    url: content.url,
    publishedAt: content.publishedAt?.toISOString() ?? null,
    firstSeenAt: content.firstSeenAt.toISOString(),
    reason: row.reason,
    matchedTerms: row.matchedTerms,
    contentRevision: content.revision,
    feedback: row.feedback as IntelligenceRecommendation["feedback"],
  };
}
function briefView(row: {
  id: string;
  date: string;
  timezone: string;
  version: number;
  publishedAt: Date;
  snapshot: Prisma.JsonValue;
  windowStart: Date;
  windowEnd: Date;
  totalCount: number;
  truncated: boolean;
  parentId: string | null;
  correctionReason: string | null;
}): IntelligenceBrief {
  return IntelligenceBriefSchema.parse({
    id: row.id,
    date: row.date,
    timezone: row.timezone,
    version: row.version,
    publishedAt: row.publishedAt.toISOString(),
    items: Array.isArray(row.snapshot) ? row.snapshot : (row.snapshot as Prisma.JsonObject).items,
    // Old array snapshots are read unchanged and are never regrouped using live content.
    grouping: Array.isArray(row.snapshot) ? null : (row.snapshot as Prisma.JsonObject).grouping,
    coverage: {
      windowStart: row.windowStart.toISOString(),
      windowEnd: row.windowEnd.toISOString(),
      totalCount: row.totalCount,
      truncated: row.truncated,
    },
    parentId: row.parentId,
    correctionReason: row.correctionReason,
  });
}

export const DEFAULT_INTELLIGENCE_PREFERENCES: IntelligencePreferences = {
  timezone: "Asia/Shanghai",
  digestHour: 8,
  pushEnabled: true,
  quietStart: 22,
  quietEnd: 8,
};

function preferencesView(row: IntelligencePreferences | null): IntelligencePreferences {
  if (!row) return { ...DEFAULT_INTELLIGENCE_PREFERENCES };
  const { timezone, digestHour, pushEnabled, quietStart, quietEnd } = row;
  return { timezone, digestHour, pushEnabled, quietStart, quietEnd };
}

export class IntelligenceError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

/** Owns recommendation archives; no financial position or trading state is stored here. */
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly feed = fetchFinancialFeed,
  ) {}

  async list(userId: string): Promise<IntelligenceList> {
    const [sources, subscriptions, recommendations, briefs, preferences] = await Promise.all([
      this.prisma.intelligenceSource.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      this.prisma.intelligenceSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      this.prisma.intelligenceRecommendation.findMany({
        where: { userId },
        include: { content: true },
        orderBy: [
          { content: { publishedAt: { sort: "desc", nulls: "last" } } },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 100,
      }),
      this.prisma.intelligenceBrief.findMany({
        where: { userId },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        take: 7,
      }),
      this.prisma.financePreference.findUnique({ where: { userId } }),
    ]);
    return {
      sources: sources.map(sourceView),
      subscriptions: subscriptions.map(subscriptionView),
      recommendations: recommendations.map(recommendationView),
      briefs: briefs.map(briefView),
      preferences: preferencesView(preferences),
      grouping: {
        algorithmVersion: INTELLIGENCE_GROUP_ALGORITHM,
        groups: groupIntelligenceEvents(recommendations.map(recommendationView)),
      },
      retentionPolicy: {
        policyVersion: "rss-metadata-excerpt-v1",
        excerptCharacters: 500,
        rawFeedRetained: false,
        fullArticleFetched: false,
        automaticDeletion: false,
        archiveIndependentOfSourceCache: true,
      },
    };
  }

  /** Read existing owned feed samples only. No HTTP, activation, recommendation or feedback writes. */
  async previewSubscription(
    userId: string,
    input: Omit<SubscriptionInput, "name">,
    now = new Date(),
  ): Promise<IntelligencePreview> {
    const sources = await this.prisma.intelligenceSource.findMany({
      where: { userId, ...(input.sourceId ? { id: input.sourceId } : {}) },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (input.sourceId && !sources.length) throw new IntelligenceError("NOT_FOUND", "来源不存在");
    const records = await this.prisma.intelligenceContent.findMany({
      where: { sourceId: { in: sources.map((source) => source.id) }, source: { userId } },
      orderBy: [{ capturedAt: "desc" }, { revision: "desc" }, { id: "desc" }],
      take: 101,
    });
    const sampled = records.slice(0, 100);
    const keys = new Set<string>();
    const latest = sampled.filter((content) => {
      const key = JSON.stringify([content.sourceId, content.externalKey]);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    const uncollected = sources.filter((source) => source.lastSuccessAt === null).length;
    const status =
      !sources.length || uncollected === sources.length
        ? "unavailable"
        : sources.some((source) => source.status !== "ok" || !source.enabled)
          ? "partial"
          : "available";
    return {
      sampledAt: now.toISOString(),
      sources: sources.map(sourceView),
      coverage: {
        status,
        basis: "latest_cached_revisions",
        sampleLimit: 100,
        scannedRevisionCount: sampled.length,
        sampleCount: latest.length,
        uncollectedSourceCount: uncollected,
        truncated: records.length > 100,
      },
      samples: latest.map((content) => {
        const match = previewIntelligenceMatch(content, input);
        return {
          contentId: content.id,
          sourceId: content.sourceId,
          sourceName: content.sourceName,
          title: content.title,
          excerpt: content.excerpt,
          url: content.url,
          author: content.author,
          publishedAt: content.publishedAt?.toISOString() ?? null,
          firstSeenAt: content.firstSeenAt.toISOString(),
          capturedAt: content.capturedAt.toISOString(),
          contentRevision: content.revision,
          ...match,
          reason:
            match.status === "matched"
              ? "已匹配主题词"
              : match.status === "excluded"
                ? "命中排除词，订阅将忽略此内容"
                : "当前标题与 RSS 摘录未命中主题词；需人工复核，未读取全文",
        };
      }),
    };
  }

  async updatePreferences(
    userId: string,
    input: IntelligencePreferences,
  ): Promise<IntelligencePreferences> {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
    } catch {
      throw new IntelligenceError("BAD_REQUEST", "请使用有效的 IANA 时区");
    }
    const row = await this.prisma.financePreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return preferencesView(row);
  }

  async setSourceEnabled(
    userId: string,
    id: string,
    enabled: boolean,
  ): Promise<IntelligenceSource> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.intelligenceSource.updateMany({
        where: { userId, id },
        data: {
          enabled,
          leaseToken: null,
          leaseUntil: null,
          ...(enabled ? { nextPollAt: new Date() } : {}),
        },
      });
      if (!changed.count) throw new IntelligenceError("NOT_FOUND", "来源不存在");
      return sourceView(await tx.intelligenceSource.findUniqueOrThrow({ where: { id } }));
    });
  }

  async setSubscriptionEnabled(
    userId: string,
    id: string,
    expectedRevision: number,
    enabled: boolean,
  ): Promise<IntelligenceSubscription> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence:${userId}`}, 0))::text`;
      const row = await tx.intelligenceSubscription.findFirst({ where: { userId, id } });
      if (!row) throw new IntelligenceError("NOT_FOUND", "订阅不存在");
      if (row.revision !== expectedRevision)
        throw new IntelligenceError("CONFLICT", "订阅已变化，请刷新");
      if (row.enabled === enabled) return subscriptionView(row);
      const updated = await tx.intelligenceSubscription.update({
        where: { id },
        data: { enabled, revision: { increment: 1 } },
      });
      if (enabled)
        await tx.intelligenceSource.updateMany({
          where: { userId, enabled: true, ...(row.sourceId ? { id: row.sourceId } : {}) },
          data: { nextPollAt: new Date() },
        });
      return subscriptionView(updated);
    });
  }

  async createSource(userId: string, input: SourceInput): Promise<IntelligenceSource> {
    try {
      await assertSafeRemoteUrl(input.url);
    } catch {
      throw new IntelligenceError("BAD_REQUEST", "请使用可公开访问的 HTTPS RSS 或 Atom 地址");
    }
    const url = new URL(input.url).toString();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence:${userId}`}, 0))::text`;
      const existing = await tx.intelligenceSource.findUnique({
        where: { userId_url: { userId, url } },
      });
      if (existing) return sourceView(existing);
      if ((await tx.intelligenceSource.count({ where: { userId } })) >= 100)
        throw new IntelligenceError("BAD_REQUEST", "最多添加 100 个来源");
      return sourceView(await tx.intelligenceSource.create({ data: { ...input, userId, url } }));
    });
  }

  async createSubscription(
    userId: string,
    input: SubscriptionInput,
  ): Promise<IntelligenceSubscription> {
    const config = {
      ...input,
      includeTerms: [...new Set(input.includeTerms.map((value) => value.trim()))].sort(),
      excludeTerms: [...new Set(input.excludeTerms.map((value) => value.trim()))].sort(),
    };
    const configHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence:${userId}`}, 0))::text`;
      if (
        input.sourceId &&
        !(await tx.intelligenceSource.findFirst({ where: { id: input.sourceId, userId } }))
      )
        throw new IntelligenceError("NOT_FOUND", "来源不存在");
      const existing = await tx.intelligenceSubscription.findUnique({
        where: { userId_configHash: { userId, configHash } },
      });
      if (existing) return subscriptionView(existing);
      if ((await tx.intelligenceSubscription.count({ where: { userId } })) >= 200)
        throw new IntelligenceError("BAD_REQUEST", "最多添加 200 个订阅");
      const row = await tx.intelligenceSubscription.create({
        data: { ...config, configHash, userId },
      });
      await tx.intelligenceSource.updateMany({
        where: { userId, ...(input.sourceId ? { id: input.sourceId } : {}) },
        data: { nextPollAt: new Date() },
      });
      return subscriptionView(row);
    });
  }

  async requestSync(userId: string) {
    await this.prisma.intelligenceSource.updateMany({
      where: { userId, enabled: true },
      data: { nextPollAt: new Date() },
    });
    return { ok: true as const };
  }

  async feedback(userId: string, id: string, value: IntelligenceRecommendation["feedback"]) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.intelligenceRecommendation.updateMany({
        where: { id, userId },
        data: { feedback: value },
      });
      if (!result.count) throw new IntelligenceError("NOT_FOUND", "推荐不存在");
      await tx.intelligenceFeedback.create({ data: { recommendationId: id, value } });
      return { ok: true as const };
    });
  }

  async publishBrief(
    userId: string,
    now = new Date(),
    timezone?: string,
  ): Promise<IntelligenceBrief> {
    timezone ??=
      (await this.prisma.financePreference.findUnique({ where: { userId } }))?.timezone ??
      "Asia/Shanghai";
    const date = localIntelligenceDate(now, timezone);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`brief:${userId}:${date}`}, 0))::text`;
      const existing = await tx.intelligenceBrief.findUnique({
        where: { userId_date_kind_version: { userId, date, kind: "daily", version: 1 } },
      });
      if (existing) return briefView(existing);
      const previous = await tx.intelligenceBrief.findFirst({
        where: { userId },
        orderBy: { windowEnd: "desc" },
      });
      const start = previous?.windowEnd ?? new Date(now.getTime() - 86_400_000);
      const records = await tx.intelligenceRecommendation.findMany({
        where: { userId, createdAt: { gt: start, lte: now } },
        include: { content: true },
        orderBy: [
          { content: { publishedAt: { sort: "desc", nulls: "last" } } },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 100,
      });
      const totalCount = await tx.intelligenceRecommendation.count({
        where: { userId, createdAt: { gt: start, lte: now } },
      });
      const snapshot = records.map(recommendationView);
      const row = await tx.intelligenceBrief.create({
        data: {
          userId,
          date,
          timezone,
          publishedAt: now,
          windowStart: start,
          windowEnd: now,
          snapshot: {
            snapshotVersion: 1,
            items: snapshot,
            grouping: {
              algorithmVersion: INTELLIGENCE_GROUP_ALGORITHM,
              groups: groupIntelligenceEvents(snapshot),
            },
          },
          totalCount,
          truncated: totalCount > snapshot.length,
        },
      });
      await tx.financeNotification.create({
        data: {
          userId,
          eventId: `intelligence.daily:${row.id}`,
          kind: "intelligence.daily",
          title: "今日财经简报",
          body: `${snapshot.length} 条相关内容已归档${totalCount > snapshot.length ? `，本次窗口共 ${totalCount} 条` : ""}。`,
          recordedAt: now,
        },
      });
      return briefView(row);
    });
  }

  async correctBrief(
    userId: string,
    briefId: string,
    expectedVersion: number,
    reason: string,
    now = new Date(),
  ): Promise<IntelligenceBrief> {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.intelligenceBrief.findFirst({ where: { id: briefId, userId } });
      if (!parent) throw new IntelligenceError("NOT_FOUND", "日报不存在");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`brief:${userId}:${parent.date}`}, 0))::text`;
      const latest = await tx.intelligenceBrief.findFirstOrThrow({
        where: { userId, date: parent.date, kind: parent.kind },
        orderBy: { version: "desc" },
      });
      if (
        latest.version === expectedVersion + 1 &&
        latest.parentId === briefId &&
        latest.correctionReason === reason
      )
        return briefView(latest);
      if (latest.id !== briefId || latest.version !== expectedVersion)
        throw new IntelligenceError("CONFLICT", "已有新版本，请刷新日报");
      const windowEnd =
        localIntelligenceDate(now, parent.timezone) === parent.date ? now : parent.windowEnd;
      const where = { userId, createdAt: { gt: parent.windowStart, lte: windowEnd } };
      const records = await tx.intelligenceRecommendation.findMany({
        where,
        include: { content: true },
        orderBy: [
          { content: { publishedAt: { sort: "desc", nulls: "last" } } },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 100,
      });
      const totalCount = await tx.intelligenceRecommendation.count({ where });
      const row = await tx.intelligenceBrief.create({
        data: {
          userId,
          date: parent.date,
          kind: parent.kind,
          timezone: parent.timezone,
          version: expectedVersion + 1,
          publishedAt: now,
          windowStart: parent.windowStart,
          windowEnd,
          snapshot: {
            snapshotVersion: 1,
            items: records.map(recommendationView),
            grouping: {
              algorithmVersion: INTELLIGENCE_GROUP_ALGORITHM,
              groups: groupIntelligenceEvents(records.map(recommendationView)),
            },
          },
          totalCount,
          truncated: totalCount > records.length,
          parentId: briefId,
          correctionReason: reason,
        },
      });
      await tx.financeNotification.create({
        data: {
          userId,
          eventId: `intelligence.daily:${row.id}`,
          kind: "intelligence.daily",
          title: `财经简报更正 · v${row.version}`,
          body: reason,
          recordedAt: now,
        },
      });
      return briefView(row);
    });
  }

  /** Lease belongs to the assistant worker and covers source reads only. */
  async syncDue(now = new Date(), signal?: AbortSignal) {
    const sources = await this.prisma.intelligenceSource.findMany({
      where: {
        enabled: true,
        nextPollAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { nextPollAt: "asc" },
      take: 20,
    });
    for (const source of sources) {
      if (signal?.aborted) return;
      const leaseToken = randomUUID();
      const claim = await this.prisma.intelligenceSource.updateMany({
        where: {
          id: source.id,
          enabled: true,
          nextPollAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        data: { leaseUntil: new Date(now.getTime() + 120_000), leaseToken },
      });
      if (!claim.count) continue;
      try {
        const items = await this.feed(source.url, signal);
        await this.capture(source, leaseToken, items, new Date());
      } catch {
        await this.prisma.intelligenceSource.updateMany({
          where: { id: source.id, leaseToken },
          data: {
            status: "failed",
            lastError: "来源读取失败，请检查 RSS 地址或稍后重试",
            nextPollAt: new Date(Date.now() + 900_000),
            leaseUntil: null,
            leaseToken: null,
          },
        });
      }
    }
  }

  private async capture(source: SourceRow, leaseToken: string, items: FeedItem[], now: Date) {
    await this.prisma.$transaction(
      async (tx) => {
        const held = await tx.intelligenceSource.updateMany({
          where: { id: source.id, leaseToken, enabled: true },
          data: {
            status: "ok",
            lastSuccessAt: now,
            lastError: null,
            nextPollAt: new Date(now.getTime() + 3_600_000),
            leaseUntil: null,
            leaseToken: null,
          },
        });
        if (!held.count) throw new IntelligenceError("CONFLICT", "来源同步租约已失效");
        const subscriptions = await tx.intelligenceSubscription.findMany({
          where: {
            userId: source.userId,
            enabled: true,
            OR: [{ sourceId: null }, { sourceId: source.id }],
          },
        });
        for (const item of items) {
          const hash = createHash("sha256").update(JSON.stringify(item)).digest("hex");
          let content = await tx.intelligenceContent.findUnique({
            where: {
              sourceId_externalKey_hash: { sourceId: source.id, externalKey: item.key, hash },
            },
          });
          if (!content) {
            const first = await tx.intelligenceContent.findFirst({
              where: { sourceId: source.id, externalKey: item.key },
              orderBy: { revision: "desc" },
            });
            content = await tx.intelligenceContent.create({
              data: {
                sourceId: source.id,
                externalKey: item.key,
                hash,
                revision: (first?.revision ?? 0) + 1,
                firstSeenAt: first?.firstSeenAt ?? now,
                sourceName: source.name,
                author: item.author,
                title: item.title,
                excerpt: item.excerpt,
                url: item.url,
                publishedAt: item.publishedAt,
              },
            });
          }
          const matching = subscriptions
            .map((subscription) => ({
              subscription,
              matched: matchIntelligence(item, subscription),
            }))
            .filter(({ matched }) => matched.length);
          if (!matching.length) continue;
          const terms = [...new Set(matching.flatMap(({ matched }) => matched))].slice(0, 32);
          await tx.intelligenceRecommendation.upsert({
            where: { userId_contentId: { userId: source.userId, contentId: content.id } },
            update: {},
            create: {
              userId: source.userId,
              contentId: content.id,
              reason: `匹配订阅主题：${terms.join("、")}`,
              matchedTerms: terms,
              subscriptionSnapshot: matching.map(({ subscription, matched }) => ({
                id: subscription.id,
                revision: subscription.revision,
                name: subscription.name,
                sourceId: subscription.sourceId,
                includeTerms: subscription.includeTerms,
                excludeTerms: subscription.excludeTerms,
                matched,
              })),
            },
          });
        }
      },
      { timeout: 30_000 },
    );
  }

  async publishDue(now = new Date()) {
    let afterId: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: { intelligenceSubscriptions: { some: { enabled: true } } },
        select: { id: true, financePreferences: true },
        orderBy: { id: "asc" },
        take: 100,
        ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      });
      for (const user of users) {
        const prefs = preferencesView(user.financePreferences);
        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: prefs.timezone,
            hour: "2-digit",
            hourCycle: "h23",
          }).format(now),
        );
        if (hour >= prefs.digestHour) await this.publishBrief(user.id, now, prefs.timezone);
      }
      if (users.length < 100) return;
      afterId = users[users.length - 1]?.id;
    }
  }
}

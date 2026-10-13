import * as z from "zod";
import { IsoDate } from "./ids.js";

const id = z.string().min(1).max(200);
const name = z.string().trim().min(1).max(120);
const term = z.string().trim().min(1).max(100);
export const IntelligenceSourceKindSchema = z.enum(["market", "macro", "author"]);
export const IntelligenceFeedbackSchema = z.enum(["unread", "read", "useful", "irrelevant"]);
export const IntelligenceSourceUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Provide an HTTPS feed URL without credentials");

export const IntelligenceSourceSchema = z.object({
  id,
  name,
  url: IntelligenceSourceUrlSchema,
  kind: IntelligenceSourceKindSchema,
  enabled: z.boolean(),
  status: z.enum(["pending", "ok", "failed"]),
  lastSuccessAt: IsoDate.nullable(),
  lastError: z.string().max(2000).nullable(),
});

export const IntelligenceTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      if (/^[+-]/.test(value)) return false;
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return value !== "";
    } catch {
      return false;
    }
  }, "Provide a valid IANA timezone");

export const IntelligencePreferencesSchema = z
  .object({
    timezone: IntelligenceTimezoneSchema,
    digestHour: z.number().int().min(0).max(23),
    pushEnabled: z.boolean(),
    quietStart: z.number().int().min(0).max(23),
    quietEnd: z.number().int().min(0).max(23),
  })
  .strict();

export const IntelligenceSubscriptionSchema = z.object({
  id,
  name,
  sourceId: id.nullable(),
  includeTerms: z.array(term).min(1).max(32),
  excludeTerms: z.array(term).max(32),
  revision: z.number().int().positive(),
  enabled: z.boolean(),
});

export const IntelligenceRecommendationSchema = z.object({
  id,
  sourceName: name,
  sourceId: id.optional(),
  author: z.string().max(200).nullable(),
  title: z.string().min(1).max(1000),
  excerpt: z.string().max(5000),
  url: z
    .url()
    .max(2048)
    .refine((value) => ["https:", "http:"].includes(new URL(value).protocol)),
  publishedAt: IsoDate.nullable(),
  firstSeenAt: IsoDate,
  reason: z.string().max(2000),
  matchedTerms: z.array(term).max(32),
  contentRevision: z.number().int().positive(),
  feedback: IntelligenceFeedbackSchema,
});

export const IntelligenceEventGroupSchema = z.object({
  id,
  basis: z.enum(["same_article_url", "exact_title_utc_day", "single"]),
  association: z.literal("candidate"),
  recommendationIds: z.array(id).min(1).max(100),
  sourceIds: z.array(id).max(100),
  sourceNames: z.array(name).min(1).max(100),
  title: z.string().min(1).max(1000),
});
export const IntelligenceGroupingSchema = z.object({
  algorithmVersion: z.literal("exact-link-or-title-utc-v1"),
  groups: z.array(IntelligenceEventGroupSchema).max(100),
});
export const IntelligenceRetentionPolicySchema = z.object({
  policyVersion: z.literal("rss-metadata-excerpt-v1"),
  excerptCharacters: z.literal(500),
  rawFeedRetained: z.literal(false),
  fullArticleFetched: z.literal(false),
  automaticDeletion: z.literal(false),
  archiveIndependentOfSourceCache: z.literal(true),
});
export const PreviewIntelligenceSubscriptionSchema = z
  .object({
    sourceId: id.nullable(),
    includeTerms: z.array(term).min(1).max(32),
    excludeTerms: z.array(term).max(32),
  })
  .strict();
export const IntelligencePreviewSchema = z.object({
  sampledAt: IsoDate,
  sources: z.array(IntelligenceSourceSchema).max(100),
  coverage: z.object({
    status: z.enum(["available", "partial", "unavailable"]),
    basis: z.literal("latest_cached_revisions"),
    sampleLimit: z.literal(100),
    scannedRevisionCount: z.number().int().min(0).max(100),
    sampleCount: z.number().int().min(0).max(100),
    uncollectedSourceCount: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  samples: z
    .array(
      z.object({
        contentId: id,
        sourceId: id,
        sourceName: name,
        title: z.string().min(1).max(1000),
        excerpt: z.string().max(5000),
        url: z.url().max(2048),
        author: z.string().max(200).nullable(),
        publishedAt: IsoDate.nullable(),
        firstSeenAt: IsoDate,
        capturedAt: IsoDate,
        contentRevision: z.number().int().positive(),
        status: z.enum(["matched", "excluded", "review"]),
        matchedTerms: z.array(term).max(32),
        excludedTerms: z.array(term).max(32),
        reason: z.string().max(500),
      }),
    )
    .max(100),
});

export const IntelligenceBriefSchema = z.object({
  id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: IntelligenceTimezoneSchema,
  version: z.number().int().positive(),
  publishedAt: IsoDate,
  items: z.array(IntelligenceRecommendationSchema).max(100),
  grouping: IntelligenceGroupingSchema.nullable().optional(),
  coverage: z.object({
    windowStart: IsoDate,
    windowEnd: IsoDate,
    totalCount: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  correctionReason: z.string().max(500).nullable(),
  parentId: id.nullable(),
});

export const IntelligenceListSchema = z.object({
  sources: z.array(IntelligenceSourceSchema).max(100),
  subscriptions: z.array(IntelligenceSubscriptionSchema).max(200),
  recommendations: z.array(IntelligenceRecommendationSchema).max(100),
  briefs: z.array(IntelligenceBriefSchema).max(7),
  preferences: IntelligencePreferencesSchema,
  grouping: IntelligenceGroupingSchema.optional(),
  retentionPolicy: IntelligenceRetentionPolicySchema.optional(),
});

export const CreateIntelligenceSourceSchema = z
  .object({
    name,
    url: IntelligenceSourceUrlSchema,
    kind: IntelligenceSourceKindSchema,
  })
  .strict();

export const CreateIntelligenceSubscriptionSchema = z
  .object({
    name,
    sourceId: id.nullable(),
    includeTerms: z.array(term).min(1).max(32),
    excludeTerms: z.array(term).max(32),
  })
  .strict();

export type IntelligenceList = z.infer<typeof IntelligenceListSchema>;
export type IntelligenceSource = z.infer<typeof IntelligenceSourceSchema>;
export type IntelligenceSubscription = z.infer<typeof IntelligenceSubscriptionSchema>;
export type IntelligenceRecommendation = z.infer<typeof IntelligenceRecommendationSchema>;
export type IntelligenceBrief = z.infer<typeof IntelligenceBriefSchema>;
export type IntelligencePreferences = z.infer<typeof IntelligencePreferencesSchema>;

export type IntelligenceEventGroup = z.infer<typeof IntelligenceEventGroupSchema>;
export type IntelligenceGrouping = z.infer<typeof IntelligenceGroupingSchema>;
export type IntelligencePreview = z.infer<typeof IntelligencePreviewSchema>;

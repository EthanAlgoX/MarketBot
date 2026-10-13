import { describe, expect, it } from "vitest";
import {
  CreateIntelligenceSourceSchema,
  CreateIntelligenceSubscriptionSchema,
  IntelligencePreferencesSchema,
} from "./intelligence.js";

describe("intelligence source intent", () => {
  it("requires an IANA timezone and valid local digest and quiet hours", () => {
    const preferences = {
      timezone: "Asia/Shanghai",
      digestHour: 8,
      pushEnabled: true,
      quietStart: 22,
      quietEnd: 8,
    };
    expect(IntelligencePreferencesSchema.safeParse(preferences).success).toBe(true);
    expect(
      IntelligencePreferencesSchema.safeParse({ ...preferences, timezone: "+08:00" }).success,
    ).toBe(false);
    expect(
      IntelligencePreferencesSchema.safeParse({ ...preferences, timezone: "Moon/Sea" }).success,
    ).toBe(false);
    expect(
      IntelligencePreferencesSchema.safeParse({ ...preferences, digestHour: 24 }).success,
    ).toBe(false);
    expect(
      IntelligencePreferencesSchema.safeParse({ ...preferences, userId: "foreign" }).success,
    ).toBe(false);
  });
  it("accepts a named HTTPS feed and refuses plaintext or credential-bearing source URLs", () => {
    const source = {
      name: "Synthetic author feed",
      url: "https://example.com/feed.xml",
      kind: "author",
    };
    expect(CreateIntelligenceSourceSchema.safeParse(source).success).toBe(true);
    expect(
      CreateIntelligenceSourceSchema.safeParse({ ...source, url: "http://example.com/feed.xml" })
        .success,
    ).toBe(false);
    expect(
      CreateIntelligenceSourceSchema.safeParse({
        ...source,
        url: "https://user:secret@example.com/feed.xml",
      }).success,
    ).toBe(false);
  });
  it("requires a bounded topic filter and derives ownership on the server", () => {
    const subscription = {
      name: "BTC topic",
      sourceId: null,
      includeTerms: ["BTC"],
      excludeTerms: [],
    };
    expect(CreateIntelligenceSubscriptionSchema.safeParse(subscription).success).toBe(true);
    expect(
      CreateIntelligenceSubscriptionSchema.safeParse({ ...subscription, includeTerms: [] }).success,
    ).toBe(false);
    expect(
      CreateIntelligenceSubscriptionSchema.safeParse({ ...subscription, userId: "foreign-user" })
        .success,
    ).toBe(false);
  });
});

import type { IntelligenceEventGroup, IntelligenceRecommendation } from "@marketbot/contracts";

export const INTELLIGENCE_GROUP_ALGORITHM = "exact-link-or-title-utc-v1" as const;

/** Remove tracking parameters only; meaningful article query parameters remain distinct. */
export function intelligenceArticleUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || /^(fbclid|gclid|dclid|msclkid)$/i.test(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}

/** Conservative candidate associations. This never infers a cause, viewpoint or trade direction. */
export function groupIntelligenceEvents(
  items: IntelligenceRecommendation[],
): IntelligenceEventGroup[] {
  const byUrl = new Map<string, IntelligenceRecommendation[]>();
  for (const item of items) {
    const key = intelligenceArticleUrl(item.url);
    byUrl.set(key, [...(byUrl.get(key) ?? []), item]);
  }
  const groups: IntelligenceEventGroup[] = [];
  const titleCandidates = new Map<string, IntelligenceRecommendation[]>();
  const append = (
    members: IntelligenceRecommendation[],
    basis: IntelligenceEventGroup["basis"],
  ) => {
    const sorted = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    groups.push({
      // IDs refer to this finite recommendation snapshot, independent of future captures.
      id: `group:${sorted[0]!.id}`,
      basis,
      association: "candidate",
      recommendationIds: sorted.map((item) => item.id),
      sourceIds: [...new Set(sorted.flatMap((item) => (item.sourceId ? [item.sourceId] : [])))],
      sourceNames: [...new Set(sorted.map((item) => item.sourceName))],
      title: sorted[0]!.title,
    });
  };
  for (const members of byUrl.values()) {
    if (members.length > 1) {
      append(members, "same_article_url");
      continue;
    }
    const item = members[0]!;
    if (!item.publishedAt) {
      append(members, "single");
      continue;
    }
    const title = item.title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    const key = `${new Date(item.publishedAt).toISOString().slice(0, 10)}:${title}`;
    titleCandidates.set(key, [...(titleCandidates.get(key) ?? []), item]);
  }
  for (const members of titleCandidates.values()) {
    const sourceKeys = new Set(members.map((item) => item.sourceId ?? item.sourceName));
    if (members.length > 1 && sourceKeys.size > 1) append(members, "exact_title_utc_day");
    else for (const item of members) append([item], "single");
  }
  const order = new Map(items.map((item, index) => [item.id, index]));
  return groups.sort(
    (a, b) =>
      Math.min(...a.recommendationIds.map((id) => order.get(id)!)) -
      Math.min(...b.recommendationIds.map((id) => order.get(id)!)),
  );
}

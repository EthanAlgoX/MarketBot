/** Deterministic relevance only: topic matches never imply a trading direction. */
export function previewIntelligenceMatch(
  content: { title: string; excerpt: string },
  subscription: { includeTerms: string[]; excludeTerms: string[] },
) {
  const text = `${content.title}\n${content.excerpt}`.normalize("NFKC").toLowerCase();
  const normalize = (term: string) => term.trim().normalize("NFKC").toLowerCase();
  const includes = (term: string) => {
    const value = normalize(term);
    if (!value) return false;
    // Ticker/Latin tokens need boundaries: BTC must not match BTCST accidentally.
    if (/^[a-z0-9]+$/.test(value)) {
      return new RegExp(`(^|[^a-z0-9])${value}([^a-z0-9]|$)`, "i").test(text);
    }
    return text.includes(value);
  };
  const excludedTerms = [...new Set(subscription.excludeTerms.filter(includes))];
  const matchedTerms = [...new Set(subscription.includeTerms.filter(includes))];
  const status = excludedTerms.length ? "excluded" : matchedTerms.length ? "matched" : "review";
  return { status: status as "matched" | "excluded" | "review", matchedTerms, excludedTerms };
}

export function matchIntelligence(
  content: { title: string; excerpt: string },
  subscription: { includeTerms: string[]; excludeTerms: string[] },
): string[] {
  const result = previewIntelligenceMatch(content, subscription);
  return result.status === "matched" ? result.matchedTerms : [];
}

export function localIntelligenceDate(now: Date, timezone = "Asia/Shanghai"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (kind: string) => parts.find((value) => value.type === kind)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

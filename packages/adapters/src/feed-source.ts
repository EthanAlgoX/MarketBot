import { JSDOM } from "jsdom";
import { createSafeRemoteFetch } from "./remote-mcp.js";

export interface FeedItem {
  key: string;
  title: string;
  excerpt: string;
  url: string;
  author: string | null;
  publishedAt: Date | null;
}
const MAX_FEED_BYTES = 1_048_576;
function plain(value: string): string {
  const dom = new JSDOM(value);
  for (const element of dom.window.document.querySelectorAll("script, style, template"))
    element.remove();
  const text = dom.window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  dom.window.close();
  return text;
}

export function parseFinancialFeed(xml: string, origin: string): FeedItem[] {
  if (Buffer.byteLength(xml) > MAX_FEED_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Unsupported feed document");
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  try {
    const document = dom.window.document;
    if (!document.querySelector("rss, feed, RDF")) throw new Error("Expected RSS or Atom");
    const entries = [...document.querySelectorAll("item, entry")].slice(0, 100);
    return entries.flatMap((entry) => {
      const text = (name: string) => entry.getElementsByTagName(name)[0]?.textContent?.trim() ?? "";
      const title = plain(text("title")).slice(0, 1000);
      if (!title) return [];
      const link = entry.querySelector('link[rel="alternate"], link:not([rel])');
      let url: URL;
      try {
        url = new URL(link?.getAttribute("href") || text("link") || origin, origin);
      } catch {
        return [];
      }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return [];
      url.hash = "";
      for (const key of [...url.searchParams.keys()])
        if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
      const published = text("pubDate") || text("published") || text("updated") || text("dc:date");
      const date = new Date(published);
      const knownZone = /(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(published);
      const author = (text("dc:creator") || text("author") || null)?.slice(0, 200) ?? null;
      return [
        {
          key: (text("guid") || text("id") || url.toString()).slice(0, 2048),
          title,
          // Keep only a short feed excerpt and the original link; never fetch full articles.
          excerpt: plain(
            text("summary") || text("description") || text("content") || text("content:encoded"),
          ).slice(0, 500),
          url: url.toString(),
          author,
          publishedAt: knownZone && Number.isFinite(date.getTime()) ? date : null,
        },
      ];
    });
  } finally {
    dom.window.close();
  }
}

export async function fetchFinancialFeed(url: string, signal?: AbortSignal): Promise<FeedItem[]> {
  const http = createSafeRemoteFetch();
  try {
    const response = await http(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });
    if (!response.ok || !response.body) throw new Error("Feed unavailable");
    const reader = response.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_FEED_BYTES) throw new Error("Feed exceeds maximum size");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return parseFinancialFeed(Buffer.concat(chunks).toString("utf8"), url);
  } finally {
    await http.close();
  }
}

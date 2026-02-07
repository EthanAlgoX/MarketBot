/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { NewsItem } from "./types.js";

function decodeCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(re);
  if (!match) {
    return undefined;
  }
  return decodeCdata(match[1].trim());
}

export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const normalized = xml.replace(/\r/g, "");
  const itemBlocks = normalized.split(/<item>/i).slice(1);
  for (const raw of itemBlocks) {
    const block = raw.split(/<\/item>/i)[0];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) {
      continue;
    }
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source");
    items.push({ title, link, pubDate, source });
  }
  return items;
}

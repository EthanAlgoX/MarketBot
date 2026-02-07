import { describe, expect, it } from "vitest";
import { parseGoogleNewsRss } from "./news.js";

describe("finance news", () => {
  it("parses google news rss", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
<title><![CDATA[Test headline]]></title>
<link>https://example.com/story</link>
<pubDate>Sat, 01 Feb 2025 12:00:00 GMT</pubDate>
<source>Example News</source>
</item>
</channel></rss>`;
    const items = parseGoogleNewsRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Test headline");
  });
});

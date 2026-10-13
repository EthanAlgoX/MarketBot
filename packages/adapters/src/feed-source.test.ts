import { describe, expect, it } from "vitest";
import { parseFinancialFeed } from "./feed-source.js";

describe("public financial feeds", () => {
  it("parses RSS and retains provenance without loading the full article", () => {
    const items = parseFinancialFeed(
      "<rss><channel><item><guid>one</guid><title>BTC update</title><link>https://example.test/btc?utm_source=rss</link><description><![CDATA[<b>Bitcoin</b> research]]></description><pubDate>Mon, 12 Oct 2026 00:00:00 GMT</pubDate><author>Example author</author></item></channel></rss>",
      "https://example.test/feed",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: "one",
      title: "BTC update",
      excerpt: "Bitcoin research",
      url: "https://example.test/btc",
      author: "Example author",
    });
    expect(items[0]?.publishedAt?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
  it("parses Atom and refuses script links, unknown timezone and entity documents", () => {
    const entries = parseFinancialFeed(
      '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>a</id><title>Bitcoin</title><link href="https://example.test/a"/><summary>BTC</summary><published>2026-10-12T00:00:00</published></entry><entry><title>bad</title><link href="javascript:alert(1)"/></entry></feed>',
      "https://example.test/feed",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.publishedAt).toBeNull();
    expect(() =>
      parseFinancialFeed('<!DOCTYPE rss [<!ENTITY x "BTC">]><rss/>', "https://example.test/feed"),
    ).toThrow();
    expect(() =>
      parseFinancialFeed("<html>login page</html>", "https://example.test/feed"),
    ).toThrow();
  });
});

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  closeUnterminatedFence,
  inlineMarkdownImageSrc,
  linkFaviconOrigin,
  linkifyExplicitUrls,
  linkLabel,
  plainTextLinkParts,
  sanitizeMarkdownImageUrl,
  sanitizeMarkdownUrl,
} from "./markdown";

type Token = { type: string; attrGet(name: string): string | null; children: Token[] | null };
type Parser = Parameters<typeof linkifyExplicitUrls>[0] & {
  parseInline(source: string, env: object): Token[];
};

// The markdown-it the native renderer ships; chat-ui has no direct dependency on it.
const rendererRequire = createRequire(
  createRequire(import.meta.url).resolve("@ronradtke/react-native-markdown-display/package.json"),
);
const markdownIt = rendererRequire("markdown-it") as (options: { typographer: boolean }) => Parser;

function linkHrefs(text: string) {
  const parser = linkifyExplicitUrls(markdownIt({ typographer: true }));
  return (parser.parseInline(text, {})[0]?.children ?? [])
    .filter((token) => token.type === "link_open")
    .map((token) => token.attrGet("href"));
}

describe("linkifyExplicitUrls", () => {
  it("links bare http(s) URLs and email addresses", () => {
    expect(
      linkHrefs("see http://example.test and https://example.com/a?b=1, or bob@example.com"),
    ).toEqual(["http://example.test", "https://example.com/a?b=1", "mailto:bob@example.com"]);
  });

  it("leaves file names, bare domains and unopenable schemes as text", () => {
    expect(
      linkHrefs(
        "setup.py notes.md example.com www.example.com ftp://example.com //example.com javascript:alert(1)",
      ),
    ).toEqual([]);
  });
});

describe("plainTextLinkParts", () => {
  function visible(text: string) {
    return plainTextLinkParts(text)
      .map((part) => part.value)
      .join("");
  }

  it("links explicit urls and email addresses without interpreting markdown", () => {
    const text = "see http://example.test and https://example.com/a?b=1, or bob@example.com";
    expect(
      plainTextLinkParts(text).flatMap((part) => (part.type === "link" ? [part.href] : [])),
    ).toEqual(["http://example.test", "https://example.com/a?b=1", "mailto:bob@example.com"]);
    expect(visible("# Title **important**")).toBe("# Title **important**");
    expect(plainTextLinkParts("# Title **important**").every((part) => part.type === "text")).toBe(
      true,
    );
    expect(visible(text)).toBe(text);
  });

  it("leaves file names, bare domains, and unopenable schemes as text", () => {
    const text =
      "setup.py notes.md example.com www.example.com ftp://example.com //example.com javascript:alert(1)";
    expect(plainTextLinkParts(text).some((part) => part.type === "link")).toBe(false);
    expect(visible(text)).toBe(text);
  });

  it("keeps balanced parentheses inside a url and drops a prose closer", () => {
    const wiki = "https://en.wikipedia.org/wiki/Foo_(bar)";
    expect(plainTextLinkParts(wiki)).toEqual([{ type: "link", value: wiki, href: wiki }]);

    const wrapped = "(see https://example.com)";
    expect(plainTextLinkParts(wrapped)).toEqual([
      { type: "text", value: "(see " },
      { type: "link", value: "https://example.com", href: "https://example.com" },
      { type: "text", value: ")" },
    ]);
    expect(visible(wiki)).toBe(wiki);
    expect(visible(wrapped)).toBe(wrapped);
  });

  it("matches bot autolinks when parentheses are nested or trailing", () => {
    const samples = [
      "https://en.wikipedia.org/wiki/Foo_(bar)",
      "(see https://example.com)",
      "https://example.com/foo_(bar))",
      "https://example.com/Foo_(bar_(baz))",
      "https://example.com/path_(a)_(b).",
    ];
    for (const text of samples) {
      expect(
        plainTextLinkParts(text).flatMap((part) => (part.type === "link" ? [part.href] : [])),
      ).toEqual(linkHrefs(text));
      expect(visible(text)).toBe(text);
    }
  });

  it("scans a long alphanumeric run without an at-sign quickly", () => {
    const text = "a".repeat(40_000);
    const started = performance.now();
    const parts = plainTextLinkParts(text);
    expect(performance.now() - started).toBeLessThan(250);
    expect(parts).toEqual([{ type: "text", value: text }]);
  });
});

describe("sanitizeMarkdownUrl", () => {
  it("allows normal external links and optionally allows local links", () => {
    expect(sanitizeMarkdownUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(sanitizeMarkdownUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(sanitizeMarkdownUrl("/docs", true)).toBe("/docs");
    expect(sanitizeMarkdownUrl("#section", true)).toBe("#section");
  });

  it("rejects executable and embedded-data URLs", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)", true)).toBeUndefined();
    expect(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>", true)).toBeUndefined();
    expect(sanitizeMarkdownUrl("/docs")).toBeUndefined();
  });
});

describe("sanitizeMarkdownImageUrl", () => {
  it("allows absolute http(s) image sources", () => {
    expect(sanitizeMarkdownImageUrl(" https://example.test/a.png ")).toBe(
      "https://example.test/a.png",
    );
    expect(sanitizeMarkdownImageUrl("HTTP://example.test/a.png")).toBe("HTTP://example.test/a.png");
  });

  it("rejects schemes a browser link would open outside http(s)", () => {
    expect(sanitizeMarkdownImageUrl("mailto:user@example.test")).toBeUndefined();
    expect(sanitizeMarkdownImageUrl("tel:+15551212")).toBeUndefined();
    expect(sanitizeMarkdownImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeMarkdownImageUrl("data:text/html,hi")).toBeUndefined();
    expect(sanitizeMarkdownImageUrl("/api/v1/p.gif")).toBeUndefined();
  });
});

describe("inlineMarkdownImageSrc", () => {
  it("keeps embedded raster image data", () => {
    expect(inlineMarkdownImageSrc(" data:image/png;base64,iVBORw0KGgo= ")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(inlineMarkdownImageSrc("data:image/jpeg;base64,/9j/4AAQ")).toBe(
      "data:image/jpeg;base64,/9j/4AAQ",
    );
  });

  it("rejects anything that would fetch, run, or exceed the size cap", () => {
    expect(inlineMarkdownImageSrc("https://attacker.example.test/p.gif?d=secret")).toBeUndefined();
    expect(inlineMarkdownImageSrc("/api/v1/p.gif")).toBeUndefined();
    expect(inlineMarkdownImageSrc("//attacker.example.test/p.gif")).toBeUndefined();
    expect(inlineMarkdownImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeUndefined();
    expect(inlineMarkdownImageSrc("data:text/html;base64,PHNjcmlwdD4=")).toBeUndefined();
    expect(
      inlineMarkdownImageSrc(`data:image/png;base64,${"A".repeat(1024 * 1024)}`),
    ).toBeUndefined();
  });
});

describe("closeUnterminatedFence", () => {
  it("temporarily closes a partial streaming code fence", () => {
    expect(closeUnterminatedFence("Before\n```ts\nconst value = 1;")).toBe(
      "Before\n```ts\nconst value = 1;\n```",
    );
  });

  it("leaves complete markdown unchanged", () => {
    const markdown = "```ts\nconst value = 1;\n```\n\nDone";
    expect(closeUnterminatedFence(markdown)).toBe(markdown);
  });
});

describe("link labels", () => {
  it.each([
    ["https://x.com/elonmusk/status/123?s=20", "x.com/elonmusk/status/123"],
    ["https://www.example.com/", "example.com"],
    ["http://example.com", "example.com"],
    ["www.example.com/docs/", "example.com/docs"],
    ["https://example.com/caf%C3%A9#menu", "example.com/café"],
    ["https://example.com:8080/a", "example.com:8080/a"],
    [
      "https://github.com/example-org/example-repository/pull/12345/files",
      "github.com/example-org/example-reposito…",
    ],
    ["http://example.com/?q=1", "example.com"],
  ])("shortens the bare URL %s to %s", (text, label) => {
    const href = text.startsWith("www.") ? `http://${text}` : text;
    expect(linkLabel(text, href)).toBe(label);
  });

  it("treats a label that differs only in scheme or a trailing slash as bare", () => {
    expect(linkLabel("http://example.com/docs", "https://example.com/docs/")).toBe(
      "example.com/docs",
    );
  });

  it("treats a label showing the address with its escapes decoded as bare", () => {
    expect(linkLabel("https://example.com/café", "https://example.com/caf%C3%A9")).toBe(
      "example.com/café",
    );
    expect(
      linkLabel("https://example.com/\u202Etxt.exe", "https://example.com/%E2%80%AEtxt.exe"),
    ).toBe("example.com/txt.exe");
  });

  it("never cuts the host, however long, and trims only the path", () => {
    const host = "www.paypal.com.account-verify-login-secure-update.example.com";
    expect(linkLabel(`https://${host}/x`, `https://${host}/x`)).toBe(
      "paypal.com.account-verify-login-secure-update.example.com/x",
    );
    expect(
      linkLabel(
        `https://${host}/a/very/long/path/that/goes/on`,
        `https://${host}/a/very/long/path/that/goes/on`,
      ),
    ).toBe("paypal.com.account-verify-login-secure-update.example.com/a/very/lon…");
  });

  it("drops bidi overrides, zero-width and control characters from the path", () => {
    const href = "https://example.com/%E2%80%AEgnp.exe%E2%80%8B%E2%81%A0%EF%BB%BF%E2%81%A6x%0A";
    expect(linkLabel(href, href)).toBe("example.com/gnp.exex");
  });

  it("keeps an international host in its ASCII form", () => {
    const href = "https://аpple.com/login";
    expect(linkLabel(href, href)).toBe("xn--pple-43d.com/login");
  });

  it("keeps an author's label as written, even when it names another address", () => {
    expect(linkLabel("Post", "https://x.com/a/status/1")).toBe("Post");
    expect(linkLabel("https://other.example", "https://x.com/")).toBe("https://other.example");
  });

  it("keeps labels of links that are not websites", () => {
    expect(linkLabel("mailto:me@example.com", "mailto:me@example.com")).toBe(
      "mailto:me@example.com",
    );
    expect(linkLabel("/docs", "/docs")).toBe("/docs");
  });

  it("gives only http(s) links an icon origin", () => {
    expect(linkFaviconOrigin("https://www.example.com/a?b#c")).toBe("https://www.example.com");
    expect(linkFaviconOrigin("http://example.com:8080/a")).toBe("http://example.com:8080");
    for (const href of ["mailto:a@example.com", "tel:+15555550100", "/docs", "#top", ""]) {
      expect(linkFaviconOrigin(href)).toBeUndefined();
    }
  });
});

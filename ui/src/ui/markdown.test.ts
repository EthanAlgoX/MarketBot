import { describe, expect, it } from "vitest";

import { toSanitizedMarkdownHtml } from "./markdown";

describe("toSanitizedMarkdownHtml", () => {
  it("renders basic markdown", () => {
    const html = toSanitizedMarkdownHtml("Hello **world**");
    expect(html).toContain("<strong>world</strong>");
  });

  it("strips scripts and unsafe links", () => {
    const html = toSanitizedMarkdownHtml(
      [
        "<script>alert(1)</script>",
        "",
        "[x](javascript:alert(1))",
        "",
        "[ok](https://example.com)",
      ].join("\n"),
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://example.com");
  });

  it("renders fenced code blocks", () => {
    const html = toSanitizedMarkdownHtml(["```ts", "console.log(1)", "```"].join("\n"));
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("console.log(1)");
  });

  it("intercepts ASCII chart code blocks and shows regenerate hint", () => {
    const html = toSanitizedMarkdownHtml(
      [
        "```text",
        "腾讯控股股价走势",
        "600 ┤",
        "590 ┤               ╭─╮",
        "580 ┤            ╭──╯ ╰──╮",
        "570 ┤         ╭──╯       ╰──╮",
        "560 ┤      ╭──╯             ╰──╮",
        "550 ┤   ╭──╯                   ╰──╮",
        "540 ┼───╯",
        "     2025-08   2025-10   2025-12   2026-02",
        "```",
      ].join("\n"),
    );

    expect(html).toContain("图表已拦截");
    expect(html).toContain("请重生成 PNG/SVG 图片图表后再发送");
    expect(html).not.toContain("腾讯控股股价走势");
    expect(html).not.toContain("2025-08");
  });

  it("does not intercept normal code blocks", () => {
    const html = toSanitizedMarkdownHtml(
      [
        "```bash",
        "echo 'hello world'",
        "cat package.json | jq .name",
        "```",
      ].join("\n"),
    );

    expect(html).toContain("hello world");
    expect(html).not.toContain("图表已拦截");
  });

  it("normalizes raw html images for chat sizing", () => {
    const html = toSanitizedMarkdownHtml(
      '<img src="https://example.com/icon.svg" width="4096" height="4096">',
    );

    expect(html).toContain('class="chat-inline-image"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('width="4096"');
    expect(html).not.toContain('height="4096"');
  });

  it("strips inline svg payloads from raw html", () => {
    const html = toSanitizedMarkdownHtml(
      '<svg viewBox="0 0 20 20"><polygon points="2,2 18,10 2,18" /></svg>',
    );

    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<polygon");
  });
});

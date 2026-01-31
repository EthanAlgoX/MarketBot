/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from "vitest";

import { markdownToSignalText } from "./format.js";

describe("markdownToSignalText", () => {
  it("renders inline styles", () => {
    const res = markdownToSignalText("hi _there_ **boss** ~~nope~~ `code`");

    expect(res.text).toBe("hi there boss nope code");
    expect(res.styles).toEqual([
      { start: 3, length: 5, style: "ITALIC" },
      { start: 9, length: 4, style: "BOLD" },
      { start: 14, length: 4, style: "STRIKETHROUGH" },
      { start: 19, length: 4, style: "MONOSPACE" },
    ]);
  });

  it("renders links as label plus url when needed", () => {
    const res = markdownToSignalText("see [docs](https://example.com) and https://example.com");

    expect(res.text).toBe("see docs (https://example.com) and https://example.com");
    expect(res.styles).toEqual([]);
  });

  it("applies spoiler styling", () => {
    const res = markdownToSignalText("hello ||secret|| world");

    expect(res.text).toBe("hello secret world");
    expect(res.styles).toEqual([{ start: 6, length: 6, style: "SPOILER" }]);
  });

  it("renders fenced code blocks with monospaced styles", () => {
    const res = markdownToSignalText("before\n\n```\nconst x = 1;\n```\n\nafter");

    const prefix = "before\n\n";
    const code = "const x = 1;\n";
    const suffix = "\nafter";

    expect(res.text).toBe(`${prefix}${code}${suffix}`);
    expect(res.styles).toEqual([{ start: prefix.length, length: code.length, style: "MONOSPACE" }]);
  });

  it("renders lists without extra block markup", () => {
    const res = markdownToSignalText("- one\n- two");

    expect(res.text).toBe("• one\n• two");
    expect(res.styles).toEqual([]);
  });

  it("uses UTF-16 code units for offsets", () => {
    const res = markdownToSignalText("😀 **bold**");

    const prefix = "😀 ";
    expect(res.text).toBe(`${prefix}bold`);
    expect(res.styles).toEqual([{ start: prefix.length, length: 4, style: "BOLD" }]);
  });
});

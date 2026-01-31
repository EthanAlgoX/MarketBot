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

import { extractReadableContent } from "./web-tools.js";

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Example Article</title>
  </head>
  <body>
    <nav>
      <ul>
        <li><a href="/home">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
    <main>
      <article>
        <h1>Example Article</h1>
        <p>Main content starts here with enough words to satisfy readability.</p>
        <p>Second paragraph for a bit more signal.</p>
      </article>
    </main>
    <footer>Footer text</footer>
  </body>
</html>`;

describe("web fetch readability", () => {
  it("extracts readable text", async () => {
    const result = await extractReadableContent({
      html: SAMPLE_HTML,
      url: "https://example.com/article",
      extractMode: "text",
    });
    expect(result?.text).toContain("Main content starts here");
    expect(result?.title).toBe("Example Article");
  });

  it("extracts readable markdown", async () => {
    const result = await extractReadableContent({
      html: SAMPLE_HTML,
      url: "https://example.com/article",
      extractMode: "markdown",
    });
    expect(result?.text).toContain("Main content starts here");
    expect(result?.title).toBe("Example Article");
  });
});

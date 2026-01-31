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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readTerminalCss() {
  // This test is intentionally simple: it guards against regressions where the
  // docs header stops being sticky because sticky elements live inside an
  // overflow-clipped container.
  const path = join(process.cwd(), "docs", "assets", "terminal.css");
  return readFileSync(path, "utf8");
}

describe("docs terminal.css", () => {
  test("keeps the docs header sticky (shell is sticky)", () => {
    const css = readTerminalCss();
    expect(css).toMatch(/\.shell\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*\}/s);
  });

  test("does not rely on making body overflow visible", () => {
    const css = readTerminalCss();
    expect(css).not.toMatch(/body\s*\{[^}]*overflow-x:\s*visible;[^}]*\}/s);
  });

  test("does not make the terminal frame overflow visible (can break layout)", () => {
    const css = readTerminalCss();
    expect(css).not.toMatch(/\.shell__frame\s*\{[^}]*overflow:\s*visible;[^}]*\}/s);
  });
});

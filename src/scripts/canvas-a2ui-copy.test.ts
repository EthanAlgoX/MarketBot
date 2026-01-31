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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { copyA2uiAssets } from "../../scripts/canvas-a2ui-copy.js";

describe("canvas a2ui copy", () => {
  it("throws a helpful error when assets are missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-a2ui-"));

    try {
      await expect(copyA2uiAssets({ srcDir: dir, outDir: path.join(dir, "out") })).rejects.toThrow(
        'Run "pnpm canvas:a2ui:bundle"',
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("copies bundled assets to dist", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-a2ui-"));
    const srcDir = path.join(dir, "src");
    const outDir = path.join(dir, "dist");

    try {
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, "index.html"), "<html></html>", "utf8");
      await fs.writeFile(path.join(srcDir, "a2ui.bundle.js"), "console.log(1);", "utf8");

      await copyA2uiAssets({ srcDir, outDir });

      await expect(fs.stat(path.join(outDir, "index.html"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(outDir, "a2ui.bundle.js"))).resolves.toBeTruthy();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

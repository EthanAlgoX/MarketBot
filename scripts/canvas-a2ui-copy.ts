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
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getA2uiPaths(env = process.env) {
  const srcDir =
    env.MARKETBOT_A2UI_SRC_DIR ?? path.join(repoRoot, "src", "canvas-host", "a2ui");
  const outDir =
    env.MARKETBOT_A2UI_OUT_DIR ?? path.join(repoRoot, "dist", "canvas-host", "a2ui");
  return { srcDir, outDir };
}

export async function copyA2uiAssets({
  srcDir,
  outDir,
}: {
  srcDir: string;
  outDir: string;
}) {
  const skipMissing = process.env.MARKETBOT_A2UI_SKIP_MISSING === "1";
  try {
    await fs.stat(path.join(srcDir, "index.html"));
    await fs.stat(path.join(srcDir, "a2ui.bundle.js"));
  } catch (err) {
    const message =
      'Missing A2UI bundle assets. Run "pnpm canvas:a2ui:bundle" and retry.';
    if (skipMissing) {
      console.warn(`${message} Skipping copy (MARKETBOT_A2UI_SKIP_MISSING=1).`);
      return;
    }
    throw new Error(message, { cause: err });
  }
  await fs.mkdir(path.dirname(outDir), { recursive: true });
  await fs.cp(srcDir, outDir, { recursive: true });
}

async function main() {
  const { srcDir, outDir } = getA2uiPaths();
  await copyA2uiAssets({ srcDir, outDir });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}

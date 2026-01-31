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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runExec } from "../process/exec.js";

export async function movePathToTrash(targetPath: string): Promise<string> {
  try {
    await runExec("trash", [targetPath], { timeoutMs: 10_000 });
    return targetPath;
  } catch {
    const trashDir = path.join(os.homedir(), ".Trash");
    fs.mkdirSync(trashDir, { recursive: true });
    const base = path.basename(targetPath);
    let dest = path.join(trashDir, `${base}-${Date.now()}`);
    if (fs.existsSync(dest)) {
      dest = path.join(trashDir, `${base}-${Date.now()}-${Math.random()}`);
    }
    fs.renameSync(targetPath, dest);
    return dest;
  }
}

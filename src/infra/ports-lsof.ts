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
import fsPromises from "node:fs/promises";

const LSOF_CANDIDATES =
  process.platform === "darwin"
    ? ["/usr/sbin/lsof", "/usr/bin/lsof"]
    : ["/usr/bin/lsof", "/usr/sbin/lsof"];

async function canExecute(path: string): Promise<boolean> {
  try {
    await fsPromises.access(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveLsofCommand(): Promise<string> {
  for (const candidate of LSOF_CANDIDATES) {
    if (await canExecute(candidate)) {
      return candidate;
    }
  }
  return "lsof";
}

export function resolveLsofCommandSync(): string {
  for (const candidate of LSOF_CANDIDATES) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep trying
    }
  }
  return "lsof";
}

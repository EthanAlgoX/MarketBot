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

let wslCached: boolean | null = null;

export function isWSLEnv(): boolean {
  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
    return true;
  }
  return false;
}

export async function isWSL(): Promise<boolean> {
  if (wslCached !== null) {
    return wslCached;
  }
  if (isWSLEnv()) {
    wslCached = true;
    return wslCached;
  }
  try {
    const release = await fs.readFile("/proc/sys/kernel/osrelease", "utf8");
    wslCached =
      release.toLowerCase().includes("microsoft") || release.toLowerCase().includes("wsl");
  } catch {
    wslCached = false;
  }
  return wslCached;
}

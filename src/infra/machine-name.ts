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

import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let cachedPromise: Promise<string> | null = null;

async function tryScutil(key: "ComputerName" | "LocalHostName") {
  try {
    const { stdout } = await execFileAsync("/usr/sbin/scutil", ["--get", key], {
      timeout: 1000,
      windowsHide: true,
    });
    const value = String(stdout ?? "").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function fallbackHostName() {
  return (
    os
      .hostname()
      .replace(/\.local$/i, "")
      .trim() || "marketbot"
  );
}

export async function getMachineDisplayName(): Promise<string> {
  if (cachedPromise) {
    return cachedPromise;
  }
  cachedPromise = (async () => {
    if (process.env.VITEST || process.env.NODE_ENV === "test") {
      return fallbackHostName();
    }
    if (process.platform === "darwin") {
      const computerName = await tryScutil("ComputerName");
      if (computerName) {
        return computerName;
      }
      const localHostName = await tryScutil("LocalHostName");
      if (localHostName) {
        return localHostName;
      }
    }
    return fallbackHostName();
  })();
  return cachedPromise;
}

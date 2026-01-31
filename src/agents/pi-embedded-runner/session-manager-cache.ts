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

import { Buffer } from "node:buffer";
import fs from "node:fs/promises";

import { isCacheEnabled, resolveCacheTtlMs } from "../../config/cache-utils.js";

type SessionManagerCacheEntry = {
  sessionFile: string;
  loadedAt: number;
};

const SESSION_MANAGER_CACHE = new Map<string, SessionManagerCacheEntry>();
const DEFAULT_SESSION_MANAGER_TTL_MS = 45_000; // 45 seconds

function getSessionManagerTtl(): number {
  return resolveCacheTtlMs({
    envValue: process.env.MARKETBOT_SESSION_MANAGER_CACHE_TTL_MS,
    defaultTtlMs: DEFAULT_SESSION_MANAGER_TTL_MS,
  });
}

function isSessionManagerCacheEnabled(): boolean {
  return isCacheEnabled(getSessionManagerTtl());
}

export function trackSessionManagerAccess(sessionFile: string): void {
  if (!isSessionManagerCacheEnabled()) {
    return;
  }
  const now = Date.now();
  SESSION_MANAGER_CACHE.set(sessionFile, {
    sessionFile,
    loadedAt: now,
  });
}

function isSessionManagerCached(sessionFile: string): boolean {
  if (!isSessionManagerCacheEnabled()) {
    return false;
  }
  const entry = SESSION_MANAGER_CACHE.get(sessionFile);
  if (!entry) {
    return false;
  }
  const now = Date.now();
  const ttl = getSessionManagerTtl();
  return now - entry.loadedAt <= ttl;
}

export async function prewarmSessionFile(sessionFile: string): Promise<void> {
  if (!isSessionManagerCacheEnabled()) {
    return;
  }
  if (isSessionManagerCached(sessionFile)) {
    return;
  }

  try {
    // Read a small chunk to encourage OS page cache warmup.
    const handle = await fs.open(sessionFile, "r");
    try {
      const buffer = Buffer.alloc(4096);
      await handle.read(buffer, 0, buffer.length, 0);
    } finally {
      await handle.close();
    }
    trackSessionManagerAccess(sessionFile);
  } catch {
    // File doesn't exist yet, SessionManager will create it
  }
}

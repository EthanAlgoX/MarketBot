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

import type { ChannelDirectoryEntryKind, ChannelId } from "../../channels/plugins/types.js";
import type { MarketBotConfig } from "../../config/config.js";

type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

export type DirectoryCacheKey = {
  channel: ChannelId;
  accountId?: string | null;
  kind: ChannelDirectoryEntryKind;
  source: "cache" | "live";
  signature?: string | null;
};

export function buildDirectoryCacheKey(key: DirectoryCacheKey): string {
  const signature = key.signature ?? "default";
  return `${key.channel}:${key.accountId ?? "default"}:${key.kind}:${key.source}:${signature}`;
}

export class DirectoryCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private lastConfigRef: MarketBotConfig | null = null;

  constructor(private readonly ttlMs: number) {}

  get(key: string, cfg: MarketBotConfig): T | undefined {
    this.resetIfConfigChanged(cfg);
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, cfg: MarketBotConfig): void {
    this.resetIfConfigChanged(cfg);
    this.cache.set(key, { value, fetchedAt: Date.now() });
  }

  clearMatching(match: (key: string) => boolean): void {
    for (const key of this.cache.keys()) {
      if (match(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(cfg?: MarketBotConfig): void {
    this.cache.clear();
    if (cfg) {
      this.lastConfigRef = cfg;
    }
  }

  private resetIfConfigChanged(cfg: MarketBotConfig): void {
    if (this.lastConfigRef && this.lastConfigRef !== cfg) {
      this.cache.clear();
    }
    this.lastConfigRef = cfg;
  }
}

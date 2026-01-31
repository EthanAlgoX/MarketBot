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

import type { GatewayPresenceUpdate } from "discord-api-types/v10";

/**
 * In-memory cache of Discord user presence data.
 * Populated by PRESENCE_UPDATE gateway events when the GuildPresences intent is enabled.
 */
const presenceCache = new Map<string, Map<string, GatewayPresenceUpdate>>();

function resolveAccountKey(accountId?: string): string {
  return accountId ?? "default";
}

/** Update cached presence for a user. */
export function setPresence(
  accountId: string | undefined,
  userId: string,
  data: GatewayPresenceUpdate,
): void {
  const accountKey = resolveAccountKey(accountId);
  let accountCache = presenceCache.get(accountKey);
  if (!accountCache) {
    accountCache = new Map();
    presenceCache.set(accountKey, accountCache);
  }
  accountCache.set(userId, data);
}

/** Get cached presence for a user. Returns undefined if not cached. */
export function getPresence(
  accountId: string | undefined,
  userId: string,
): GatewayPresenceUpdate | undefined {
  return presenceCache.get(resolveAccountKey(accountId))?.get(userId);
}

/** Clear cached presence data. */
export function clearPresences(accountId?: string): void {
  if (accountId) {
    presenceCache.delete(resolveAccountKey(accountId));
    return;
  }
  presenceCache.clear();
}

/** Get the number of cached presence entries. */
export function presenceCacheSize(): number {
  let total = 0;
  for (const accountCache of presenceCache.values()) {
    total += accountCache.size;
  }
  return total;
}

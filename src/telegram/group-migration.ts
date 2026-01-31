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

import type { MarketBotConfig } from "../config/config.js";
import type { TelegramGroupConfig } from "../config/types.telegram.js";
import { normalizeAccountId } from "../routing/session-key.js";

type TelegramGroups = Record<string, TelegramGroupConfig>;

type MigrationScope = "account" | "global";

export type TelegramGroupMigrationResult = {
  migrated: boolean;
  skippedExisting: boolean;
  scopes: MigrationScope[];
};

function resolveAccountGroups(
  cfg: MarketBotConfig,
  accountId?: string | null,
): { groups?: TelegramGroups } {
  if (!accountId) {
    return {};
  }
  const normalized = normalizeAccountId(accountId);
  const accounts = cfg.channels?.telegram?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return {};
  }
  const exact = accounts[normalized];
  if (exact?.groups) {
    return { groups: exact.groups };
  }
  const matchKey = Object.keys(accounts).find(
    (key) => key.toLowerCase() === normalized.toLowerCase(),
  );
  return { groups: matchKey ? accounts[matchKey]?.groups : undefined };
}

export function migrateTelegramGroupsInPlace(
  groups: TelegramGroups | undefined,
  oldChatId: string,
  newChatId: string,
): { migrated: boolean; skippedExisting: boolean } {
  if (!groups) {
    return { migrated: false, skippedExisting: false };
  }
  if (oldChatId === newChatId) {
    return { migrated: false, skippedExisting: false };
  }
  if (!Object.hasOwn(groups, oldChatId)) {
    return { migrated: false, skippedExisting: false };
  }
  if (Object.hasOwn(groups, newChatId)) {
    return { migrated: false, skippedExisting: true };
  }
  groups[newChatId] = groups[oldChatId];
  delete groups[oldChatId];
  return { migrated: true, skippedExisting: false };
}

export function migrateTelegramGroupConfig(params: {
  cfg: MarketBotConfig;
  accountId?: string | null;
  oldChatId: string;
  newChatId: string;
}): TelegramGroupMigrationResult {
  const scopes: MigrationScope[] = [];
  let migrated = false;
  let skippedExisting = false;

  const accountGroups = resolveAccountGroups(params.cfg, params.accountId).groups;
  if (accountGroups) {
    const result = migrateTelegramGroupsInPlace(accountGroups, params.oldChatId, params.newChatId);
    if (result.migrated) {
      migrated = true;
      scopes.push("account");
    }
    if (result.skippedExisting) {
      skippedExisting = true;
    }
  }

  const globalGroups = params.cfg.channels?.telegram?.groups;
  if (globalGroups) {
    const result = migrateTelegramGroupsInPlace(globalGroups, params.oldChatId, params.newChatId);
    if (result.migrated) {
      migrated = true;
      scopes.push("global");
    }
    if (result.skippedExisting) {
      skippedExisting = true;
    }
  }

  return { migrated, skippedExisting, scopes };
}

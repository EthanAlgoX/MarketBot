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
import type { SignalAccountConfig } from "../config/types.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";

export type ResolvedSignalAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  baseUrl: string;
  configured: boolean;
  config: SignalAccountConfig;
};

function listConfiguredAccountIds(cfg: MarketBotConfig): string[] {
  const accounts = cfg.channels?.signal?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}

export function listSignalAccountIds(cfg: MarketBotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}

export function resolveDefaultSignalAccountId(cfg: MarketBotConfig): string {
  const ids = listSignalAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: MarketBotConfig,
  accountId: string,
): SignalAccountConfig | undefined {
  const accounts = cfg.channels?.signal?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  return accounts[accountId] as SignalAccountConfig | undefined;
}

function mergeSignalAccountConfig(cfg: MarketBotConfig, accountId: string): SignalAccountConfig {
  const { accounts: _ignored, ...base } = (cfg.channels?.signal ?? {}) as SignalAccountConfig & {
    accounts?: unknown;
  };
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveSignalAccount(params: {
  cfg: MarketBotConfig;
  accountId?: string | null;
}): ResolvedSignalAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.signal?.enabled !== false;
  const merged = mergeSignalAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const host = merged.httpHost?.trim() || "127.0.0.1";
  const port = merged.httpPort ?? 8080;
  const baseUrl = merged.httpUrl?.trim() || `http://${host}:${port}`;
  const configured = Boolean(
    merged.account?.trim() ||
    merged.httpUrl?.trim() ||
    merged.cliPath?.trim() ||
    merged.httpHost?.trim() ||
    typeof merged.httpPort === "number" ||
    typeof merged.autoStart === "boolean",
  );
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    baseUrl,
    configured,
    config: merged,
  };
}

export function listEnabledSignalAccounts(cfg: MarketBotConfig): ResolvedSignalAccount[] {
  return listSignalAccountIds(cfg)
    .map((accountId) => resolveSignalAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

import type { MarketBotConfig } from "marketbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "marketbot/plugin-sdk";

import type { QQBotAccountConfig, QQBotConfig, ResolvedQQBotAccount } from "./types.js";

function listConfiguredAccountIds(cfg: MarketBotConfig): string[] {
  const accounts = (cfg.channels?.qqbot as QQBotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listQQBotAccountIds(cfg: MarketBotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultQQBotAccountId(cfg: MarketBotConfig): string {
  const qqCfg = cfg.channels?.qqbot as QQBotConfig | undefined;
  if (qqCfg?.defaultAccount?.trim()) return qqCfg.defaultAccount.trim();
  const ids = listQQBotAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(cfg: MarketBotConfig, accountId: string): QQBotAccountConfig | undefined {
  const accounts = (cfg.channels?.qqbot as QQBotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as QQBotAccountConfig | undefined;
}

function mergeQQBotAccountConfig(cfg: MarketBotConfig, accountId: string): QQBotAccountConfig {
  const raw = (cfg.channels?.qqbot ?? {}) as QQBotConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveQQBotAccount(params: {
  cfg: MarketBotConfig;
  accountId?: string | null;
}): ResolvedQQBotAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = (params.cfg.channels?.qqbot as QQBotConfig | undefined)?.enabled !== false;
  const merged = mergeQQBotAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;
  const configured = Boolean(merged.appId?.trim() && merged.clientSecret?.trim());
  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    config: merged,
  };
}


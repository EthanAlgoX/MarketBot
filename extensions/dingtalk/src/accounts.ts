import type { MarketBotConfig } from "marketbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "marketbot/plugin-sdk";

import type { DingTalkAccountConfig, DingTalkConfig, ResolvedDingTalkAccount } from "./types.js";

function listConfiguredAccountIds(cfg: MarketBotConfig): string[] {
  const accounts = (cfg.channels?.dingtalk as DingTalkConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listDingTalkAccountIds(cfg: MarketBotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultDingTalkAccountId(cfg: MarketBotConfig): string {
  const dtCfg = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  if (dtCfg?.defaultAccount?.trim()) return dtCfg.defaultAccount.trim();
  const ids = listDingTalkAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(cfg: MarketBotConfig, accountId: string): DingTalkAccountConfig | undefined {
  const accounts = (cfg.channels?.dingtalk as DingTalkConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as DingTalkAccountConfig | undefined;
}

function mergeDingTalkAccountConfig(cfg: MarketBotConfig, accountId: string): DingTalkAccountConfig {
  const raw = (cfg.channels?.dingtalk ?? {}) as DingTalkConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveDingTalkAccount(params: {
  cfg: MarketBotConfig;
  accountId?: string | null;
}): ResolvedDingTalkAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = (params.cfg.channels?.dingtalk as DingTalkConfig | undefined)?.enabled !== false;
  const merged = mergeDingTalkAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;
  const configured = Boolean(merged.clientId?.trim() && merged.clientSecret?.trim());
  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    config: merged,
  };
}


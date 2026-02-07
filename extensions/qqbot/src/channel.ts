import type { ChannelAccountSnapshot, ChannelPlugin, MarketBotConfig } from "marketbot/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  setAccountEnabledInConfigSection,
} from "marketbot/plugin-sdk";

import { QQBotConfigSchema } from "./config-schema.js";
import {
  listQQBotAccountIds,
  resolveDefaultQQBotAccountId,
  resolveQQBotAccount,
  type ResolvedQQBotAccount,
} from "./accounts.js";
import { getQQBotRuntime } from "./runtime.js";
import { startQQBotGateway } from "./gateway.js";
import { getQQBotAccessToken, sendQQBotC2CMessage } from "./api.js";

const meta = {
  id: "qqbot",
  label: "QQ Bot",
  selectionLabel: "QQ Bot (QQ机器人)",
  docsPath: "/channels/qqbot",
  docsLabel: "qqbot",
  blurb: "Tencent QQ bot via Gateway WebSocket.",
  aliases: ["qq", "qq-bot"],
  order: 74,
  quickstartAllowFrom: true,
};

export const qqbotPlugin: ChannelPlugin<ResolvedQQBotAccount> = {
  id: "qqbot",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.qqbot"] },
  configSchema: buildChannelConfigSchema(QQBotConfigSchema),
  config: {
    listAccountIds: (cfg) => listQQBotAccountIds(cfg as MarketBotConfig),
    resolveAccount: (cfg, accountId) => resolveQQBotAccount({ cfg: cfg as MarketBotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultQQBotAccountId(cfg as MarketBotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "qqbot",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "qqbot",
        accountId,
        clearBaseFields: ["appId", "clientSecret", "intents", "name"],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveQQBotAccount({ cfg: cfg as MarketBotConfig, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean((cfg as MarketBotConfig).channels?.qqbot?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.qqbot.accounts.${resolvedAccountId}.` : "channels.qqbot.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint("qqbot"),
        normalizeEntry: (raw) => raw.trim(),
      };
    },
  },
  messaging: {
    normalizeTarget: (raw) => raw.trim(),
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "<userOpenid>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 1500,
    sendText: async ({ to, text, accountId, cfg }) => {
      const account = resolveQQBotAccount({ cfg: cfg as MarketBotConfig, accountId });
      if (!account.configured) throw new Error("QQBot not configured");
      const token = await getQQBotAccessToken({
        appId: account.config.appId!.trim(),
        clientSecret: account.config.clientSecret!.trim(),
      });
      await sendQQBotC2CMessage({ accessToken: token, userOpenid: to, content: text ?? "" });
      return { channel: "qqbot", to };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot?.configured ?? false,
      running: snapshot?.running ?? false,
      lastStartAt: snapshot?.lastStartAt ?? null,
      lastStopAt: snapshot?.lastStopAt ?? null,
      lastError: snapshot?.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.configured) throw new Error("QQBot is not configured (appId + clientSecret required).");
      getQQBotRuntime();
      ctx.setStatus({ running: true, configured: true, lastStartAt: Date.now() });
      const handle = await startQQBotGateway({
        account,
        cfg: ctx.cfg as MarketBotConfig,
        abortSignal: ctx.abortSignal,
        log: {
          info: (msg) => ctx.log?.info?.(msg),
          error: (msg) => ctx.log?.error?.(msg),
          debug: (msg) => ctx.log?.debug?.(msg),
        },
        statusSink: (patch) => ctx.setStatus(patch),
      });
      return {
        stop: () => {
          handle.stop();
          ctx.setStatus({ running: false, lastStopAt: Date.now() });
        },
      };
    },
  },
};


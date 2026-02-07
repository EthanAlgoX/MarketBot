import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  MarketBotConfig,
} from "marketbot/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  setAccountEnabledInConfigSection,
} from "marketbot/plugin-sdk";

import { WecomConfigSchema } from "./config-schema.js";
import {
  listWecomAccountIds,
  resolveDefaultWecomAccountId,
  resolveWecomAccount,
  type ResolvedWecomAccount,
} from "./accounts.js";
import { startWecomWebhookMonitor } from "./monitor.js";
import { getWecomRuntime } from "./runtime.js";

const meta = {
  id: "wecom",
  label: "WeCom",
  selectionLabel: "WeCom (企业微信)",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "WeCom webhook-based bot (signature + AES).",
  aliases: ["qywx", "wechatwork", "wxwork"],
  order: 72,
  quickstartAllowFrom: true,
};

export const wecomPlugin: ChannelPlugin<ResolvedWecomAccount> = {
  id: "wecom",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WecomConfigSchema),
  config: {
    listAccountIds: (cfg) => listWecomAccountIds(cfg as MarketBotConfig),
    resolveAccount: (cfg, accountId) => resolveWecomAccount({ cfg: cfg as MarketBotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWecomAccountId(cfg as MarketBotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "wecom",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "wecom",
        accountId,
        clearBaseFields: ["token", "encodingAesKey", "corpId", "name", "webhookUrl", "webhookPath"],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveWecomAccount({ cfg: cfg as MarketBotConfig, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg as MarketBotConfig).channels?.wecom?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.wecom.accounts.${resolvedAccountId}.`
        : "channels.wecom.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint("wecom"),
        normalizeEntry: (raw) => raw.trim(),
      };
    },
  },
  messaging: {
    normalizeTarget: (raw) => raw.trim(),
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "<userid>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 1000,
    sendText: async () => {
      // WeCom AI bot webhooks reliably support "reply" to an inbound event.
      // Proactive outbound needs a different API surface (access token + agentId), which we don't enable in MVP.
      throw new Error("WeCom outbound send is not supported in MVP. Reply to an inbound message instead.");
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
      getWecomRuntime();

      ctx.setStatus({ accountId: account.accountId, configured: account.configured });
      if (!account.configured) {
        throw new Error("WeCom is not configured (token + encodingAesKey + corpId required).");
      }

      const monitor = startWecomWebhookMonitor({
        account,
        config: ctx.cfg as MarketBotConfig,
        runtime: {
          log: (message) => ctx.log?.info?.(message),
          error: (message) => ctx.log?.error?.(message),
        },
        token: account.config.token!.trim(),
        encodingAesKey: account.config.encodingAesKey!.trim(),
        corpId: account.config.corpId!.trim(),
        abortSignal: ctx.abortSignal,
        webhookPath: account.config.webhookPath,
        webhookUrl: account.config.webhookUrl,
        statusSink: (patch) => ctx.setStatus(patch),
      });

      // Touch runtime to ensure plugin runtime wiring is ready early.
      void runtime;

      return {
        stop: () => monitor.stop(),
      };
    },
  },
};

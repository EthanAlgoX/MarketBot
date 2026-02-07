import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";
import type { ChannelAccountSnapshot, ChannelPlugin, MarketBotConfig } from "marketbot/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  setAccountEnabledInConfigSection,
} from "marketbot/plugin-sdk";

import { DingTalkConfigSchema } from "./config-schema.js";
import {
  listDingTalkAccountIds,
  resolveDefaultDingTalkAccountId,
  resolveDingTalkAccount,
  type ResolvedDingTalkAccount,
} from "./accounts.js";
import type { DingTalkInboundMessage } from "./types.js";
import { getDingTalkRuntime } from "./runtime.js";
import { getDingTalkAccessToken, sendDingTalkSessionMessage } from "./api.js";

const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL_MS = 5 * 60 * 1000;

function markProcessed(messageId: string): void {
  processedMessages.set(messageId, Date.now());
  if (processedMessages.size < 500) return;
  const now = Date.now();
  for (const [id, ts] of processedMessages.entries()) {
    if (now - ts > MESSAGE_DEDUP_TTL_MS) processedMessages.delete(id);
  }
}

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalized = senderId.trim().toLowerCase();
  return allowFrom.some((raw) => String(raw).trim().toLowerCase() === normalized);
}

const meta = {
  id: "dingtalk",
  label: "DingTalk",
  selectionLabel: "DingTalk (钉钉)",
  docsPath: "/channels/dingtalk",
  docsLabel: "dingtalk",
  blurb: "DingTalk Stream mode bot.",
  aliases: ["ding", "dd"],
  order: 73,
  quickstartAllowFrom: true,
};

export const dingtalkPlugin: ChannelPlugin<ResolvedDingTalkAccount> = {
  id: "dingtalk",
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
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: buildChannelConfigSchema(DingTalkConfigSchema),
  config: {
    listAccountIds: (cfg) => listDingTalkAccountIds(cfg as MarketBotConfig),
    resolveAccount: (cfg, accountId) =>
      resolveDingTalkAccount({ cfg: cfg as MarketBotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultDingTalkAccountId(cfg as MarketBotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "dingtalk",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as MarketBotConfig,
        sectionKey: "dingtalk",
        accountId,
        clearBaseFields: ["clientId", "clientSecret", "robotCode", "name"],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      clientId: account.config.clientId ? "***" : undefined,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveDingTalkAccount({ cfg: cfg as MarketBotConfig, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg as MarketBotConfig).channels?.dingtalk?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.dingtalk.accounts.${resolvedAccountId}.`
        : "channels.dingtalk.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint("dingtalk"),
        normalizeEntry: (raw) => raw.replace(/^(dingtalk|dd|ding):/i, "").trim(),
      };
    },
  },
  messaging: {
    normalizeTarget: (raw) => raw.trim(),
    targetResolver: {
      looksLikeId: (raw) => raw.trim().startsWith("session:"),
      hint: "session:<sessionWebhookUrl>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 2000,
    sendText: async ({ to, text, accountId, cfg }) => {
      const account = resolveDingTalkAccount({ cfg: cfg as MarketBotConfig, accountId });
      if (!account.configured) throw new Error("DingTalk not configured");
      const sessionWebhook = to.startsWith("session:") ? to.slice("session:".length).trim() : "";
      if (!sessionWebhook) {
        throw new Error('DingTalk outbound in MVP requires "session:<sessionWebhookUrl>" target (or reply to inbound).');
      }
      const accessToken = await getDingTalkAccessToken({
        clientId: account.config.clientId!.trim(),
        clientSecret: account.config.clientSecret!.trim(),
      });
      await sendDingTalkSessionMessage({ sessionWebhook, accessToken, text: text ?? "" });
      return { channel: "dingtalk", to: sessionWebhook };
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
      if (!account.configured) {
        throw new Error("DingTalk is not configured (clientId + clientSecret required).");
      }

      const runtime = getDingTalkRuntime();

      ctx.setStatus({ running: true, configured: true, lastStartAt: Date.now() });

      const client = new DWClient({
        clientId: account.config.clientId!.trim(),
        clientSecret: account.config.clientSecret!.trim(),
        debug: account.config.debug === true,
        keepAlive: true,
      } as any);

      client.registerCallbackListener(TOPIC_ROBOT, async (res: any) => {
        const headerMessageId = res?.headers?.messageId;
        const ack = () => {
          if (headerMessageId) {
            try {
              client.socketCallBackResponse(headerMessageId, { success: true });
            } catch {}
          }
        };

        try {
          ack();
          const data = JSON.parse(String(res.data ?? "{}")) as DingTalkInboundMessage;
          const dedupKey = String(data.msgId ?? headerMessageId ?? "");
          if (dedupKey) {
            const seenAt = processedMessages.get(dedupKey);
            if (seenAt && Date.now() - seenAt < MESSAGE_DEDUP_TTL_MS) return;
            markProcessed(dedupKey);
          }

          const senderId = String(data.senderId ?? "");
          const allowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));
          if (senderId && allowFrom.length > 0 && !isSenderAllowed(senderId, allowFrom)) return;

          const text = String(data.text?.content ?? "").trim();
          const sessionWebhook = String(data.sessionWebhook ?? "").trim();
          if (!text || !sessionWebhook) return;

          ctx.setStatus({ lastInboundAt: Date.now() });

          await runtime.channel.reply.handleInboundMessage({
            channel: "dingtalk",
            accountId: account.accountId,
            senderId: senderId || "unknown",
            chatType: data.conversationType === "2" ? "group" : "direct",
            chatId: String(data.conversationId ?? senderId ?? "unknown"),
            text,
            reply: async (responseText: string) => {
              const accessToken = await getDingTalkAccessToken({
                clientId: account.config.clientId!.trim(),
                clientSecret: account.config.clientSecret!.trim(),
              });
              await sendDingTalkSessionMessage({
                sessionWebhook,
                accessToken,
                text: responseText ?? "",
              });
              ctx.setStatus({ lastOutboundAt: Date.now() });
            },
          });
        } catch (err) {
          ctx.setStatus({ lastError: err instanceof Error ? err.message : String(err) });
          ctx.log?.error?.(`[dingtalk:${account.accountId}] inbound failed: ${String(err)}`);
        }
      });

      await client.connect();

      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        ctx.setStatus({ running: false, lastStopAt: Date.now() });
        try {
          (client as any).disconnect?.();
        } catch {}
        try {
          (client as any).close?.();
        } catch {}
      };
      ctx.abortSignal?.addEventListener("abort", stop);
      return { stop };
    },
  },
};


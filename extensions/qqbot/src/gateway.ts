import WebSocket from "ws";

import type { MarketBotConfig } from "marketbot/plugin-sdk";

import type {
  C2CMessageEvent,
  GroupMessageEvent,
  GuildMessageEvent,
  ResolvedQQBotAccount,
  WSPayload,
} from "./types.js";
import {
  clearQQBotTokenCache,
  getQQBotAccessToken,
  getQQBotGatewayUrl,
  sendQQBotC2CMessage,
  sendQQBotChannelMessage,
  sendQQBotGroupMessage,
} from "./api.js";
import { getQQBotRuntime } from "./runtime.js";

export type QQBotGatewayHandle = { stop: () => void };

const DEFAULT_INTENTS = (1 << 30) | (1 << 12) | (1 << 25);

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalized = senderId.trim().toLowerCase();
  return allowFrom.some((raw) => String(raw).trim().toLowerCase() === normalized);
}

export async function startQQBotGateway(params: {
  account: ResolvedQQBotAccount;
  cfg: MarketBotConfig;
  abortSignal: AbortSignal;
  log?: { info?: (msg: string) => void; error?: (msg: string) => void; debug?: (msg: string) => void };
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<QQBotGatewayHandle> {
  const { account, abortSignal, log, statusSink } = params;
  if (!account.configured) throw new Error("QQBot not configured (appId + clientSecret required)");

  const runtime = getQQBotRuntime();
  const allowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));

  let stopped = false;
  let ws: WebSocket | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastSeq: number | null = null;

  const cleanup = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    try {
      ws?.close();
    } catch {}
    ws = null;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cleanup();
  };
  abortSignal?.addEventListener("abort", stop);

  const accessToken = await getQQBotAccessToken({
    appId: account.config.appId!.trim(),
    clientSecret: account.config.clientSecret!.trim(),
  });
  const gatewayUrl = await getQQBotGatewayUrl(accessToken);
  ws = new WebSocket(gatewayUrl);

  ws.on("message", async (data) => {
    try {
      const payload = JSON.parse(String(data)) as WSPayload;
      if (typeof payload.s === "number") lastSeq = payload.s;

      switch (payload.op) {
        case 10: {
          const interval = (payload.d as any)?.heartbeat_interval as number | undefined;
          ws?.send(
            JSON.stringify({
              op: 2,
              d: {
                token: `QQBot ${accessToken}`,
                intents: account.config.intents ?? DEFAULT_INTENTS,
                shard: [0, 1],
              },
            }),
          );
          if (typeof interval === "number" && interval > 1000) {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 1, d: lastSeq }));
              }
            }, interval);
          }
          break;
        }
        case 0: {
          const t = payload.t ?? "";
          if (t === "C2C_MESSAGE_CREATE") {
            const ev = payload.d as C2CMessageEvent;
            const senderId = ev.author.user_openid;
            if (allowFrom.length > 0 && !isSenderAllowed(senderId, allowFrom)) return;
            statusSink?.({ lastInboundAt: Date.now() });
            await runtime.channel.reply.handleInboundMessage({
              channel: "qqbot",
              accountId: account.accountId,
              senderId,
              chatType: "direct",
              chatId: senderId,
              text: String(ev.content ?? "").trim(),
              reply: async (responseText: string) => {
                const token = await getQQBotAccessToken({
                  appId: account.config.appId!.trim(),
                  clientSecret: account.config.clientSecret!.trim(),
                });
                await sendQQBotC2CMessage({
                  accessToken: token,
                  userOpenid: senderId,
                  content: responseText ?? "",
                  msgId: ev.id,
                });
                statusSink?.({ lastOutboundAt: Date.now() });
              },
            });
          } else if (t === "GROUP_AT_MESSAGE_CREATE") {
            const ev = payload.d as GroupMessageEvent;
            const senderId = ev.author.member_openid;
            if (allowFrom.length > 0 && !isSenderAllowed(senderId, allowFrom)) return;
            statusSink?.({ lastInboundAt: Date.now() });
            await runtime.channel.reply.handleInboundMessage({
              channel: "qqbot",
              accountId: account.accountId,
              senderId,
              chatType: "group",
              chatId: ev.group_openid,
              text: String(ev.content ?? "").trim(),
              reply: async (responseText: string) => {
                const token = await getQQBotAccessToken({
                  appId: account.config.appId!.trim(),
                  clientSecret: account.config.clientSecret!.trim(),
                });
                await sendQQBotGroupMessage({
                  accessToken: token,
                  groupOpenid: ev.group_openid,
                  content: responseText ?? "",
                  msgId: ev.id,
                });
                statusSink?.({ lastOutboundAt: Date.now() });
              },
            });
          } else if (t === "AT_MESSAGE_CREATE") {
            const ev = payload.d as GuildMessageEvent;
            const senderId = ev.author.id;
            if (allowFrom.length > 0 && !isSenderAllowed(senderId, allowFrom)) return;
            statusSink?.({ lastInboundAt: Date.now() });
            await runtime.channel.reply.handleInboundMessage({
              channel: "qqbot",
              accountId: account.accountId,
              senderId,
              chatType: "group",
              chatId: ev.channel_id,
              text: String(ev.content ?? "").trim(),
              reply: async (responseText: string) => {
                const token = await getQQBotAccessToken({
                  appId: account.config.appId!.trim(),
                  clientSecret: account.config.clientSecret!.trim(),
                });
                await sendQQBotChannelMessage({
                  accessToken: token,
                  channelId: ev.channel_id,
                  content: responseText ?? "",
                  msgId: ev.id,
                });
                statusSink?.({ lastOutboundAt: Date.now() });
              },
            });
          }
          break;
        }
        case 9: {
          clearQQBotTokenCache();
          cleanup();
          break;
        }
        default:
          break;
      }
    } catch (err) {
      log?.error?.(`[qqbot:${account.accountId}] ws message handler error: ${String(err)}`);
    }
  });

  ws.on("close", () => {
    if (!stopped) log?.info?.(`[qqbot:${account.accountId}] gateway closed`);
    cleanup();
  });
  ws.on("error", (err) => {
    log?.error?.(`[qqbot:${account.accountId}] gateway error: ${String(err)}`);
  });

  return { stop };
}


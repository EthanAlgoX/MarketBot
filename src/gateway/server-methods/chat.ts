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

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CURRENT_SESSION_VERSION } from "@mariozechner/pi-coding-agent";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { resolveEffectiveMessagesConfig, resolveIdentityName } from "../../agents/identity.js";
import { resolveThinkingDefault } from "../../agents/model-selection.js";
import { resolveAgentTimeoutMs } from "../../agents/timeout.js";
import { dispatchInboundMessage } from "../../auto-reply/dispatch.js";
import { createReplyDispatcher } from "../../auto-reply/reply/reply-dispatcher.js";
import {
  extractShortModelName,
  type ResponsePrefixContext,
} from "../../auto-reply/reply/response-prefix-template.js";
import type { MsgContext } from "../../auto-reply/templating.js";
import { updateSessionStore } from "../../config/sessions.js";
import { resolveSendPolicy } from "../../sessions/send-policy.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../utils/message-channel.js";
import {
  abortChatRunById,
  abortChatRunsForSessionKey,
  isChatStopCommandText,
  resolveChatRunExpiresAtMs,
} from "../chat-abort.js";
import { type ChatImageContent, parseMessageWithAttachments } from "../chat-attachments.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateChatAbortParams,
  validateChatHistoryParams,
  validateChatInjectParams,
  validateChatSendParams,
} from "../protocol/index.js";
import { getMaxChatHistoryMessagesBytes } from "../server-constants.js";
import {
  capArrayByJsonBytes,
  loadSessionEntry,
  readSessionMessages,
  resolveSessionModelRef,
} from "../session-utils.js";
import { stripEnvelopeFromMessages } from "../chat-sanitize.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./types.js";
import { MarketDataClient } from "../../finance/client.js";

const MAG7_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"] as const;

function isMag7ChartRequest(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  const hasMag7 = /(美股七姐妹|七姐妹|magnificent\s*7|mag\s*7)/i.test(normalized);
  const hasChartOrData = /(图表|绘制|画图|chart|graph|股票数据|行情|走势)/i.test(normalized);
  return hasMag7 && hasChartOrData;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function normalizeChangePercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  // Some providers return fractional values (-0.0233), others return percent values (-2.33).
  return Math.abs(value) <= 1 ? value * 100 : value;
}

async function buildMag7SummaryReply(
  config: ReturnType<typeof loadSessionEntry>["cfg"],
): Promise<string> {
  const client = new MarketDataClient({
    profile: "marketbot",
    config,
  });
  const quotes = await client.getQuotes([...MAG7_SYMBOLS]);
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]));
  const rows = MAG7_SYMBOLS.map((symbol) => {
    const quote = bySymbol.get(symbol);
    return {
      symbol,
      price: toFiniteNumber(quote?.regularMarketPrice),
      changePct: normalizeChangePercent(toFiniteNumber(quote?.regularMarketChangePercent)),
      ts: toFiniteNumber(quote?.regularMarketTime),
    };
  });

  const knownPrices = rows.filter((row) => row.price !== null);
  if (knownPrices.length === 0) {
    throw new Error("market data unavailable for magnificent seven");
  }

  const latestEpochSec = rows.reduce<number>((max, row) => {
    if (row.ts === null) {
      return max;
    }
    return row.ts > max ? row.ts : max;
  }, 0);
  const latestTimeText =
    latestEpochSec > 0
      ? new Date(latestEpochSec > 1_000_000_000_000 ? latestEpochSec : latestEpochSec * 1000)
          .toISOString()
          .replace("T", " ")
          .replace("Z", " UTC")
      : "unknown";

  const priceBars = rows
    .map((row) => Number(formatPrice(row.price)))
    .map((value) => (Number.isFinite(value) ? value : 0));
  const changeBars = rows.map((row) => Number((row.changePct ?? 0).toFixed(2)));

  const tableLines = rows.map(
    (row) => `| ${row.symbol} | ${formatPrice(row.price)} | ${formatPercent(row.changePct)} |`,
  );

  return [
    "美股七姐妹（Magnificent Seven）：AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA。",
    `行情快照时间：${latestTimeText}。`,
    "",
    "| 股票 | 现价(USD) | 涨跌幅 |",
    "|---|---:|---:|",
    ...tableLines,
    "",
    "```mermaid",
    "xychart-beta",
    '  title "美股七姐妹：最新价格(USD)"',
    '  x-axis ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA"]',
    '  y-axis "USD" 0 --> 800',
    `  bar [${priceBars.join(",")}]`,
    "```",
    "",
    "```mermaid",
    "xychart-beta",
    '  title "美股七姐妹：涨跌幅(%)"',
    '  x-axis ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA"]',
    '  y-axis "%" -10 --> 10',
    `  bar [${changeBars.join(",")}]`,
    "```",
    "",
    "数据来源：finance 工具（marketbot profile / Yahoo）。",
  ].join("\n");
}

type TranscriptAppendResult = {
  ok: boolean;
  messageId?: string;
  message?: Record<string, unknown>;
  error?: string;
};

function resolveTranscriptPath(params: {
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
}): string | null {
  const { sessionId, storePath, sessionFile } = params;
  if (sessionFile) {
    return sessionFile;
  }
  if (!storePath) {
    return null;
  }
  return path.join(path.dirname(storePath), `${sessionId}.jsonl`);
}

function ensureTranscriptFile(params: { transcriptPath: string; sessionId: string }): {
  ok: boolean;
  error?: string;
} {
  if (fs.existsSync(params.transcriptPath)) {
    return { ok: true };
  }
  try {
    fs.mkdirSync(path.dirname(params.transcriptPath), { recursive: true });
    const header = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: params.sessionId,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
    };
    fs.writeFileSync(params.transcriptPath, `${JSON.stringify(header)}\n`, "utf-8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function appendAssistantTranscriptMessage(params: {
  message: string;
  label?: string;
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
  createIfMissing?: boolean;
}): TranscriptAppendResult {
  const transcriptPath = resolveTranscriptPath({
    sessionId: params.sessionId,
    storePath: params.storePath,
    sessionFile: params.sessionFile,
  });
  if (!transcriptPath) {
    return { ok: false, error: "transcript path not resolved" };
  }

  if (!fs.existsSync(transcriptPath)) {
    if (!params.createIfMissing) {
      return { ok: false, error: "transcript file not found" };
    }
    const ensured = ensureTranscriptFile({
      transcriptPath,
      sessionId: params.sessionId,
    });
    if (!ensured.ok) {
      return { ok: false, error: ensured.error ?? "failed to create transcript file" };
    }
  }

  const now = Date.now();
  const messageId = randomUUID().slice(0, 8);
  const labelPrefix = params.label ? `[${params.label}]\n\n` : "";
  const messageBody: Record<string, unknown> = {
    role: "assistant",
    content: [{ type: "text", text: `${labelPrefix}${params.message}` }],
    timestamp: now,
    stopReason: "injected",
    usage: { input: 0, output: 0, totalTokens: 0 },
  };
  const transcriptEntry = {
    type: "message",
    id: messageId,
    timestamp: new Date(now).toISOString(),
    message: messageBody,
  };

  try {
    fs.appendFileSync(transcriptPath, `${JSON.stringify(transcriptEntry)}\n`, "utf-8");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, messageId, message: transcriptEntry.message };
}

async function ensureSessionEntryForReply(params: {
  storePath: string | undefined;
  canonicalKey: string;
  entry: ReturnType<typeof loadSessionEntry>["entry"];
  fallbackSessionId: string;
  onWarn: (message: string) => void;
}): Promise<{ sessionId: string; sessionFile?: string; storePath: string | undefined }> {
  let sessionId = params.entry?.sessionId ?? params.fallbackSessionId;
  let sessionFile = params.entry?.sessionFile;
  if (!params.storePath) {
    return {
      sessionId,
      sessionFile,
      storePath: params.storePath,
    };
  }

  const now = Date.now();
  try {
    await updateSessionStore(params.storePath, (store) => {
      const current = store[params.canonicalKey] ?? params.entry;
      sessionId = current?.sessionId ?? sessionId;
      const next = {
        ...current,
        sessionId,
        updatedAt: Math.max(current?.updatedAt ?? 0, now),
      };
      store[params.canonicalKey] = next;
      sessionFile = next.sessionFile;
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    params.onWarn(`webchat session store update failed: ${reason}`);
  }

  return {
    sessionId,
    sessionFile,
    storePath: params.storePath,
  };
}

function nextChatSeq(context: { agentRunSeq: Map<string, number> }, runId: string) {
  const next = (context.agentRunSeq.get(runId) ?? 0) + 1;
  context.agentRunSeq.set(runId, next);
  return next;
}

function broadcastChatFinal(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  message?: Record<string, unknown>;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "final" as const,
    message: params.message,
  };
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
}

function broadcastChatError(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  errorMessage?: string;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "error" as const,
    errorMessage: params.errorMessage,
  };
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
}

export const chatHandlers: GatewayRequestHandlers = {
  "chat.history": async ({ params, respond, context }) => {
    if (!validateChatHistoryParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.history params: ${formatValidationErrors(validateChatHistoryParams.errors)}`,
        ),
      );
      return;
    }
    const { sessionKey, limit } = params as {
      sessionKey: string;
      limit?: number;
    };
    const { cfg, storePath, entry } = loadSessionEntry(sessionKey);
    const sessionId = entry?.sessionId;
    const rawMessages =
      sessionId && storePath ? readSessionMessages(sessionId, storePath, entry?.sessionFile) : [];
    const hardMax = 1000;
    const defaultLimit = 200;
    const requested = typeof limit === "number" ? limit : defaultLimit;
    const max = Math.min(hardMax, requested);
    const sliced = rawMessages.length > max ? rawMessages.slice(-max) : rawMessages;
    const sanitized = stripEnvelopeFromMessages(sliced);
    const capped = capArrayByJsonBytes(sanitized, getMaxChatHistoryMessagesBytes()).items;
    let thinkingLevel = entry?.thinkingLevel;
    if (!thinkingLevel) {
      const configured = cfg.agents?.defaults?.thinkingDefault;
      if (configured) {
        thinkingLevel = configured;
      } else {
        const { provider, model } = resolveSessionModelRef(cfg, entry);
        const catalog = await context.loadGatewayModelCatalog();
        thinkingLevel = resolveThinkingDefault({
          cfg,
          provider,
          model,
          catalog,
        });
      }
    }
    respond(true, {
      sessionKey,
      sessionId,
      messages: capped,
      thinkingLevel,
    });
  },
  "chat.abort": ({ params, respond, context }) => {
    if (!validateChatAbortParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.abort params: ${formatValidationErrors(validateChatAbortParams.errors)}`,
        ),
      );
      return;
    }
    const { sessionKey, runId } = params as {
      sessionKey: string;
      runId?: string;
    };

    const ops = {
      chatAbortControllers: context.chatAbortControllers,
      chatRunBuffers: context.chatRunBuffers,
      chatDeltaSentAt: context.chatDeltaSentAt,
      chatAbortedRuns: context.chatAbortedRuns,
      removeChatRun: context.removeChatRun,
      agentRunSeq: context.agentRunSeq,
      broadcast: context.broadcast,
      nodeSendToSession: context.nodeSendToSession,
    };

    if (!runId) {
      const res = abortChatRunsForSessionKey(ops, {
        sessionKey,
        stopReason: "rpc",
      });
      respond(true, { ok: true, aborted: res.aborted, runIds: res.runIds });
      return;
    }

    const active = context.chatAbortControllers.get(runId);
    if (!active) {
      respond(true, { ok: true, aborted: false, runIds: [] });
      return;
    }
    if (active.sessionKey !== sessionKey) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "runId does not match sessionKey"),
      );
      return;
    }

    const res = abortChatRunById(ops, {
      runId,
      sessionKey,
      stopReason: "rpc",
    });
    respond(true, {
      ok: true,
      aborted: res.aborted,
      runIds: res.aborted ? [runId] : [],
    });
  },
  "chat.send": async ({ params, respond, context, client }) => {
    if (!validateChatSendParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.send params: ${formatValidationErrors(validateChatSendParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      sessionKey: string;
      message: string;
      thinking?: string;
      deliver?: boolean;
      attachments?: Array<{
        type?: string;
        mimeType?: string;
        fileName?: string;
        content?: unknown;
      }>;
      timeoutMs?: number;
      idempotencyKey: string;
    };
    const stopCommand = isChatStopCommandText(p.message);
    const normalizedAttachments =
      p.attachments
        ?.map((a) => ({
          type: typeof a?.type === "string" ? a.type : undefined,
          mimeType: typeof a?.mimeType === "string" ? a.mimeType : undefined,
          fileName: typeof a?.fileName === "string" ? a.fileName : undefined,
          content:
            typeof a?.content === "string"
              ? a.content
              : ArrayBuffer.isView(a?.content)
                ? Buffer.from(
                    a.content.buffer,
                    a.content.byteOffset,
                    a.content.byteLength,
                  ).toString("base64")
                : undefined,
        }))
        .filter((a) => a.content) ?? [];
    const rawMessage = p.message.trim();
    if (!rawMessage && normalizedAttachments.length === 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "message or attachment required"),
      );
      return;
    }
    let parsedMessage = p.message;
    let parsedImages: ChatImageContent[] = [];
    if (normalizedAttachments.length > 0) {
      try {
        const parsed = await parseMessageWithAttachments(p.message, normalizedAttachments, {
          maxBytes: 5_000_000,
          log: context.logGateway,
        });
        parsedMessage = parsed.message;
        parsedImages = parsed.images;
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, String(err)));
        return;
      }
    }
    const { cfg, entry, storePath, canonicalKey } = loadSessionEntry(p.sessionKey);
    const timeoutMs = resolveAgentTimeoutMs({
      cfg,
      overrideMs: p.timeoutMs,
    });
    const now = Date.now();
    const clientRunId = p.idempotencyKey;

    const sendPolicy = resolveSendPolicy({
      cfg,
      entry,
      sessionKey: p.sessionKey,
      channel: entry?.channel,
      chatType: entry?.chatType,
    });
    if (sendPolicy === "deny") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "send blocked by session policy"),
      );
      return;
    }

    if (stopCommand) {
      const res = abortChatRunsForSessionKey(
        {
          chatAbortControllers: context.chatAbortControllers,
          chatRunBuffers: context.chatRunBuffers,
          chatDeltaSentAt: context.chatDeltaSentAt,
          chatAbortedRuns: context.chatAbortedRuns,
          removeChatRun: context.removeChatRun,
          agentRunSeq: context.agentRunSeq,
          broadcast: context.broadcast,
          nodeSendToSession: context.nodeSendToSession,
        },
        { sessionKey: p.sessionKey, stopReason: "stop" },
      );
      respond(true, { ok: true, aborted: res.aborted, runIds: res.runIds });
      return;
    }

    const cached = context.dedupe.get(`chat:${clientRunId}`);
    if (cached) {
      respond(cached.ok, cached.payload, cached.error, {
        cached: true,
      });
      return;
    }

    const activeExisting = context.chatAbortControllers.get(clientRunId);
    if (activeExisting) {
      respond(true, { runId: clientRunId, status: "in_flight" as const }, undefined, {
        cached: true,
        runId: clientRunId,
      });
      return;
    }

    try {
      const abortController = new AbortController();
      context.chatAbortControllers.set(clientRunId, {
        controller: abortController,
        sessionId: entry?.sessionId ?? clientRunId,
        sessionKey: p.sessionKey,
        startedAtMs: now,
        expiresAtMs: resolveChatRunExpiresAtMs({ now, timeoutMs }),
      });

      const ackPayload = {
        runId: clientRunId,
        status: "started" as const,
      };
      respond(true, ackPayload, undefined, { runId: clientRunId });

      const trimmedMessage = parsedMessage.trim();
      const injectThinking = Boolean(
        p.thinking && trimmedMessage && !trimmedMessage.startsWith("/"),
      );
      const commandBody = injectThinking ? `/think ${p.thinking} ${parsedMessage}` : parsedMessage;
      if (isMag7ChartRequest(trimmedMessage)) {
        void (async () => {
          try {
            const replyText = await buildMag7SummaryReply(cfg);
            const {
              storePath: latestStorePath,
              entry: latestEntry,
              canonicalKey: latestKey,
            } = loadSessionEntry(p.sessionKey);
            const ensured = await ensureSessionEntryForReply({
              storePath: latestStorePath ?? storePath,
              canonicalKey: latestKey || canonicalKey,
              entry: latestEntry ?? entry,
              fallbackSessionId: clientRunId,
              onWarn: (message) => context.logGateway.warn(message),
            });
            const appended = appendAssistantTranscriptMessage({
              message: replyText,
              sessionId: ensured.sessionId,
              storePath: ensured.storePath,
              sessionFile: ensured.sessionFile,
              createIfMissing: true,
            });
            const nowMs = Date.now();
            const message = appended.ok
              ? appended.message
              : {
                  role: "assistant",
                  content: [{ type: "text", text: replyText }],
                  timestamp: nowMs,
                  stopReason: "injected",
                  usage: { input: 0, output: 0, totalTokens: 0 },
                };
            broadcastChatFinal({
              context,
              runId: clientRunId,
              sessionKey: p.sessionKey,
              message,
            });
            context.dedupe.set(`chat:${clientRunId}`, {
              ts: Date.now(),
              ok: true,
              payload: { runId: clientRunId, status: "ok" as const },
            });
          } catch (err) {
            const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
            context.dedupe.set(`chat:${clientRunId}`, {
              ts: Date.now(),
              ok: false,
              payload: {
                runId: clientRunId,
                status: "error" as const,
                summary: String(err),
              },
              error,
            });
            broadcastChatError({
              context,
              runId: clientRunId,
              sessionKey: p.sessionKey,
              errorMessage: String(err),
            });
          } finally {
            context.chatAbortControllers.delete(clientRunId);
          }
        })();
        return;
      }
      const clientInfo = client?.connect?.client;
      const ctx: MsgContext = {
        Body: parsedMessage,
        BodyForAgent: parsedMessage,
        BodyForCommands: commandBody,
        RawBody: parsedMessage,
        CommandBody: commandBody,
        SessionKey: p.sessionKey,
        Provider: INTERNAL_MESSAGE_CHANNEL,
        Surface: INTERNAL_MESSAGE_CHANNEL,
        OriginatingChannel: INTERNAL_MESSAGE_CHANNEL,
        ChatType: "direct",
        CommandAuthorized: true,
        MessageSid: clientRunId,
        SenderId: clientInfo?.id,
        SenderName: clientInfo?.displayName,
        SenderUsername: clientInfo?.displayName,
      };

      const agentId = resolveSessionAgentId({
        sessionKey: p.sessionKey,
        config: cfg,
      });
      let prefixContext: ResponsePrefixContext = {
        identityName: resolveIdentityName(cfg, agentId),
      };
      const finalReplyParts: string[] = [];
      const dispatcher = createReplyDispatcher({
        responsePrefix: resolveEffectiveMessagesConfig(cfg, agentId).responsePrefix,
        responsePrefixContextProvider: () => prefixContext,
        onError: (err) => {
          context.logGateway.warn(`webchat dispatch failed: ${formatForLog(err)}`);
        },
        deliver: async (payload, info) => {
          if (info.kind !== "final") {
            return;
          }
          const text = payload.text?.trim() ?? "";
          if (!text) {
            return;
          }
          finalReplyParts.push(text);
        },
      });

      let agentRunStarted = false;
      void dispatchInboundMessage({
        ctx,
        cfg,
        dispatcher,
        replyOptions: {
          runId: clientRunId,
          abortSignal: abortController.signal,
          images: parsedImages.length > 0 ? parsedImages : undefined,
          disableBlockStreaming: true,
          onAgentRunStart: () => {
            agentRunStarted = true;
          },
          onModelSelected: (ctx) => {
            prefixContext.provider = ctx.provider;
            prefixContext.model = extractShortModelName(ctx.model);
            prefixContext.modelFull = `${ctx.provider}/${ctx.model}`;
            prefixContext.thinkingLevel = ctx.thinkLevel ?? "off";
          },
        },
      })
        .then(async () => {
          if (!agentRunStarted) {
            const combinedReply = finalReplyParts
              .map((part) => part.trim())
              .filter(Boolean)
              .join("\n\n")
              .trim();
            let message: Record<string, unknown> | undefined;
            if (combinedReply) {
              const {
                storePath: latestStorePath,
                entry: latestEntry,
                canonicalKey: latestKey,
              } = loadSessionEntry(p.sessionKey);
              const ensured = await ensureSessionEntryForReply({
                storePath: latestStorePath ?? storePath,
                canonicalKey: latestKey || canonicalKey,
                entry: latestEntry ?? entry,
                fallbackSessionId: clientRunId,
                onWarn: (warnMessage) => context.logGateway.warn(warnMessage),
              });
              const appended = appendAssistantTranscriptMessage({
                message: combinedReply,
                sessionId: ensured.sessionId,
                storePath: ensured.storePath,
                sessionFile: ensured.sessionFile,
                createIfMissing: true,
              });
              if (appended.ok) {
                message = appended.message;
              } else {
                context.logGateway.warn(
                  `webchat transcript append failed: ${appended.error ?? "unknown error"}`,
                );
                const now = Date.now();
                message = {
                  role: "assistant",
                  content: [{ type: "text", text: combinedReply }],
                  timestamp: now,
                  stopReason: "injected",
                  usage: { input: 0, output: 0, totalTokens: 0 },
                };
              }
            }
            broadcastChatFinal({
              context,
              runId: clientRunId,
              sessionKey: p.sessionKey,
              message,
            });
          }
          context.dedupe.set(`chat:${clientRunId}`, {
            ts: Date.now(),
            ok: true,
            payload: { runId: clientRunId, status: "ok" as const },
          });
        })
        .catch((err) => {
          const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
          context.dedupe.set(`chat:${clientRunId}`, {
            ts: Date.now(),
            ok: false,
            payload: {
              runId: clientRunId,
              status: "error" as const,
              summary: String(err),
            },
            error,
          });
          broadcastChatError({
            context,
            runId: clientRunId,
            sessionKey: p.sessionKey,
            errorMessage: String(err),
          });
        })
        .finally(() => {
          context.chatAbortControllers.delete(clientRunId);
        });
    } catch (err) {
      const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
      const payload = {
        runId: clientRunId,
        status: "error" as const,
        summary: String(err),
      };
      context.dedupe.set(`chat:${clientRunId}`, {
        ts: Date.now(),
        ok: false,
        payload,
        error,
      });
      respond(false, payload, error, {
        runId: clientRunId,
        error: formatForLog(err),
      });
    }
  },
  "chat.inject": async ({ params, respond, context }) => {
    if (!validateChatInjectParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.inject params: ${formatValidationErrors(validateChatInjectParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      sessionKey: string;
      message: string;
      label?: string;
    };

    // Load session to find transcript file
    const { storePath, entry } = loadSessionEntry(p.sessionKey);
    const sessionId = entry?.sessionId;
    if (!sessionId || !storePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    // Resolve transcript path
    const transcriptPath = entry?.sessionFile
      ? entry.sessionFile
      : path.join(path.dirname(storePath), `${sessionId}.jsonl`);

    if (!fs.existsSync(transcriptPath)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "transcript file not found"),
      );
      return;
    }

    // Build transcript entry
    const now = Date.now();
    const messageId = randomUUID().slice(0, 8);
    const labelPrefix = p.label ? `[${p.label}]\n\n` : "";
    const messageBody: Record<string, unknown> = {
      role: "assistant",
      content: [{ type: "text", text: `${labelPrefix}${p.message}` }],
      timestamp: now,
      stopReason: "injected",
      usage: { input: 0, output: 0, totalTokens: 0 },
    };
    const transcriptEntry = {
      type: "message",
      id: messageId,
      timestamp: new Date(now).toISOString(),
      message: messageBody,
    };

    // Append to transcript file
    try {
      fs.appendFileSync(transcriptPath, `${JSON.stringify(transcriptEntry)}\n`, "utf-8");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to write transcript: ${errMessage}`),
      );
      return;
    }

    // Broadcast to webchat for immediate UI update
    const chatPayload = {
      runId: `inject-${messageId}`,
      sessionKey: p.sessionKey,
      seq: 0,
      state: "final" as const,
      message: transcriptEntry.message,
    };
    context.broadcast("chat", chatPayload);
    context.nodeSendToSession(p.sessionKey, "chat", chatPayload);

    respond(true, { ok: true, messageId });
  },
};

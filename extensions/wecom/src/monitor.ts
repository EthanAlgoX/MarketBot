import type { IncomingMessage, ServerResponse } from "node:http";

import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { MarketBotConfig } from "marketbot/plugin-sdk";

import type { ResolvedWecomAccount, WecomRuntimeEnv, WecomWebhookTarget } from "./types.js";
import { wecomDecrypt, wecomEncrypt, wecomSignature } from "./crypto.js";
import { getWecomRuntime } from "./runtime.js";

type StatusSink = (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;

const xmlParser = new XMLParser({ ignoreAttributes: false });
const xmlBuilder = new XMLBuilder({ ignoreAttributes: false });

const webhookTargets = new Map<string, WecomWebhookTarget[]>();

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

function resolveWebhookPath(webhookPath?: string, webhookUrl?: string): string | null {
  const trimmedPath = webhookPath?.trim();
  if (trimmedPath) return normalizeWebhookPath(trimmedPath);
  if (webhookUrl?.trim()) {
    try {
      const parsed = new URL(webhookUrl);
      return normalizeWebhookPath(parsed.pathname || "/");
    } catch {
      return null;
    }
  }
  return null;
}

export function registerWecomWebhookTarget(target: WecomWebhookTarget): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) webhookTargets.set(key, updated);
    else webhookTargets.delete(key);
  };
}

async function readRawBody(req: IncomingMessage, maxBytes: number): Promise<{ ok: true; value: string } | { ok: false; error: string; status: number }> {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise((resolve) => {
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: "payload too large", status: 413 });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve({ ok: true, value: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", (err) =>
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err), status: 400 }),
    );
  });
}

function sendXml(res: ServerResponse, xml: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.end(xml);
}

function sendText(res: ServerResponse, status: number, text: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function parseWecomXml(rawXml: string): Record<string, unknown> | null {
  try {
    const parsed = xmlParser.parse(rawXml) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const xml = (parsed as any).xml ?? parsed;
    if (!xml || typeof xml !== "object") return null;
    return xml as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildEncryptedReply(params: {
  token: string;
  encodingAesKey: string;
  corpId: string;
  timestamp: string;
  nonce: string;
  plaintextXml: string;
}): string {
  const encrypt = wecomEncrypt({
    encodingAesKey: params.encodingAesKey,
    corpId: params.corpId,
    plaintextXml: params.plaintextXml,
  });
  const msg_signature = wecomSignature({
    token: params.token,
    timestamp: params.timestamp,
    nonce: params.nonce,
    encrypt,
  });
  const payload = {
    xml: {
      Encrypt: encrypt,
      MsgSignature: msg_signature,
      TimeStamp: params.timestamp,
      Nonce: params.nonce,
    },
  };
  return xmlBuilder.build(payload);
}

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalizedSender = senderId.toLowerCase();
  return allowFrom.some((raw) => String(raw).trim().toLowerCase() === normalizedSender);
}

export async function handleWecomWebhookRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) return false;

  const timestamp = String(url.searchParams.get("timestamp") ?? "");
  const nonce = String(url.searchParams.get("nonce") ?? "");
  const msgSignature = String(url.searchParams.get("msg_signature") ?? "");

  // No account selection in query; route by configured path (one or many targets).
  // If multiple accounts share the same path, the first one that passes signature wins.
  const pickTarget = (encrypt: string) => {
    for (const target of targets) {
      const expected = wecomSignature({
        token: target.token,
        timestamp,
        nonce,
        encrypt,
      });
      if (expected === msgSignature) return target;
    }
    return null;
  };

  // WeCom URL verification: GET with echostr (encrypted).
  if (req.method === "GET") {
    const echostr = String(url.searchParams.get("echostr") ?? "");
    if (!echostr || !timestamp || !nonce || !msgSignature) {
      sendText(res, 400, "missing query params");
      return true;
    }
    const target = pickTarget(echostr);
    if (!target) {
      sendText(res, 401, "unauthorized");
      return true;
    }
    try {
      const { plaintextXml } = wecomDecrypt({
        encodingAesKey: target.encodingAesKey,
        corpId: target.corpId,
        encrypt: echostr,
      });
      // echostr decrypt plaintext is plain text, not xml, but same decrypt format.
      sendText(res, 200, plaintextXml);
      return true;
    } catch (err) {
      target.runtime.error?.(`[${target.account.accountId}] wecom echostr decrypt failed: ${String(err)}`);
      sendText(res, 400, "bad echostr");
      return true;
    }
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method Not Allowed");
    return true;
  }

  const body = await readRawBody(req, 1024 * 1024);
  if (!body.ok) {
    sendText(res, body.status, body.error);
    return true;
  }

  const parsed = parseWecomXml(body.value);
  const encrypt = typeof parsed?.Encrypt === "string" ? (parsed.Encrypt as string) : "";
  if (!encrypt || !timestamp || !nonce || !msgSignature) {
    sendText(res, 400, "invalid payload");
    return true;
  }
  const target = pickTarget(encrypt);
  if (!target) {
    sendText(res, 401, "unauthorized");
    return true;
  }

  let plaintextXml: string;
  try {
    plaintextXml = wecomDecrypt({
      encodingAesKey: target.encodingAesKey,
      corpId: target.corpId,
      encrypt,
    }).plaintextXml;
  } catch (err) {
    target.runtime.error?.(`[${target.account.accountId}] wecom decrypt failed: ${String(err)}`);
    sendText(res, 400, "bad encrypt");
    return true;
  }

  const msg = parseWecomXml(plaintextXml) ?? {};
  const msgType = String(msg.MsgType ?? "");
  const fromUser = String(msg.FromUserName ?? "");
  const toUser = String(msg.ToUserName ?? "");
  const content = String(msg.Content ?? "");

  target.statusSink?.({ lastInboundAt: Date.now() });

  // Best-effort allowlist (for AI bot style direct messages).
  const allowFrom = (target.account.config.allowFrom ?? []).map((entry) => String(entry));
  if (fromUser && allowFrom.length > 0 && !isSenderAllowed(fromUser, allowFrom)) {
    sendText(res, 200, "ok");
    return true;
  }

  const runtime = getWecomRuntime();
  const senderId = fromUser || "unknown";
  const chatId = fromUser || "unknown";
  const text = msgType === "text" ? content : `[${msgType || "message"}]`;

  runtime.channel.reply
    .handleInboundMessage({
      channel: "wecom",
      accountId: target.account.accountId,
      senderId,
      chatType: "direct",
      chatId,
      text,
      reply: async (responseText: string) => {
        target.statusSink?.({ lastOutboundAt: Date.now() });
        // WeCom expects plaintext reply XML, then we encrypt it.
        const replyXml = xmlBuilder.build({
          xml: {
            ToUserName: fromUser,
            FromUserName: toUser,
            CreateTime: Math.floor(Date.now() / 1000),
            MsgType: "text",
            Content: responseText ?? "",
          },
        });
        const encryptedReply = buildEncryptedReply({
          token: target.token,
          encodingAesKey: target.encodingAesKey,
          corpId: target.corpId,
          timestamp,
          nonce,
          plaintextXml: replyXml,
        });
        sendXml(res, encryptedReply);
      },
    })
    .catch((err) => {
      target.runtime.error?.(`[${target.account.accountId}] wecom inbound failed: ${String(err)}`);
      // If we fail, still ACK to avoid retries.
      sendText(res, 200, "ok");
    });

  // Important: reply() will write the response; if the agent doesn't reply, we still need to ACK.
  // MarketBot's inbound pipeline may decide not to respond (policy, commands, etc).
  setTimeout(() => {
    if (!res.writableEnded) sendText(res, 200, "ok");
  }, 1500);

  return true;
}

export function startWecomWebhookMonitor(params: {
  account: ResolvedWecomAccount;
  config: MarketBotConfig;
  runtime: WecomRuntimeEnv;
  token: string;
  encodingAesKey: string;
  corpId: string;
  abortSignal: AbortSignal;
  webhookPath?: string;
  webhookUrl?: string;
  statusSink?: StatusSink;
}): { stop: () => void } {
  const path = resolveWebhookPath(params.webhookPath, params.webhookUrl);
  if (!path) throw new Error("Invalid wecom webhook path (set channels.wecom.webhookPath or webhookUrl).");

  const unregister = registerWecomWebhookTarget({
    account: params.account,
    config: params.config,
    runtime: params.runtime,
    token: params.token,
    encodingAesKey: params.encodingAesKey,
    corpId: params.corpId,
    path,
    statusSink: params.statusSink,
  });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    unregister();
  };
  params.abortSignal?.addEventListener("abort", stop);
  return { stop };
}


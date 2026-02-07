const API_BASE = "https://api.sgroup.qq.com";
const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

export function clearQQBotTokenCache(): void {
  cachedToken = null;
}

export async function getQQBotAccessToken(params: {
  appId: string;
  clientSecret: string;
}): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) return cachedToken.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: params.appId, clientSecret: params.clientSecret }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`token HTTP ${res.status}: ${text.slice(0, 500)}`);
      const data = JSON.parse(text) as { access_token?: string; expires_in?: number };
      if (!data.access_token) throw new Error("access_token missing");
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
      };
      return cachedToken.token;
    } finally {
      tokenPromise = null;
    }
  })();
  return tokenPromise;
}

async function apiRequest<T>(params: {
  accessToken: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const res = await fetch(`${API_BASE}${params.path}`, {
    method: params.method,
    headers: {
      Authorization: `QQBot ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QQBot API ${params.path} HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}

export async function getQQBotGatewayUrl(accessToken: string): Promise<string> {
  const data = await apiRequest<{ url: string }>({ accessToken, method: "GET", path: "/gateway" });
  return data.url;
}

let msgSeqBase = Math.floor(Date.now() / 1000) % 100000000;
const msgSeqTracker = new Map<string, number>();

function nextMsgSeq(msgId?: string): number {
  if (!msgId) return 1;
  const current = msgSeqTracker.get(msgId) ?? 0;
  const next = current + 1;
  msgSeqTracker.set(msgId, next);
  if (msgSeqTracker.size > 1000) {
    const keys = Array.from(msgSeqTracker.keys());
    for (let i = 0; i < 500; i += 1) msgSeqTracker.delete(keys[i]!);
  }
  return msgSeqBase + next;
}

function buildMessageBody(content: string, msgId?: string): Record<string, unknown> {
  const msg_seq = nextMsgSeq(msgId);
  if (msgId) {
    return { content, msg_type: 0, msg_id: msgId, msg_seq };
  }
  return { content, msg_type: 0, msg_seq };
}

export async function sendQQBotC2CMessage(params: {
  accessToken: string;
  userOpenid: string;
  content: string;
  msgId?: string;
}): Promise<void> {
  await apiRequest({
    accessToken: params.accessToken,
    method: "POST",
    path: `/v2/users/${params.userOpenid}/messages`,
    body: buildMessageBody(params.content ?? "", params.msgId),
  });
}

export async function sendQQBotGroupMessage(params: {
  accessToken: string;
  groupOpenid: string;
  content: string;
  msgId?: string;
}): Promise<void> {
  await apiRequest({
    accessToken: params.accessToken,
    method: "POST",
    path: `/v2/groups/${params.groupOpenid}/messages`,
    body: buildMessageBody(params.content ?? "", params.msgId),
  });
}

export async function sendQQBotChannelMessage(params: {
  accessToken: string;
  channelId: string;
  content: string;
  msgId?: string;
}): Promise<void> {
  await apiRequest({
    accessToken: params.accessToken,
    method: "POST",
    path: `/channels/${params.channelId}/messages`,
    body: { content: params.content ?? "", ...(params.msgId ? { msg_id: params.msgId } : {}) },
  });
}


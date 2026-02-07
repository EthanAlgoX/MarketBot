type TokenCacheEntry = { accessToken: string; expiresAt: number };

const tokenCache = new Map<string, TokenCacheEntry>();

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

export async function getDingTalkAccessToken(params: {
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const cacheKey = params.clientId.trim();
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.accessToken;

  const data = await postJson<{ accessToken?: string; expireIn?: number }>(
    "https://api.dingtalk.com/v1.0/oauth2/accessToken",
    {
      appKey: params.clientId,
      appSecret: params.clientSecret,
    },
  );
  if (!data.accessToken) {
    throw new Error("DingTalk accessToken missing in response");
  }
  const ttlMs = (data.expireIn ?? 7200) * 1000;
  tokenCache.set(cacheKey, { accessToken: data.accessToken, expiresAt: Date.now() + ttlMs });
  return data.accessToken;
}

export async function sendDingTalkSessionMessage(params: {
  sessionWebhook: string;
  accessToken: string;
  text: string;
}): Promise<void> {
  const res = await fetch(params.sessionWebhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": params.accessToken,
    },
    body: JSON.stringify({
      msgtype: "text",
      text: { content: params.text ?? "" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DingTalk session webhook failed: HTTP ${res.status} ${body.slice(0, 500)}`);
  }
}


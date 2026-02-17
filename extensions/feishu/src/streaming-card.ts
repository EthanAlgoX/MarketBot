import type { Client } from "@larksuiteoapi/node-sdk";
import type { FeishuDomain } from "./types.js";

type Credentials = {
  appId: string;
  appSecret: string;
  domain: FeishuDomain;
};

type CardState = {
  cardId: string;
  messageId: string;
  sequence: number;
  currentText: string;
};

type TenantAccessTokenResponse = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

type CreateCardResponse = {
  code: number;
  msg: string;
  data?: {
    card_id?: string;
  };
};

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function resolveApiBase(domain: FeishuDomain): string {
  return domain === "lark"
    ? "https://open.larksuite.com/open-apis"
    : "https://open.feishu.cn/open-apis";
}

async function getToken(creds: Credentials): Promise<string> {
  const key = `${creds.domain}|${creds.appId}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch(`${resolveApiBase(creds.domain)}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: creds.appId,
      app_secret: creds.appSecret,
    }),
  });
  const payload = (await response.json()) as TenantAccessTokenResponse;
  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(`Token error: ${payload.msg}`);
  }
  tokenCache.set(key, {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + (payload.expire ?? 7200) * 1000,
  });
  return payload.tenant_access_token;
}

function truncateSummary(text: string, maxChars = 50): string {
  const cleaned = text.replace(/\n+/g, " ").trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, maxChars - 3))}...`;
}

export class FeishuStreamingSession {
  private readonly client: Client;

  private readonly creds: Credentials;

  private readonly log?: (message: string) => void;

  private state: CardState | null = null;

  private queue: Promise<void> = Promise.resolve();

  private closed = false;

  private lastUpdateAt = 0;

  private pendingText: string | null = null;

  private readonly updateThrottleMs = 100;

  constructor(client: Client, creds: Credentials, log?: (message: string) => void) {
    this.client = client;
    this.creds = creds;
    this.log = log;
  }

  async start(
    receiveId: string,
    receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id" = "chat_id",
  ): Promise<void> {
    if (this.state) {
      return;
    }

    const apiBase = resolveApiBase(this.creds.domain);
    const cardJson = {
      schema: "2.0",
      config: {
        streaming_mode: true,
        summary: { content: "[Generating...]" },
        streaming_config: {
          print_frequency_ms: { default: 80 },
          print_step: { default: 2 },
        },
      },
      body: {
        elements: [
          {
            tag: "markdown",
            content: "⏳ Thinking...",
            element_id: "content",
          },
        ],
      },
    };

    const createResponse = await fetch(`${apiBase}/cardkit/v1/cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getToken(this.creds)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "card_json",
        data: JSON.stringify(cardJson),
      }),
    });
    const createPayload = (await createResponse.json()) as CreateCardResponse;
    const cardId = createPayload.data?.card_id;
    if (createPayload.code !== 0 || !cardId) {
      throw new Error(`Create card failed: ${createPayload.msg}`);
    }

    const sendResponse = await this.client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify({
          type: "card",
          data: { card_id: cardId },
        }),
      },
    });
    if (sendResponse.code !== 0 || !sendResponse.data?.message_id) {
      throw new Error(`Send card failed: ${sendResponse.msg}`);
    }

    this.state = {
      cardId,
      messageId: sendResponse.data.message_id,
      sequence: 1,
      currentText: "",
    };
    this.log?.(`feishu streaming: started card=${cardId}`);
  }

  async update(text: string): Promise<void> {
    if (!this.state || this.closed) {
      return;
    }

    const now = Date.now();
    if (now - this.lastUpdateAt < this.updateThrottleMs) {
      this.pendingText = text;
      return;
    }
    this.lastUpdateAt = now;
    this.pendingText = null;

    this.queue = this.queue.then(async () => {
      if (!this.state || this.closed) {
        return;
      }
      this.state.currentText = text;
      this.state.sequence += 1;

      await fetch(
        `${resolveApiBase(this.creds.domain)}/cardkit/v1/cards/${this.state.cardId}/elements/content/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${await getToken(this.creds)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            sequence: this.state.sequence,
            uuid: `s_${this.state.cardId}_${this.state.sequence}`,
          }),
        },
      ).catch((error) => {
        this.log?.(`feishu streaming: update failed: ${String(error)}`);
      });
    });

    await this.queue;
  }

  async close(finalText?: string): Promise<void> {
    if (!this.state || this.closed) {
      return;
    }
    this.closed = true;
    await this.queue;

    const text = finalText ?? this.pendingText ?? this.state.currentText;
    const apiBase = resolveApiBase(this.creds.domain);

    if (text && text !== this.state.currentText) {
      this.state.sequence += 1;
      await fetch(`${apiBase}/cardkit/v1/cards/${this.state.cardId}/elements/content/content`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${await getToken(this.creds)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: text,
          sequence: this.state.sequence,
          uuid: `s_${this.state.cardId}_${this.state.sequence}`,
        }),
      }).catch(() => {});
      this.state.currentText = text;
    }

    this.state.sequence += 1;
    await fetch(`${apiBase}/cardkit/v1/cards/${this.state.cardId}/settings`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await getToken(this.creds)}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        settings: JSON.stringify({
          config: {
            streaming_mode: false,
            summary: { content: truncateSummary(text) },
          },
        }),
        sequence: this.state.sequence,
        uuid: `c_${this.state.cardId}_${this.state.sequence}`,
      }),
    }).catch((error) => {
      this.log?.(`feishu streaming: close failed: ${String(error)}`);
    });

    this.log?.(`feishu streaming: closed card=${this.state.cardId}`);
  }

  isActive(): boolean {
    return this.state !== null && !this.closed;
  }
}

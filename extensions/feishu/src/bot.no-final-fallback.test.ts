import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketBotConfig } from "marketbot/plugin-sdk";

const {
  mockDispatchReplyFromConfig,
  mockSendMessageFeishu,
} = vi.hoisted(() => ({
  mockDispatchReplyFromConfig: vi.fn(async () => ({
    queuedFinal: false,
    counts: { final: 0 },
  })),
  mockSendMessageFeishu: vi.fn(async () => ({ messageId: "om_fallback", chatId: "oc_chat" })),
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: () => ({
    system: {
      enqueueSystemEvent: vi.fn(),
    },
    channel: {
      routing: {
        resolveAgentRoute: () => ({ agentId: "main", sessionKey: "agent:main:main", accountId: "main" }),
      },
      reply: {
        resolveEnvelopeFormatOptions: () => ({}),
        formatAgentEnvelope: ({ body }: { body: string }) => body,
        finalizeInboundContext: (ctx: unknown) => ctx,
        dispatchReplyFromConfig: mockDispatchReplyFromConfig,
      },
    },
  }),
}));

vi.mock("./reply-dispatcher.js", () => ({
  createFeishuReplyDispatcher: () => ({
    dispatcher: {},
    replyOptions: {},
    markDispatchIdle: vi.fn(),
  }),
}));

vi.mock("./send.js", () => ({
  getMessageFeishu: vi.fn(async () => null),
  sendMessageFeishu: mockSendMessageFeishu,
}));

vi.mock("./client.js", () => ({
  createFeishuClient: vi.fn(() => ({
    contact: {
      user: {
        get: vi.fn(async () => ({ data: { user: { name: "tester" } } })),
      },
    },
  })),
}));

import { handleFeishuMessage, type FeishuMessageEvent } from "./bot.js";

function createEvent(text: string): FeishuMessageEvent {
  return {
    sender: {
      sender_id: {
        open_id: "ou_user_1",
        user_id: "",
      },
      sender_type: "user",
    },
    message: {
      message_id: "om_msg_1",
      chat_id: "oc_chat",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text }),
      mentions: [],
    },
  };
}

describe("feishu bot fallback when no final reply", () => {
  const cfg = {
    channels: {
      feishu: {
        appId: "app-id",
        appSecret: "app-secret",
      },
    },
  } as unknown as MarketBotConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends chart fallback text when no final reply is queued", async () => {
    await handleFeishuMessage({
      cfg,
      event: createEvent("使用内置浏览器抓取美股七姐妹是哪些股票，再搜索相关股票数据，最后绘制图表"),
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
      } as any,
    });

    expect(mockDispatchReplyFromConfig).toHaveBeenCalledTimes(1);
    expect(mockSendMessageFeishu).toHaveBeenCalledTimes(1);
    expect(mockSendMessageFeishu).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "oc_chat",
        replyToMessageId: "om_msg_1",
        text: expect.stringContaining("美股七姐妹"),
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketBotConfig } from "marketbot/plugin-sdk";

import { createFeishuReplyDispatcher } from "./reply-dispatcher.js";
import { sendMediaFeishu } from "./media.js";
import { sendMessageFeishu } from "./send.js";

const {
  mockCreateReplyDispatcherWithTyping,
  mockSendMessageFeishu,
  mockSendMarkdownCardFeishu,
  mockSendMediaFeishu,
} = vi.hoisted(() => ({
  mockCreateReplyDispatcherWithTyping: vi.fn(),
  mockSendMessageFeishu: vi.fn(),
  mockSendMarkdownCardFeishu: vi.fn(),
  mockSendMediaFeishu: vi.fn(),
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: () => ({
    channel: {
      text: {
        resolveTextChunkLimit: () => 4000,
        resolveChunkMode: () => "length",
        resolveMarkdownTableMode: () => "code",
        convertMarkdownTables: (text: string) => text,
        chunkTextWithMode: (text: string) => (text ? [text] : []),
      },
      reply: {
        createReplyDispatcherWithTyping: mockCreateReplyDispatcherWithTyping,
        resolveHumanDelayConfig: () => null,
      },
    },
  }),
}));

vi.mock("./send.js", () => ({
  sendMessageFeishu: mockSendMessageFeishu,
  sendMarkdownCardFeishu: mockSendMarkdownCardFeishu,
}));

vi.mock("./media.js", () => ({
  sendMediaFeishu: mockSendMediaFeishu,
}));

describe("feishu reply dispatcher", () => {
  let deliver:
    | ((payload: { text?: string; mediaUrl?: string; mediaUrls?: string[] }) => Promise<void>)
    | undefined;

  const cfg = {
    channels: {
      feishu: {
        appId: "app-id",
        appSecret: "app-secret",
        renderMode: "raw",
      },
    },
  } as unknown as MarketBotConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    deliver = undefined;
    mockCreateReplyDispatcherWithTyping.mockImplementation((opts: { deliver: typeof deliver }) => {
      deliver = opts.deliver;
      return {
        dispatcher: {},
        replyOptions: {},
        markDispatchIdle: vi.fn(),
      };
    });
    mockSendMessageFeishu.mockResolvedValue({
      messageId: "om_text",
      chatId: "ou_user_1",
    });
    mockSendMarkdownCardFeishu.mockResolvedValue({
      messageId: "om_card",
      chatId: "ou_user_1",
    });
    mockSendMediaFeishu.mockResolvedValue({
      messageId: "om_media",
      chatId: "ou_user_1",
    });
  });

  it("sends media-only payloads", async () => {
    createFeishuReplyDispatcher({
      cfg,
      agentId: "main",
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
      } as any,
      chatId: "ou_user_1",
      replyToMessageId: "om_reply",
    });

    expect(deliver).toBeTypeOf("function");
    await deliver!({
      mediaUrl: "https://example.com/chart.png",
    });

    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/chart.png",
      replyToMessageId: "om_reply",
    });
    expect(vi.mocked(sendMessageFeishu)).not.toHaveBeenCalled();
  });

  it("sends text and all media entries", async () => {
    createFeishuReplyDispatcher({
      cfg,
      agentId: "main",
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
      } as any,
      chatId: "ou_user_1",
      replyToMessageId: "om_reply",
    });

    expect(deliver).toBeTypeOf("function");
    await deliver!({
      text: "这里是美团行情图",
      mediaUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "这里是美团行情图",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenNthCalledWith(1, {
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/a.png",
      replyToMessageId: "om_reply",
    });
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenNthCalledWith(2, {
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/b.png",
      replyToMessageId: "om_reply",
    });
  });

  it("extracts markdown image links from text and sends as media", async () => {
    createFeishuReplyDispatcher({
      cfg,
      agentId: "main",
      runtime: {
        log: vi.fn(),
        error: vi.fn(),
      } as any,
      chatId: "ou_user_1",
      replyToMessageId: "om_reply",
    });

    expect(deliver).toBeTypeOf("function");
    await deliver!({
      text: "美团行情图如下：\n![chart](https://example.com/meituan.png)\n请查看。",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "美团行情图如下：\n\n请查看。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/meituan.png",
      replyToMessageId: "om_reply",
    });
  });
});

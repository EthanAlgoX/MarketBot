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

  it("extracts plain image-link directives from text and sends as media", async () => {
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
      text: "抓取数据分析，发我图片\n图片链接：https://example.com/chart.png",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "抓取数据分析，发我图片",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/chart.png",
      replyToMessageId: "om_reply",
    });
  });

  it("replaces fake image-sent claims when no media exists", async () => {
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
      text: "已收到您的请求并附上相关图片。请查看。",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "未检测到可发送的图片内容。请稍后重试，或提供可访问的图片链接后我再发送。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("does not replace image text when media is present", async () => {
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
      text: "已为您附上相关图片，请查看。",
      mediaUrl: "https://example.com/real-chart.png",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "已为您附上相关图片，请查看。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMediaFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      mediaUrl: "https://example.com/real-chart.png",
      replyToMessageId: "om_reply",
    });
  });

  it("replaces placeholder news results without real links", async () => {
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
      text: "搜索美团新闻\n搜索结果如下：\n[搜索结果]\n- 美团新闻：[具体文章链接]（可点击查看详细内容）",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "未获取到有效新闻结果（缺少真实链接或命中占位文本）。请稍后重试，或改为“搜索美团新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("keeps news response when real links exist", async () => {
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
      text: "搜索美团新闻\n1) 标题A | 来源A | 2026-02-14 | https://news.example.com/a",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "搜索美团新闻\n1) 标题A | 来源A | 2026-02-14 | https://news.example.com/a",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces placeholder link-only news text without real links", async () => {
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
      text: "- **美团新闻**：[具体文章链接]（可点击查看详细内容）",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "未获取到有效新闻结果（缺少真实链接或命中占位文本）。请稍后重试，或改为“搜索美团新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces search-style news list without links", async () => {
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
      text: "搜索结果如下：\n1) 美团新闻A\n2) 美团新闻B\n3) 美团新闻C",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "未获取到有效新闻结果（缺少真实链接或命中占位文本）。请稍后重试，或改为“搜索美团新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("keeps non-search news summary without links", async () => {
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
      text: "今日美团新闻摘要：公司聚焦即时零售与到店业务协同，市场关注后续利润改善节奏。",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "今日美团新闻摘要：公司聚焦即时零售与到店业务协同，市场关注后续利润改善节奏。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces feishu metadata-echo replies", async () => {
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
      text:
        "您提到的Feishu DM消息相关信息如下：\n- 发起人账号：ou_c7a06ecb12c1788b39cee0f35d81478e\n- 内容主题：今天股市新闻\n\n如果您有进一步问题或需要帮助，请随时告诉我！",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "检测到无效系统元信息回复，未返回可用内容。请重试：例如“今天股市新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });
});

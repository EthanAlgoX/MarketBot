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

  it("replaces internal trace leak replies for news queries", async () => {
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
        "今天美股新闻\n\n[message_id: 16c55264-fd7c-4b9f-a5a3-de4bd16d2594] /thinking\n[web_search_result]\n今日美股新闻\n\n节日经济利好\n美国制造业数据公布\n亚马逊股价调整\n[web_search_result]",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "检测到内部调试片段（/thinking 或 tool 原始块）泄漏，已拦截。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces english search api-key error replies", async () => {
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
        "The error indicates that a Brave Search API key is required for web_search. To resolve this:\n\nConfigure the Brave API key:\nOpen MarketBot and go to Tools > Web.\nStore or set your Brave Search API key in the environment.\nUse the key:\nRun web_search with the key when initiating a search request.\nIf the key is already set, ensure it's passed correctly to the web_search function. You can check the documentation here for instructions.",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "实时新闻检索服务当前不可用（搜索密钥未配置或不可用）。请稍后重试，或改为“今天美股新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces finance symbol-required error replies for market-news queries", async () => {
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
        "The error \"symbol required\" indicates that the finance function needs a symbol parameter. However, your message doesn't include the symbol yet. Please provide the market symbol (e.g., AAPL, MSFT) and I'll proceed with the function call using it.",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "新闻检索参数不足（symbol 要求不适用于本次泛市场请求）。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”；也可指定“美股新闻 AAPL”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces chart-capability refusal replies", async () => {
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
        "您提供的消息ID ffa0afdd-1ed2-431a-b938-ae538e8c7ff8 可能是某种交互或测试信息。目前可用的工具主要用于搜索和网页内容获取，无法直接生成或查看图表。如果您需要帮助，请告知具体需求，我将尽力协助！",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "图表请求已收到。请补充标的与周期（例如：AAPL，近3个月/日线）；我将抓取数据并发送图表图片。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces generic symbol-required template replies", async () => {
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
        "The error indicates that the function requires a symbol parameter, but it was not included in the call. To resolve this, please provide the symbol you'd like to use.",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "新闻检索参数不足（symbol 要求不适用于本次泛市场请求）。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”；也可指定“美股新闻 AAPL”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("uses seven-sisters fallback when symbol error includes seven-sisters hint", async () => {
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
        "获取美股七姐妹的股票图表\nThe error indicates that the function requires a symbol parameter, but it was not included in the call.",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "已识别为 symbol 参数缺失。若你要“美股七姐妹图表”，我将按 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA 生成并发送；也可直接指定单个代码与周期（如 AAPL 日线近3个月）。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces feishu-doc space_id argument error leakage", async () => {
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
        "The error message indicates that the request miss the space_id path argument when trying to access a Feishu document. Let me check the function call to see the correct way to include this parameter. Could you please provide the correct function call with the space_id parameter?",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "已忽略无关的 Feishu 文档参数报错（space_id 等）。我将直接使用浏览器与行情工具抓取美股七姐妹（AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA）并绘制图表。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("replaces _forum internal trace prefix", async () => {
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
      text: "_forum\n今天美股新闻",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "检测到内部调试片段（/thinking 或 tool 原始块）泄漏，已拦截。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });

  it("prefers feishu-doc fallback when _forum and space_id error appear together", async () => {
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
        "_forum\n\nThe error message indicates that the request miss the space_id path argument when trying to access a Feishu document.",
    });

    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMessageFeishu)).toHaveBeenCalledWith({
      cfg,
      to: "ou_user_1",
      text: "已忽略无关的 Feishu 文档参数报错（space_id 等）。我将直接使用浏览器与行情工具抓取美股七姐妹（AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA）并绘制图表。",
      replyToMessageId: "om_reply",
      mentions: undefined,
    });
    expect(vi.mocked(sendMediaFeishu)).not.toHaveBeenCalled();
  });
});

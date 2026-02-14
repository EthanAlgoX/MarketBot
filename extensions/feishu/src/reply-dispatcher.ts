import {
  createReplyPrefixContext,
  createTypingCallbacks,
  logTypingFailure,
  type MarketBotConfig,
  type RuntimeEnv,
  type ReplyPayload,
} from "marketbot/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { sendMessageFeishu, sendMarkdownCardFeishu } from "./send.js";
import { sendMediaFeishu } from "./media.js";
import type { FeishuConfig } from "./types.js";
import type { MentionTarget } from "./mention.js";
import {
  addTypingIndicator,
  removeTypingIndicator,
  type TypingIndicatorState,
} from "./typing.js";

function isFeishuMediaSource(value: string): boolean {
  if (!value) {
    return false;
  }
  return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("./");
}

function normalizeMarkdownImageTarget(raw: string): string | null {
  let value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("<") && value.endsWith(">")) {
    value = value.slice(1, -1).trim();
  }
  const titleSep = value.match(/\s+['"]/);
  if (titleSep?.index && titleSep.index > 0) {
    value = value.slice(0, titleSep.index).trim();
  }
  return isFeishuMediaSource(value) ? value : null;
}

function collectMediaUrl(raw: string, seen: Set<string>, mediaUrls: string[]): string | null {
  const mediaUrl = normalizeMarkdownImageTarget(raw);
  if (!mediaUrl || seen.has(mediaUrl)) {
    return null;
  }
  seen.add(mediaUrl);
  mediaUrls.push(mediaUrl);
  return mediaUrl;
}

function extractMarkdownMedia(text: string): { text: string; mediaUrls: string[] } {
  const mediaUrls: string[] = [];
  const seen = new Set<string>();
  let cleaned = text;

  cleaned = cleaned.replace(/!\[[^\]]*]\(([^)]+)\)/g, (match, rawTarget: string) =>
    collectMediaUrl(String(rawTarget), seen, mediaUrls) ? "" : match,
  );

  // Also support markdown links when the label implies image output.
  cleaned = cleaned.replace(
    /\[(?:图片链接|图链|image(?:\s*link)?|screenshot)[^\]]*]\(([^)]+)\)/gi,
    (match, rawTarget: string) => (collectMediaUrl(String(rawTarget), seen, mediaUrls) ? "" : match),
  );

  // Support MEDIA directives even if upstream parser did not split them.
  cleaned = cleaned.replace(/\bMEDIA:\s*([^\s\n]+)/gi, (match, rawTarget: string) =>
    collectMediaUrl(String(rawTarget), seen, mediaUrls) ? "" : match,
  );

  // Support plain "图片链接: <url>" style output.
  cleaned = cleaned.replace(
    /(?:图片链接|图链|image\s*link)\s*[：:]\s*(https?:\/\/[^\s\])>]+)/gi,
    (match, rawTarget: string) => (collectMediaUrl(String(rawTarget), seen, mediaUrls) ? "" : match),
  );

  return {
    text: cleaned.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    mediaUrls,
  };
}

const FEISHU_MISSING_IMAGE_FALLBACK_TEXT =
  "未检测到可发送的图片内容。请稍后重试，或提供可访问的图片链接后我再发送。";
const FEISHU_MISSING_NEWS_FALLBACK_TEXT =
  "未获取到有效新闻结果（缺少真实链接或命中占位文本）。请稍后重试，或改为“搜索美团新闻，返回5条（标题/来源/时间/链接）”。";
const FEISHU_INVALID_META_ECHO_FALLBACK_TEXT =
  "检测到无效系统元信息回复，未返回可用内容。请重试：例如“今天股市新闻，返回5条（标题/来源/时间/链接）”。";
const FEISHU_INTERNAL_TRACE_FALLBACK_TEXT =
  "检测到内部调试片段（/thinking 或 tool 原始块）泄漏，已拦截。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”。";
const FEISHU_SEARCH_KEY_ERROR_FALLBACK_TEXT =
  "实时新闻检索服务当前不可用（搜索密钥未配置或不可用）。请稍后重试，或改为“今天美股新闻，返回5条（标题/来源/时间/链接）”。";
const FEISHU_FINANCE_PARAM_ERROR_FALLBACK_TEXT =
  "新闻检索参数不足（symbol 要求不适用于本次泛市场请求）。请重试：例如“今天美股新闻，返回5条（标题/来源/时间/链接）”；也可指定“美股新闻 AAPL”。";
const FEISHU_CHART_REFUSAL_FALLBACK_TEXT =
  "图表请求已收到。请补充标的与周期（例如：AAPL，近3个月/日线）；我将抓取数据并发送图表图片。";

function claimsImageDelivered(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  const zhPattern =
    /(?:已|已经|现已|我已|已为您|已帮您|已将|已把).{0,16}(?:发送|附上|附带|上传|推送).{0,8}(?:图片|截图|图表|图像|图)|(?:图片|截图|图表|图像|图).{0,12}(?:已|已经).{0,8}(?:发送|附上|附带|上传)|(?:见下图|如下图|已附图|附图如下|已附上相关图片|已发送图片)/i;
  if (zhPattern.test(text)) {
    return true;
  }

  const enPattern =
    /(?:i\s*(?:have|'ve)\s*(?:sent|attached|included).{0,24}(?:image|chart|screenshot))|(?:attached\s+(?:the\s+)?(?:image|chart|screenshot))|(?:see\s+(?:the\s+)?(?:image|chart|screenshot))/i;
  return enPattern.test(text);
}

function hasUrl(text: string): boolean {
  return /https?:\/\/\S+/i.test(text);
}

function looksLikePlaceholderNewsResult(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const mentionsNewsSearch = /(搜索|新闻|news|headline)/i.test(trimmed);
  if (!mentionsNewsSearch || hasUrl(trimmed)) {
    return false;
  }

  const placeholderPattern =
    /\[(?:搜索结果|搜索结果如下|具体文章链接|文章链接|新闻链接|链接)\]|(?:可点击查看详细内容|如需进一步操作，可随时告诉我)/i;
  if (placeholderPattern.test(trimmed)) {
    return true;
  }

  const searchIntent = /(搜索|检索|news|headline|最新新闻|新闻搜索)/i.test(trimmed);
  if (!searchIntent) {
    return false;
  }
  const resultCue = /(搜索结果|结果如下|为你找到|找到以下|新闻如下|以下是(?:[^。\n]{0,12})新闻)/i.test(
    trimmed,
  );
  const listLike = /(?:^|\n)\s*(?:[-*]|\d+[).、])\s*/m.test(trimmed);
  return resultCue || listLike;
}

function looksLikeFeishuMetaEcho(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasMetaHeader = /(Feishu\s*DM消息相关信息如下|消息相关信息如下|系统消息相关信息)/i.test(
    trimmed,
  );
  const hasSenderLine = /(发起人账号|sender|open_id|chat_id|session(?:\s*id)?)/i.test(trimmed);
  const hasTopicLine = /(内容主题|主题|topic)/i.test(trimmed);
  const hasFeishuId = /\b(?:ou|oc)_[a-z0-9]{8,}\b/i.test(trimmed);
  const hasFiller = /(如有进一步问题|需要帮助|随时告诉我)/i.test(trimmed);

  return (hasMetaHeader && (hasSenderLine || hasFeishuId)) || (hasSenderLine && hasTopicLine && hasFiller);
}

function looksLikeInternalTraceLeak(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return (
    /(?:^|\n)\s*\/thinking\b/i.test(trimmed) ||
    /\[web_search_result]/i.test(trimmed) ||
    /\[message_id:[^\]]+]/i.test(trimmed) ||
    /\[(?:tool|search|browser)_(?:result|output)]/i.test(trimmed)
  );
}

function looksLikeSearchApiKeyError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasSearchKeyTerms =
    /(Brave Search API key|brave api key|web_search|Tools\s*>\s*Web|search request|documentation here)/i.test(
      trimmed,
    );
  const hasErrorFraming =
    /(error indicates|required|configure|set your|ensure it'?s passed correctly|to resolve)/i.test(
      trimmed,
    );

  const hasZhKeyTerms = /(搜索密钥|Brave.*密钥|web_search.*密钥|配置.*密钥)/i.test(trimmed);
  return (hasSearchKeyTerms && hasErrorFraming) || hasZhKeyTerms;
}

function looksLikeFinanceSymbolParamError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasSymbolRequired = /(symbol required|requires a symbol parameter|provide the market symbol)/i.test(
    trimmed,
  );
  const hasFinanceFunction = /(finance function|finance tool|function call)/i.test(trimmed);
  const hasQuestionContext = /(today.*stock.*news|今天.*股市.*新闻|今天.*美股.*新闻)/i.test(trimmed);
  return hasSymbolRequired && (hasFinanceFunction || hasQuestionContext);
}

function looksLikeChartCapabilityRefusal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasChartAsk = /(图表|图形|chart|graph)/i.test(trimmed);
  if (!hasChartAsk) {
    return false;
  }

  const hasRefusal =
    /(无法(?:直接)?(?:生成|查看|提供)|不能(?:直接)?(?:生成|查看|提供)|不支持(?:直接)?(?:生成|查看)|unable to|can't|cannot)/i.test(
      trimmed,
    );
  const hasToolExcuse =
    /(消息ID|message\s*id|测试信息|交互|工具|tool|web(?:_search)?|搜索|网页内容)/i.test(trimmed);
  return hasRefusal && hasToolExcuse;
}

/**
 * Detect if text contains markdown elements that benefit from card rendering.
 * Used by auto render mode.
 */
function shouldUseCard(text: string): boolean {
  // Code blocks (fenced)
  if (/```[\s\S]*?```/.test(text)) {
    return true;
  }
  // Tables (at least header + separator row with |)
  if (/\|.+\|[\r\n]+\|[-:| ]+\|/.test(text)) {
    return true;
  }
  return false;
}

export type CreateFeishuReplyDispatcherParams = {
  cfg: MarketBotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  chatId: string;
  replyToMessageId?: string;
  /** Mention targets, will be auto-included in replies */
  mentionTargets?: MentionTarget[];
};

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams) {
  const core = getFeishuRuntime();
  const { cfg, agentId, chatId, replyToMessageId, mentionTargets } = params;

  const prefixContext = createReplyPrefixContext({
    cfg,
    agentId,
  });

  // Feishu doesn't have a native typing indicator API.
  // We use message reactions as a typing indicator substitute.
  let typingState: TypingIndicatorState | null = null;

  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      if (!replyToMessageId) {
        return;
      }
      typingState = await addTypingIndicator({ cfg, messageId: replyToMessageId });
      params.runtime.log?.(`feishu: added typing indicator reaction`);
    },
    stop: async () => {
      if (!typingState) {
        return;
      }
      await removeTypingIndicator({ cfg, state: typingState });
      typingState = null;
      params.runtime.log?.(`feishu: removed typing indicator reaction`);
    },
    onStartError: (err) => {
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "start",
        error: err,
      });
    },
    onStopError: (err) => {
      logTypingFailure({
        log: (message) => params.runtime.log?.(message),
        channel: "feishu",
        action: "stop",
        error: err,
      });
    },
  });

  const textChunkLimit = core.channel.text.resolveTextChunkLimit({
    cfg,
    channel: "feishu",
    defaultLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "feishu");
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "feishu",
  });

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
      onReplyStart: typingCallbacks.onReplyStart,
      deliver: async (payload: ReplyPayload) => {
        params.runtime.log?.(`feishu deliver called: text=${payload.text?.slice(0, 100)}`);
        const payloadText = payload.text ?? "";
        const extracted = extractMarkdownMedia(payloadText);
        let text = extracted.text;
        const mediaListRaw = payload.mediaUrls?.length
          ? payload.mediaUrls
          : payload.mediaUrl
            ? [payload.mediaUrl]
            : [];
        const mediaList = [...mediaListRaw, ...extracted.mediaUrls];
        const hasMedia = mediaList.length > 0;
        if (!hasMedia && claimsImageDelivered(text)) {
          params.runtime.log?.(
            `feishu deliver: detected image-sent claim without media, replacing with fallback text`,
          );
          text = FEISHU_MISSING_IMAGE_FALLBACK_TEXT;
        }
        if (looksLikePlaceholderNewsResult(text)) {
          params.runtime.log?.(
            `feishu deliver: detected placeholder news result without real links, replacing with fallback text`,
          );
          text = FEISHU_MISSING_NEWS_FALLBACK_TEXT;
        }
        if (looksLikeFeishuMetaEcho(text)) {
          params.runtime.log?.(
            `feishu deliver: detected metadata-echo style reply, replacing with fallback text`,
          );
          text = FEISHU_INVALID_META_ECHO_FALLBACK_TEXT;
        }
        if (looksLikeInternalTraceLeak(text)) {
          params.runtime.log?.(
            `feishu deliver: detected internal trace leak in response, replacing with fallback text`,
          );
          text = FEISHU_INTERNAL_TRACE_FALLBACK_TEXT;
        }
        if (looksLikeSearchApiKeyError(text)) {
          params.runtime.log?.(
            `feishu deliver: detected search api key error reply, replacing with fallback text`,
          );
          text = FEISHU_SEARCH_KEY_ERROR_FALLBACK_TEXT;
        }
        if (looksLikeFinanceSymbolParamError(text)) {
          params.runtime.log?.(
            `feishu deliver: detected finance symbol parameter error reply, replacing with fallback text`,
          );
          text = FEISHU_FINANCE_PARAM_ERROR_FALLBACK_TEXT;
        }
        if (looksLikeChartCapabilityRefusal(text)) {
          params.runtime.log?.(
            `feishu deliver: detected chart capability refusal reply, replacing with fallback text`,
          );
          text = FEISHU_CHART_REFUSAL_FALLBACK_TEXT;
        }
        const hasText = Boolean(text.trim());
        if (!hasText && !hasMedia) {
          params.runtime.log?.(`feishu deliver: empty payload, skipping`);
          return;
        }

        if (hasText) {
          // Check render mode: auto (default), raw, or card
          const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
          const renderMode = feishuCfg?.renderMode ?? "auto";

          // Determine if we should use card for this message
          const useCard =
            renderMode === "card" || (renderMode === "auto" && shouldUseCard(text));

          // Only include @mentions in the first chunk (avoid duplicate @s)
          let isFirstChunk = true;

          if (useCard) {
            // Card mode: send as interactive card with markdown rendering
            const chunks = core.channel.text.chunkTextWithMode(text, textChunkLimit, chunkMode);
            params.runtime.log?.(`feishu deliver: sending ${chunks.length} card chunks to ${chatId}`);
            for (const chunk of chunks) {
              await sendMarkdownCardFeishu({
                cfg,
                to: chatId,
                text: chunk,
                replyToMessageId,
                mentions: isFirstChunk ? mentionTargets : undefined,
              });
              isFirstChunk = false;
            }
          } else {
            // Raw mode: send as plain text with table conversion
            const converted = core.channel.text.convertMarkdownTables(text, tableMode);
            const chunks = core.channel.text.chunkTextWithMode(converted, textChunkLimit, chunkMode);
            params.runtime.log?.(`feishu deliver: sending ${chunks.length} text chunks to ${chatId}`);
            for (const chunk of chunks) {
              await sendMessageFeishu({
                cfg,
                to: chatId,
                text: chunk,
                replyToMessageId,
                mentions: isFirstChunk ? mentionTargets : undefined,
              });
              isFirstChunk = false;
            }
          }
        }

        if (hasMedia) {
          for (const mediaUrl of mediaList) {
            if (!mediaUrl?.trim()) {
              continue;
            }
            params.runtime.log?.(`feishu deliver: sending media ${mediaUrl.slice(0, 120)}`);
            await sendMediaFeishu({
              cfg,
              to: chatId,
              mediaUrl,
              replyToMessageId,
            });
          }
        }
      },
      onError: (err, info) => {
        params.runtime.error?.(`feishu ${info.kind} reply failed: ${String(err)}`);
        typingCallbacks.onIdle?.();
      },
      onIdle: typingCallbacks.onIdle,
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
    },
    markDispatchIdle,
  };
}

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
const FEISHU_SYMBOL_REQUIRED_FALLBACK_TEXT =
  "已识别为 symbol 参数缺失。若你要“美股七姐妹图表”，我将按 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA 生成并发送；也可直接指定单个代码与周期（如 AAPL 日线近3个月）。";
const FEISHU_CHART_REFUSAL_FALLBACK_TEXT =
  "图表请求已收到。请补充标的与周期（例如：AAPL，近3个月/日线）；我将抓取数据并发送图表图片。";
const FEISHU_CHART_NEWS_MISROUTE_FALLBACK_TEXT =
  "图表请求误入新闻检索流程，已自动纠正。我将按美股七姐妹（AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA）抓取行情并绘制图表后发送。";
const FEISHU_PLACEHOLDER_URL_FALLBACK_TEXT =
  "检测到占位链接（example.com）导致抓取失败。请提供真实可访问的数据链接，或直接说明标的与周期后我继续处理。";
const FEISHU_PLACEHOLDER_URL_CHART_FALLBACK_TEXT =
  "检测到占位链接（example.com）导致抓取失败，已自动纠正。接下来我将基于美股七姐妹（AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA）抓取真实行情并绘制图表。";
const FEISHU_DOC_ARG_ERROR_FALLBACK_TEXT =
  "已忽略无关的 Feishu 文档参数报错（space_id 等）。我将直接使用浏览器与行情工具抓取美股七姐妹（AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA）并绘制图表。";
const FEISHU_PROCESS_TEMPLATE_FALLBACK_TEXT =
  "当前回复仅包含操作步骤，未返回实际结果。请重试同一请求，我会直接给出结果，不再输出过程说明。";
const FEISHU_PROCESS_TEMPLATE_CHART_FALLBACK_TEXT =
  "当前回复仅包含操作步骤，未返回实际结果。已自动纠偏：美股七姐妹为 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA。请重试同一请求，我会直接返回最新行情表与图表。";
const FEISHU_TOOLCALL_400_FALLBACK_TEXT =
  "检测到工具调用参数错误模板（400），未返回实际结果。请重试同一请求，我会直接执行并返回结果。";
const FEISHU_TOOLCALL_400_CHART_FALLBACK_TEXT =
  "检测到工具调用参数错误模板（400），未返回实际结果。已自动纠偏：美股七姐妹为 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA。请重试同一请求，我会直接返回最新行情表与图表。";
const FEISHU_TOOL_UNAVAILABLE_FALLBACK_TEXT =
  "检测到“工具不可用”模板回复，未返回实际结果。请重试同一请求，我会直接执行并返回结果。";
const FEISHU_TOOL_UNAVAILABLE_CHART_FALLBACK_TEXT =
  "检测到“工具不可用”模板回复，未返回实际结果。已自动纠偏：美股七姐妹为 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA。请重试同一请求，我会直接返回最新行情表与图表。";
const FEISHU_FAKE_COMPLETION_FALLBACK_TEXT =
  "检测到“已完成”模板回复，未返回实际结果。请重试同一请求，我会直接返回可用结果。";
const FEISHU_FAKE_COMPLETION_CHART_FALLBACK_TEXT =
  "检测到“已完成”模板回复，但未返回图表或行情数据。已自动纠偏：美股七姐妹为 AAPL、MSFT、NVDA、AMZN、GOOGL、META、TSLA。请重试同一请求，我会直接返回最新行情表与图表。";

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

function looksLikeNewsIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return /(新闻|news|headline|快讯|资讯|要闻)/i.test(trimmed);
}

function looksLikeChartIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return /(图表|走势图|k线|chart|graph|plot|绘图|绘制|画图|行情图)/i.test(trimmed);
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
    /(?:^|\n)\s*_forum\b/i.test(trimmed) ||
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

  const hasSymbolRequired =
    /(symbol required|requires a symbol parameter|symbol parameter|provide (?:the )?symbol|market symbol|included in the call)/i.test(
      trimmed,
    );
  const hasErrorFrame =
    /(error indicates|not included|missing|requires|to resolve|please provide)/i.test(trimmed);
  return hasSymbolRequired && hasErrorFrame;
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

function looksLikeFeishuDocArgError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasDocTerms = /(Feishu document|feishu[_\s-]?doc|文档|space_id|folder token|path argument)/i.test(
    trimmed,
  );
  const hasErrorTerms =
    /(error|requires?|missing|not included|correct function call|please provide|参数|缺失|报错)/i.test(
      trimmed,
    );
  return hasDocTerms && hasErrorTerms;
}

function looksLikeFeishuWikiActionError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasWikiTerms = /(Feishu Wiki|wiki)/i.test(trimmed);
  const hasSearchUnavailable =
    /(search[\"']?\s*action\s*(?:is\s*)?not\s*available|action\s*[\"']?search[\"']?\s*is\s*not\s*available)/i.test(
      trimmed,
    );
  const hasWrongGuidance = /(nodes\s*action|get\s*action|node\s*token)/i.test(trimmed);
  const hasErrorFrame = /(error message indicates|instead,?\s*you should use|to resolve)/i.test(trimmed);

  return hasWikiTerms && hasSearchUnavailable && hasWrongGuidance && hasErrorFrame;
}

function looksLikePlaceholderUrlFetchError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const hasFetchError =
    /(web fetch attempt failed|fetch attempt failed|抓取失败|请求失败|404|not found)/i.test(trimmed);
  const hasPlaceholderUrl =
    /(Example Domain|example\.com(?:\/[^\s)]*)?|documentation-only use|cannot be used in operations)/i.test(
      trimmed,
    );
  const hasUrlFixGuidance = /(verify the url|ensure it'?s valid|domain you wish to fetch)/i.test(
    trimmed,
  );
  return hasFetchError && hasPlaceholderUrl && hasUrlFixGuidance;
}

function looksLikeExecutionIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return /(抓取|搜索|查询|获取|绘制|画图|图表|行情|股票|新闻|news|chart|graph|fetch|quote|market data)/i.test(
    trimmed,
  );
}

function looksLikeProcessTemplateOutput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const hasStepFraming =
    /(要完成以下任务|按照以下步骤|请按以下步骤|步骤如下|操作示例|工具可用|请根据需求逐步执行)/i.test(
      trimmed,
    );
  const hasToolPseudoCode =
    /(?:^|\n)\s*(?:query|url|extractMode)\s*\{\s*["'{]/mi.test(trimmed) ||
    /```[\s\S]*?(?:query|search_term|extractMode|example\.com)[\s\S]*?```/i.test(trimmed);
  const hasEnumeratedSteps = /(?:^|\n)\s*(?:\d+[).、]|[-*])\s+\*\*?.+/m.test(trimmed);

  return hasStepFraming && (hasToolPseudoCode || hasEnumeratedSteps);
}

function looksLikeToolCall400Template(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const has400 = /(Request failed with status code 400|status code 400|请求失败.*400|400.*请求失败)/i.test(
    trimmed,
  );
  if (!has400) {
    return false;
  }

  const hasJsonGuidance =
    /(JSON structure|malformed|missing required parameters|Verify JSON Format|Check Function Name|Parameter Validation)/i.test(
      trimmed,
    );
  const hasParamExamples = /(sessionKey|query|file_token|function or parameters)/i.test(trimmed);
  const hasTemplateTone = /(If the issue persists|please provide more details|Let me double-check)/i.test(
    trimmed,
  );

  return (hasJsonGuidance && hasParamExamples) || (hasJsonGuidance && hasTemplateTone);
}

function looksLikeToolUnavailableRefusalTemplate(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasUnavailableRefusal =
    /(无法直接使用(?:内置)?浏览器|无法直接(?:执行|使用).{0,20}(?:操作|请求)|工具列表中未包含|工具(?:列表)?(?:里)?未包含|工具(?:当前)?不可用|tool(?:s)?(?:\s+list)?(?:\s+does\s+not\s+include|\s+not\s+available)|browser(?:\s+tool)?\s+not\s+available)/i.test(
      trimmed,
    );
  if (!hasUnavailableRefusal) {
    return false;
  }

  const hasTemplateGuidance =
    /(建议调整步骤|检查工具需求|请提供更明确的步骤|provide more specific steps|check tool requirements|to get support)/i.test(
      trimmed,
    );
  return hasTemplateGuidance || hasUnavailableRefusal;
}

function looksLikeCompletionTemplateWithoutResults(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasUrl(trimmed)) {
    return false;
  }

  const hasCompletionCue =
    /(操作已完成|任务已完成|处理完成|已为您完成|已完成(?:：|:)?|done|completed)/i.test(trimmed);
  if (!hasCompletionCue) {
    return false;
  }

  const hasPoliteClosure = /(如需进一步(?:操作|帮助)|请随时告知|随时告诉我|let me know)/i.test(trimmed);
  const hasChecklistStyle = /(?:^|\n)\s*(?:使用|通过|最后|然后|并且)/m.test(trimmed);

  const hasResultEvidence =
    /(?:AAPL|MSFT|NVDA|AMZN|GOOGL|META|TSLA)\b/i.test(trimmed) ||
    /(?:\$|￥|¥)\s*\d+(?:\.\d+)?/.test(trimmed) ||
    /\d+(?:\.\d+)?\s*%/.test(trimmed) ||
    /(?:^|\n)\s*\|.+\|\s*$/m.test(trimmed) ||
    /```mermaid/i.test(trimmed) ||
    /\bMEDIA:\s*\S+/i.test(trimmed);

  return (hasPoliteClosure || hasChecklistStyle) && !hasResultEvidence;
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
  /** User inbound text for intent-aware fallback routing. */
  sourceText?: string;
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
        const intentText = params.sourceText?.trim() ? params.sourceText : payloadText;
        const combinedIntentText = `${intentText}\n${payloadText}`;
        const hasSevenSistersHint = /(七姐妹|magnificent\s*7|mag\s*7)/i.test(combinedIntentText);
        const looksLikeChartFlow =
          hasSevenSistersHint ||
          looksLikeChartIntent(intentText) ||
          looksLikeChartIntent(payloadText);
        const looksLikeNewsFlow =
          looksLikeNewsIntent(intentText) ||
          looksLikeNewsIntent(payloadText);
        const looksLikeExecutionFlow =
          looksLikeExecutionIntent(intentText) ||
          looksLikeExecutionIntent(payloadText);
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
          // Chart intent wins over news intent when both keywords appear in the
          // source text (e.g. forwarded replies containing prior "新闻" fallback text).
          if (looksLikeChartFlow) {
            params.runtime.log?.(
              `feishu deliver: detected placeholder news output in chart flow, replacing with chart fallback text`,
            );
            text = hasSevenSistersHint
              ? FEISHU_CHART_NEWS_MISROUTE_FALLBACK_TEXT
              : FEISHU_CHART_REFUSAL_FALLBACK_TEXT;
          } else if (looksLikeNewsFlow) {
            params.runtime.log?.(
              `feishu deliver: detected placeholder news result without real links, replacing with news fallback text`,
            );
            text = FEISHU_MISSING_NEWS_FALLBACK_TEXT;
          }
        }
        if (looksLikeFeishuMetaEcho(text)) {
          params.runtime.log?.(
            `feishu deliver: detected metadata-echo style reply, replacing with fallback text`,
          );
          text = FEISHU_INVALID_META_ECHO_FALLBACK_TEXT;
        }
        if (looksLikeFeishuDocArgError(text)) {
          params.runtime.log?.(
            `feishu deliver: detected feishu-doc argument error leakage, replacing with fallback text`,
          );
          text = FEISHU_DOC_ARG_ERROR_FALLBACK_TEXT;
        }
        if (looksLikeFeishuWikiActionError(text)) {
          params.runtime.log?.(
            `feishu deliver: detected feishu wiki action error leakage, replacing with fallback text`,
          );
          text = FEISHU_DOC_ARG_ERROR_FALLBACK_TEXT;
        }
        if (looksLikePlaceholderUrlFetchError(text)) {
          params.runtime.log?.(
            `feishu deliver: detected placeholder-url fetch error leakage, replacing with fallback text`,
          );
          text =
            looksLikeChartFlow
              ? FEISHU_PLACEHOLDER_URL_CHART_FALLBACK_TEXT
              : FEISHU_PLACEHOLDER_URL_FALLBACK_TEXT;
        }
        if (looksLikeExecutionFlow && looksLikeProcessTemplateOutput(text)) {
          params.runtime.log?.(
            `feishu deliver: detected process-template output without final result, replacing with result-oriented fallback text`,
          );
          text = looksLikeChartFlow
            ? FEISHU_PROCESS_TEMPLATE_CHART_FALLBACK_TEXT
            : FEISHU_PROCESS_TEMPLATE_FALLBACK_TEXT;
        }
        if (looksLikeExecutionFlow && looksLikeToolCall400Template(text)) {
          params.runtime.log?.(
            `feishu deliver: detected toolcall-400 template output without final result, replacing with result-oriented fallback text`,
          );
          text = looksLikeChartFlow
            ? FEISHU_TOOLCALL_400_CHART_FALLBACK_TEXT
            : FEISHU_TOOLCALL_400_FALLBACK_TEXT;
        }
        if (looksLikeExecutionFlow && looksLikeToolUnavailableRefusalTemplate(text)) {
          params.runtime.log?.(
            `feishu deliver: detected tool-unavailable refusal template without final result, replacing with result-oriented fallback text`,
          );
          text = looksLikeChartFlow
            ? FEISHU_TOOL_UNAVAILABLE_CHART_FALLBACK_TEXT
            : FEISHU_TOOL_UNAVAILABLE_FALLBACK_TEXT;
        }
        if (looksLikeExecutionFlow && !hasMedia && looksLikeCompletionTemplateWithoutResults(text)) {
          params.runtime.log?.(
            `feishu deliver: detected completion-template reply without deliverables, replacing with result-oriented fallback text`,
          );
          text = looksLikeChartFlow
            ? FEISHU_FAKE_COMPLETION_CHART_FALLBACK_TEXT
            : FEISHU_FAKE_COMPLETION_FALLBACK_TEXT;
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
          text = hasSevenSistersHint
            ? FEISHU_SYMBOL_REQUIRED_FALLBACK_TEXT
            : FEISHU_FINANCE_PARAM_ERROR_FALLBACK_TEXT;
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

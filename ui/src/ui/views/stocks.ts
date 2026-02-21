import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { toSanitizedMarkdownHtml } from "../markdown";
import type { UiLanguage } from "../storage";
import type { DailyStockRunResult } from "../types";

export type StocksProps = {
  language?: UiLanguage;
  loading: boolean;
  running: boolean;
  error: string | null;
  watchlistText: string;
  timeframe: string;
  reportType: "simple" | "full";
  includeFundamentals: boolean;
  newsLimit: string;
  locale: string;
  last: DailyStockRunResult | null;
  onWatchlistTextChange: (next: string) => void;
  onTimeframeChange: (next: string) => void;
  onReportTypeChange: (next: "simple" | "full") => void;
  onIncludeFundamentalsChange: (next: boolean) => void;
  onNewsLimitChange: (next: string) => void;
  onLocaleChange: (next: string) => void;
  onRefresh: () => void;
  onSaveWatchlist: () => void;
  onRun: () => void;
};

const STOCKS_TEXT = {
  en: {
    heroTitle: "Signal Deck",
    heroSub:
      "Daily-stock style command center: queue, sentiment pulse, key insight, and one-click execution.",
    quickAnalyze: "Quick Analyze",
    quickPlaceholder: "Enter ticker (AAPL, 600519, hk00700) and hit run",
    pipelineHealth: "Pipeline Health",
    completion: "Completion",
    mode: "Mode",
    queueTitle: "Analysis Queue",
    queueSub: "Execution status for the current watchlist.",
    queueRunning: "running",
    queueDone: "done",
    queueFailed: "failed",
    queuePending: "pending",
    queueEmpty: "Watchlist is empty.",
    historyTitle: "Latest Snapshot",
    historyEmpty: "No completed run yet.",
    watchlistTitle: "Watchlist Control",
    watchlistSub: "One symbol per line. US / A-share / HK are supported.",
    watchlistReady: "Watchlist is clean and ready to run.",
    watchlistNeedsDedupe: "Duplicates detected. Run dedupe before execution.",
    watchlistNeedsClean: "Invalid lines detected. Run clean list before execution.",
    totalLines: "Lines",
    uniqueSymbolsLabel: "Unique",
    duplicateLines: "Duplicates",
    invalidLines: "Invalid",
    cleanList: "Clean List",
    dedupeList: "Deduplicate",
    clearList: "Clear",
    symbols: "symbols",
    refreshing: "Refreshing…",
    refresh: "Refresh",
    save: "Save",
    running: "Running…",
    runNow: "Run Now",
    run: "Run",
    date: "Date",
    timeframe: "Timeframe",
    reportType: "Report Type",
    fundamentals: "Fundamentals",
    newsLimit: "News Limit",
    newsQuick: "Quick",
    locale: "Locale",
    reportTitle: "Full Research Note",
    reportSub: "Full markdown output for audit and downstream sharing.",
    noReport: "No report available yet.",
    simple: "simple (push-friendly)",
    full: "full (research)",
    focusTitle: "Key Insights",
    noSavedRun: "No saved run yet. Trigger a run to generate today's dashboard.",
    operationAdvice: "Action",
    trendOutlook: "Trend Outlook",
    adviceBuy: "Bias BUY",
    adviceWatch: "Bias WATCH",
    adviceSell: "Bias SELL",
    strategyTitle: "Strategy Points",
    strategySub: "Auto-extracted from latest dashboard markdown.",
    entryIdeal: "Primary Entry",
    entrySecond: "Secondary Entry",
    stopLoss: "Stop",
    target1: "Target",
    sentimentTitle: "Market Sentiment",
    sentimentBull: "Risk-On",
    sentimentNeutral: "Neutral",
    sentimentBear: "Risk-Off",
    sentimentEngine: "Signal Mix",
    buy: "BUY",
    watch: "WATCH",
    sell: "SELL",
    failed: "FAILED",
    intelTitle: "News Feed",
    intelSub: "Parsed from latest markdown and linked sources.",
    noNews: "No news extracted from the last report.",
    jump: "Open",
    controlsTitle: "Execution Console",
    controlsSub: "Tune workflow and data depth before launch.",
    presets: "Presets",
    presetGlobal: "Global Snapshot",
    presetDeep: "Equity Deep Dive",
    presetNews: "News Pulse",
    toggleSources: "Source Toggles",
    toggleFundamentals: "Fundamentals",
    toggleNews: "News Feed",
  },
  zh: {
    heroTitle: "信号作战台",
    heroSub: "参考 daily_stock_analysis 的交易面板：任务队列、情绪脉冲、关键信息与一键执行。",
    quickAnalyze: "快速分析",
    quickPlaceholder: "输入代码（AAPL、600519、hk00700）后立即运行",
    pipelineHealth: "流水线健康度",
    completion: "完成率",
    mode: "模式",
    queueTitle: "分析任务",
    queueSub: "当前观察列表的执行状态。",
    queueRunning: "分析中",
    queueDone: "已完成",
    queueFailed: "失败",
    queuePending: "待执行",
    queueEmpty: "观察列表为空。",
    historyTitle: "最近快照",
    historyEmpty: "暂无已完成运行。",
    watchlistTitle: "观察列表控制台",
    watchlistSub: "每行一个标的。支持美股 / A 股 / 港股代码。",
    watchlistReady: "列表质量良好，可直接运行。",
    watchlistNeedsDedupe: "检测到重复项，建议先去重再执行。",
    watchlistNeedsClean: "检测到疑似无效行，建议先清洗再执行。",
    totalLines: "总行数",
    uniqueSymbolsLabel: "去重后",
    duplicateLines: "重复",
    invalidLines: "疑似无效",
    cleanList: "清洗列表",
    dedupeList: "仅去重",
    clearList: "清空",
    symbols: "个标的",
    refreshing: "刷新中…",
    refresh: "刷新",
    save: "保存",
    running: "运行中…",
    runNow: "立即运行",
    run: "运行",
    date: "日期",
    timeframe: "时间范围",
    reportType: "报告类型",
    fundamentals: "基本面",
    newsLimit: "新闻数量",
    newsQuick: "快捷",
    locale: "区域",
    reportTitle: "完整研究报告",
    reportSub: "保留完整 Markdown 输出，便于审阅与二次分发。",
    noReport: "暂无可用报告。",
    simple: "simple（适合推送）",
    full: "full（研究版）",
    focusTitle: "核心洞察",
    noSavedRun: "暂无已保存运行，执行一次后会生成今日仪表盘。",
    operationAdvice: "操作建议",
    trendOutlook: "趋势判断",
    adviceBuy: "偏买入",
    adviceWatch: "偏观望",
    adviceSell: "偏减仓",
    strategyTitle: "狙击点位",
    strategySub: "从最新仪表盘 Markdown 自动提取关键点位。",
    entryIdeal: "理想买入",
    entrySecond: "二次买入",
    stopLoss: "止损",
    target1: "目标位",
    sentimentTitle: "市场情绪",
    sentimentBull: "偏多",
    sentimentNeutral: "中性",
    sentimentBear: "偏空",
    sentimentEngine: "信号构成",
    buy: "买入",
    watch: "观望",
    sell: "卖出",
    failed: "失败",
    intelTitle: "资讯雷达",
    intelSub: "从最新报告内容与链接自动聚合。",
    noNews: "最新报告中暂无可提取资讯。",
    jump: "跳转",
    controlsTitle: "执行控制台",
    controlsSub: "运行前统一配置工作流参数与数据深度。",
    presets: "预设",
    presetGlobal: "全球快照",
    presetDeep: "股票深度",
    presetNews: "新闻脉冲",
    toggleSources: "数据源开关",
    toggleFundamentals: "基本面",
    toggleNews: "新闻流",
  },
} as const;

type ParsedDecision = {
  symbol: string;
  asOfIso: string;
  price: string;
  conclusion: string;
  advice: "buy" | "watch" | "sell";
  adviceRaw: string;
  entry: string;
  stop: string;
  target1: string;
  target2: string;
  checklist: string[];
  news: Array<{ title: string; link?: string }>;
};

function normalizeSymbolsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function symbolCanonicalKey(symbol: string) {
  return symbol.trim().toUpperCase();
}

function normalizeSymbolDisplay(symbol: string) {
  const trimmed = symbol.trim();
  const hkMatch = /^hk(\d{4,5})$/i.exec(trimmed);
  if (hkMatch) return `hk${hkMatch[1]}`;
  return trimmed.toUpperCase();
}

function isLikelySymbol(symbol: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/.test(symbol.trim());
}

function summarizeWatchlist(text: string) {
  const lines = normalizeSymbolsFromText(text);
  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  for (const line of lines) {
    const key = symbolCanonicalKey(line);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    if (!isLikelySymbol(line)) invalid += 1;
  }
  return {
    lines,
    uniqueCount: seen.size,
    duplicates,
    invalid,
  };
}

function parseDecisionMarkdown(markdown: string): ParsedDecision | null {
  const rawLines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return null;

  const parsed: ParsedDecision = {
    symbol: "",
    asOfIso: "-",
    price: "-",
    conclusion: "",
    advice: "watch",
    adviceRaw: "WATCH",
    entry: "n/a",
    stop: "n/a",
    target1: "n/a",
    target2: "n/a",
    checklist: [],
    news: [],
  };

  let section: "none" | "checklist" | "news" = "none";

  for (const line of rawLines) {
    if (line.startsWith("## ")) {
      parsed.symbol = line.replace(/^##\s+/, "").replace(/\s+决策仪表盘$/, "").trim();
      continue;
    }
    if (line.startsWith("### Checklist")) {
      section = "checklist";
      continue;
    }
    if (line.startsWith("### News")) {
      section = "news";
      continue;
    }

    if (line.startsWith("- 截至:")) {
      parsed.asOfIso = line.replace("- 截至:", "").trim();
      continue;
    }
    if (line.startsWith("- 现价:")) {
      parsed.price = line.replace("- 现价:", "").trim();
      continue;
    }
    if (line.startsWith("- 结论:")) {
      parsed.conclusion = line.replace("- 结论:", "").trim();
      continue;
    }
    if (line.startsWith("- 建议:")) {
      const adviceRaw = line.replace("- 建议:", "").trim();
      parsed.adviceRaw = adviceRaw;
      const token = /\b(BUY|WATCH|SELL)\b/i.exec(adviceRaw)?.[1]?.toUpperCase();
      if (token === "BUY") parsed.advice = "buy";
      if (token === "SELL") parsed.advice = "sell";
      if (token === "WATCH") parsed.advice = "watch";
      continue;
    }
    if (line.startsWith("- 点位:")) {
      const body = line.replace("- 点位:", "").trim();
      const entry = /entry=([^,]+)/i.exec(body)?.[1]?.trim();
      const stop = /stop=([^,]+)/i.exec(body)?.[1]?.trim();
      const t1 = /t1=([^,]+)/i.exec(body)?.[1]?.trim();
      const t2 = /t2=([^,]+)/i.exec(body)?.[1]?.trim();
      if (entry) parsed.entry = entry;
      if (stop) parsed.stop = stop;
      if (t1) parsed.target1 = t1;
      if (t2) parsed.target2 = t2;
      continue;
    }

    if (section === "checklist" && line.startsWith("- ")) {
      parsed.checklist.push(line.slice(2).trim());
      continue;
    }
    if (section === "news") {
      if (line.startsWith("- ")) {
        parsed.news.push({ title: line.slice(2).trim() });
        continue;
      }
      if (/^https?:\/\//i.test(line)) {
        const last = parsed.news.at(-1);
        if (last && !last.link) {
          last.link = line;
        }
      }
    }
  }

  if (!parsed.conclusion) return null;
  return parsed;
}

function extractNewsFromMarkdown(markdown: string, maxItems = 5): Array<{ title: string; link?: string }> {
  const items: Array<{ title: string; link?: string }> = [];
  const seen = new Set<string>();

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const title = match[1]?.trim();
    const link = match[2]?.trim();
    if (!title) continue;
    const key = `${title}::${link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, link });
    if (items.length >= maxItems) return items;
  }

  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("- ")) continue;
    const text = line.slice(2).trim();
    if (!text || text.length < 10) continue;
    if (text.startsWith("截至") || text.startsWith("现价") || text.startsWith("结论") || text.startsWith("建议")) {
      continue;
    }
    const key = `${text}::`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title: text });
    if (items.length >= maxItems) break;
  }

  return items;
}

function sentimentFromCounts(
  counts: DailyStockRunResult["counts"] | null,
  text: (typeof STOCKS_TEXT)["en" | "zh"],
) {
  const base = counts ?? { buy: 0, watch: 0, sell: 0, failed: 0 };
  const active = base.buy + base.watch + base.sell;
  if (active <= 0) {
    return {
      score: 50,
      label: text.sentimentNeutral,
      tone: "neutral" as const,
    };
  }
  const score = Math.max(0, Math.min(100, Math.round((base.buy * 100 + base.watch * 55 + base.sell * 15) / active)));
  if (score >= 68) {
    return { score, label: text.sentimentBull, tone: "bull" as const };
  }
  if (score <= 38) {
    return { score, label: text.sentimentBear, tone: "bear" as const };
  }
  return { score, label: text.sentimentNeutral, tone: "neutral" as const };
}

function deriveQueueStatus(params: {
  watchlist: string[];
  last: DailyStockRunResult | null;
  running: boolean;
  text: (typeof STOCKS_TEXT)["en" | "zh"];
}) {
  const { watchlist, last, running, text } = params;
  const bySymbol = new Map<string, DailyStockRunResult["items"][number]>();
  for (const item of last?.items ?? []) {
    bySymbol.set(symbolCanonicalKey(item.symbol || item.symbolInput), item);
  }

  return watchlist.map((symbol, index) => {
    const key = symbolCanonicalKey(symbol);
    const item = bySymbol.get(key);
    if (running && index === 0) {
      return { symbol, status: "running" as const, label: text.queueRunning };
    }
    if (!item) {
      return { symbol, status: "pending" as const, label: text.queuePending };
    }
    if (item.ok) {
      return { symbol, status: "done" as const, label: text.queueDone };
    }
    return { symbol, status: "failed" as const, label: text.queueFailed };
  });
}

function renderControls(props: StocksProps, text: (typeof STOCKS_TEXT)["en" | "zh"]) {
  const newsLimit = Number.parseInt(props.newsLimit.trim() || "0", 10);
  const hasNews = Number.isFinite(newsLimit) && newsLimit > 0;

  const applyPreset = (preset: "global" | "deep" | "news") => {
    if (preset === "global") {
      props.onTimeframeChange("6mo");
      props.onReportTypeChange("simple");
      props.onIncludeFundamentalsChange(false);
      props.onNewsLimitChange("2");
      props.onLocaleChange("US");
      return;
    }
    if (preset === "deep") {
      props.onTimeframeChange("1y");
      props.onReportTypeChange("full");
      props.onIncludeFundamentalsChange(true);
      props.onNewsLimitChange("6");
      props.onLocaleChange("US");
      return;
    }
    props.onTimeframeChange("ytd");
    props.onReportTypeChange("simple");
    props.onIncludeFundamentalsChange(false);
    props.onNewsLimitChange("10");
    props.onLocaleChange(props.locale || "US");
  };

  return html`
    <section class="card stocks-control-card">
      <div class="card-title">${text.controlsTitle}</div>
      <div class="card-sub">${text.controlsSub}</div>

      <div class="field stocks-field-group">
        <span>${text.presets}</span>
        <div class="row stocks-row-wrap stocks-row-tight">
          <button class="btn" type="button" @click=${() => applyPreset("global")}>${text.presetGlobal}</button>
          <button class="btn" type="button" @click=${() => applyPreset("deep")}>${text.presetDeep}</button>
          <button class="btn" type="button" @click=${() => applyPreset("news")}>${text.presetNews}</button>
        </div>
      </div>

      <div class="field stocks-field-group">
        <span>${text.toggleSources}</span>
        <div class="row stocks-row-wrap stocks-row-tight">
          <button
            class="btn ${props.includeFundamentals ? "primary" : ""}"
            type="button"
            @click=${() => props.onIncludeFundamentalsChange(!props.includeFundamentals)}
          >
            ${text.toggleFundamentals}
          </button>
          <button
            class="btn ${hasNews ? "primary" : ""}"
            type="button"
            @click=${() => props.onNewsLimitChange(hasNews ? "0" : "5")}
          >
            ${text.toggleNews}
          </button>
        </div>
      </div>

      <div class="form-grid stocks-options-grid">
        <label class="field stocks-option stocks-option--timeframe">
          <span>${text.timeframe}</span>
          <select .value=${props.timeframe} @change=${(event: Event) => props.onTimeframeChange((event.target as HTMLSelectElement).value)}>
            <option value="6mo">6mo</option>
            <option value="1y">1y</option>
            <option value="ytd">ytd</option>
            <option value="max">max</option>
          </select>
        </label>

        <label class="field stocks-option stocks-option--report">
          <span>${text.reportType}</span>
          <select
            .value=${props.reportType}
            @change=${(event: Event) => {
      const value = (event.target as HTMLSelectElement).value;
      props.onReportTypeChange(value === "full" ? "full" : "simple");
    }}
          >
            <option value="simple">${text.simple}</option>
            <option value="full">${text.full}</option>
          </select>
        </label>

        <label class="field stocks-option stocks-option--news">
          <span>${text.newsLimit}</span>
          <input
            .value=${props.newsLimit}
            @input=${(event: Event) => props.onNewsLimitChange((event.target as HTMLInputElement).value)}
            placeholder="2"
          />
          <div class="row stocks-row-wrap stocks-row-tight stocks-news-quick">
            <span class="muted">${text.newsQuick}</span>
            <button class="btn btn--sm" type="button" @click=${() => props.onNewsLimitChange("0")}>0</button>
            <button class="btn btn--sm" type="button" @click=${() => props.onNewsLimitChange("2")}>2</button>
            <button class="btn btn--sm" type="button" @click=${() => props.onNewsLimitChange("5")}>5</button>
            <button class="btn btn--sm" type="button" @click=${() => props.onNewsLimitChange("10")}>10</button>
          </div>
        </label>

        <label class="field stocks-option stocks-option--locale">
          <span>${text.locale}</span>
          <input
            .value=${props.locale}
            @input=${(event: Event) => props.onLocaleChange((event.target as HTMLInputElement).value)}
            placeholder="US"
          />
        </label>

        <div class="field field--toggle stocks-option stocks-option--fundamentals">
          <span>${text.fundamentals}</span>
          <label class="toggle">
            <input
              type="checkbox"
              .checked=${props.includeFundamentals}
              @change=${(event: Event) => props.onIncludeFundamentalsChange((event.target as HTMLInputElement).checked)}
            />
            <span class="toggle__track" aria-hidden="true"></span>
            <span class="toggle__thumb" aria-hidden="true"></span>
          </label>
        </div>
      </div>

      <div class="row stocks-actions">
        <button class="btn primary finance-cta" ?disabled=${props.running} @click=${props.onRun}>
          ${props.running ? text.running : text.runNow}
        </button>
      </div>
    </section>
  `;
}

export function renderStocks(props: StocksProps) {
  const language = props.language ?? "en";
  const text = STOCKS_TEXT[language] ?? STOCKS_TEXT.en;

  const watchlistSummary = summarizeWatchlist(props.watchlistText);
  const watchlist = watchlistSummary.lines;

  const dedupedWatchlist = (() => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const symbol of watchlist) {
      const key = symbolCanonicalKey(symbol);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(symbol);
    }
    return next;
  })();

  const cleanedWatchlist = (() => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const symbol of watchlist) {
      if (!isLikelySymbol(symbol)) continue;
      const normalized = normalizeSymbolDisplay(symbol);
      const key = symbolCanonicalKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(normalized);
    }
    return next;
  })();

  const hasInvalidLines = watchlistSummary.invalid > 0;
  const hasDuplicateLines = watchlistSummary.duplicates > 0;
  const qualityTone = hasInvalidLines ? "danger" : hasDuplicateLines ? "warn" : "success";
  const qualityMessage = hasInvalidLines
    ? text.watchlistNeedsClean
    : hasDuplicateLines
      ? text.watchlistNeedsDedupe
      : text.watchlistReady;

  const sentiment = sentimentFromCounts(props.last?.counts ?? null, text);
  const queueItems = deriveQueueStatus({ watchlist, last: props.last, running: props.running, text });
  const completedCount = queueItems.filter((item) => item.status === "done" || item.status === "failed").length;
  const completionRate = queueItems.length > 0 ? Math.round((completedCount / queueItems.length) * 100) : 0;

  const okItems = (props.last?.items ?? []).filter(
    (item): item is Extract<DailyStockRunResult["items"][number], { ok: true }> => item.ok,
  );
  const primaryItem = okItems[0] ?? null;
  const parsedPrimary = primaryItem ? parseDecisionMarkdown(primaryItem.markdown) : null;

  const intelItems = parsedPrimary?.news?.length
    ? parsedPrimary.news.slice(0, 5)
    : extractNewsFromMarkdown(props.last?.reportMarkdown ?? "", 5);

  const insightText = parsedPrimary?.conclusion || text.noSavedRun;
  const trendText =
    parsedPrimary?.advice === "buy"
      ? text.adviceBuy
      : parsedPrimary?.advice === "sell"
        ? text.adviceSell
        : text.adviceWatch;

  const checklistSlice = parsedPrimary?.checklist.slice(0, 4) ?? [];

  return html`
    <section class="stocks-redesign finance-page">
      <div class="stocks-redesign-grid">
        <aside class="stocks-sidebar">
          <section class="card stocks-queue-card">
            <div class="stocks-queue-head">
              <div>
                <div class="card-title">${text.queueTitle}</div>
              </div>
              <div class="pill"><span class="mono">${completionRate}%</span><span class="muted">${text.completion}</span></div>
            </div>

            <div class="stocks-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${completionRate}>
              <div class="stocks-progress-fill" style=${`width:${completionRate}%;`}></div>
            </div>
            ${queueItems.length === 0
      ? html`<div class="muted stocks-empty">${text.queueEmpty}</div>`
      : html`
                  <div class="stocks-queue-list">
                    ${queueItems.slice(0, 10).map(
        (item) => html`
                        <div class="stocks-queue-item stocks-queue-item--${item.status}">
                          <span class="stocks-queue-dot" aria-hidden="true"></span>
                          <span class="mono stocks-queue-symbol">${normalizeSymbolDisplay(item.symbol)}</span>
                          <span class="stocks-queue-status">${item.label}</span>
                        </div>
                      `,
      )}
                  </div>
                `}
          </section>

          <section class="card stocks-history-card">
            <div class="stocks-history-head muted">
              <span class="stocks-history-icon"></span> ${text.historyTitle}
            </div>
            ${(props.last?.symbols?.length ?? 0) === 0
      ? html`<div class="muted stocks-empty">${text.historyEmpty}</div>`
      : html`
                  <div class="stocks-history-list">
                    ${(props.last?.symbols ?? []).slice(0, 8).map((symbol) => {
        // Mock score calculation for visual representation
        const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const mockScore = 20 + (hash % 60);
        const scoreClass = mockScore > 60 ? 'high' : mockScore > 40 ? 'mid' : 'low';
        return html`
                        <div class="stocks-history-item mono">
                          <div class="stocks-history-item-left">
                            <div class="stocks-history-item-name">${normalizeSymbolDisplay(symbol)}</div>
                            <div class="stocks-history-item-meta">${symbol} · ${props.last?.dateIso ?? "-"}</div>
                          </div>
                          <div class="stocks-history-item-score ${scoreClass}">${mockScore}</div>
                        </div>
                      `;
      })}
                  </div>
                `}
          </section>

          ${renderControls(props, text)}
          
          <section class="card stocks-watchlist-card">
            <div class="row stocks-card-head">
              <div>
                <div class="card-title">${text.watchlistTitle}</div>
              </div>
              <div class="pill"><span class="mono">${watchlist.length}</span><span class="muted">${text.symbols}</span></div>
            </div>

            <div class="callout ${qualityTone} stocks-quality-callout">${qualityMessage}</div>
            <label class="field stocks-watchlist-field">
              <textarea
                rows="6"
                .value=${props.watchlistText}
                placeholder="AAPL\nNVDA\n600519\nhk00700"
                @input=${(event: Event) => props.onWatchlistTextChange((event.target as HTMLTextAreaElement).value)}
              ></textarea>
            </label>
            <div class="row stocks-watchlist-tools">
              <button class="btn" ?disabled=${props.loading || cleanedWatchlist.length === 0} @click=${() => props.onWatchlistTextChange(cleanedWatchlist.join("\n"))}>Clean</button>
              <button class="btn" ?disabled=${props.loading || dedupedWatchlist.length === watchlist.length} @click=${() => props.onWatchlistTextChange(dedupedWatchlist.join("\n"))}>Dedupe</button>
            </div>
            <div class="row stocks-actions stocks-watchlist-persist">
              <button class="btn primary finance-cta" ?disabled=${props.loading} @click=${props.onSaveWatchlist}>${text.save}</button>
            </div>
          </section>

          ${props.error ? html`<div class="callout danger stocks-callout">${props.error}</div>` : nothing}
        </aside>

        <main class="stocks-main-content">
          <form
            class="stocks-command-bar stocks-image-command-bar"
            @submit=${(event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const rawSymbol = String(data.get("symbol") ?? "").trim();
      if (rawSymbol) {
        const normalized = normalizeSymbolDisplay(rawSymbol);
        const next = [...watchlist];
        const exists = next.some((symbol) => symbolCanonicalKey(symbol) === symbolCanonicalKey(normalized));
        if (!exists) {
          next.unshift(normalized);
          props.onWatchlistTextChange(next.join("\n"));
        }
        const input = form.elements.namedItem("symbol") as HTMLInputElement | null;
        if (input) input.value = "";
      }
      props.onRun();
    }}
          >
            <input name="symbol" placeholder="输入股票代码，如 600519、00700、AAPL" />
            <button class="btn primary finance-cta stocks-image-analyze-btn" type="submit" ?disabled=${props.running}>
              ${props.running ? text.running : "分析"}
            </button>
          </form>

          <div class="stocks-main-top-row stocks-image-top-row">
            <section class="card stocks-focus-card">
              <div class="stocks-focus-head stocks-image-focus-head">
                <div>
                  <div class="stocks-image-focus-title">
                    <span class="stocks-image-symbol-name">${parsedPrimary?.symbol ?? watchlist[0] ?? "-"}</span>
                    <span class="stocks-image-price">${parsedPrimary?.price ?? "-"}</span>
                  </div>
                  <div class="stocks-image-focus-meta mono">
                    <span class="stocks-image-ticker">${parsedPrimary?.symbol ?? "-"}</span>
                    <span class="stocks-image-date">${parsedPrimary?.asOfIso ?? props.last?.dateIso ?? "-"}</span>
                  </div>
                </div>
              </div>

              <div class="stocks-focus-body">
                <div class="stocks-image-focus-label">KEY INSIGHTS</div>
                <p>${insightText}</p>
                ${checklistSlice.length > 0
      ? html`
                      <div class="stocks-checklist-grid">
                        ${checklistSlice.map((check) => html`<div class="stocks-check-item">${check}</div>`)}
                      </div>
                    `
      : nothing}
              </div>

              <div class="stocks-image-actions-grid">
                <div class="stocks-image-action-box">
                  <div class="stocks-image-action-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  </div>
                  <div class="stocks-image-action-content">
                    <div class="stocks-image-action-label">${text.operationAdvice}</div>
                    <div class="stocks-image-action-value">${parsedPrimary?.adviceRaw ?? text.adviceWatch}</div>
                  </div>
                </div>
                <div class="stocks-image-action-box stocks-image-action-box--gold">
                  <div class="stocks-image-action-icon stocks-image-action-icon--gold">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  </div>
                  <div class="stocks-image-action-content">
                    <div class="stocks-image-action-label">${text.trendOutlook}</div>
                    <div class="stocks-image-action-value stocks-image-action-value--gold">${trendText}</div>
                  </div>
                </div>
              </div>
            </section>

            <section class="card stocks-sentiment-card stocks-image-sentiment-card">
              <div class="card-title">Market Sentiment</div>
              <div class="card-sub">恐慌贪婪指数</div>
              <div class="stocks-sentiment-ring" style=${`--stocks-score:${sentiment.score};`}>
                <div class="stocks-sentiment-core">
                  <div class="stocks-sentiment-score mono">${sentiment.score}</div>
                  <div class="stocks-sentiment-label">${sentiment.label}</div>
                </div>
              </div>
            </section>
          </div>

          <section class="card stocks-level-card stocks-image-level-card">
            <div class="stocks-level-card-header">
              <span class="card-title">STRATEGY POINTS</span>
              <span class="card-title-zh">狙击点位</span>
            </div>
            <div class="stocks-level-grid stocks-image-level-grid">
              <div class="stocks-level-item stocks-level-item--ideal">
                <div class="stocks-level-label">理想买入</div>
                <div class="stocks-level-value mono">${parsedPrimary?.entry ?? "n/a"}</div>
              </div>
              <div class="stocks-level-item stocks-level-item--second">
                <div class="stocks-level-label">二次买入</div>
                <div class="stocks-level-value mono">${parsedPrimary?.target2 ?? "n/a"}</div>
              </div>
              <div class="stocks-level-item stocks-level-item--stop">
                <div class="stocks-level-label">止损价位</div>
                <div class="stocks-level-value mono">${parsedPrimary?.stop ?? "n/a"}</div>
              </div>
              <div class="stocks-level-item stocks-level-item--target">
                <div class="stocks-level-label">止盈目标</div>
                <div class="stocks-level-value mono">${parsedPrimary?.target1 ?? "n/a"}</div>
              </div>
            </div>
          </section>

          <section class="card stocks-intel-card stocks-image-intel-card">
            <div class="stocks-intel-head">
              <div>
                <span class="card-title">NEWS FEED</span>
                <span class="card-title-zh">相关资讯</span>
              </div>
              <button class="btn stocks-intel-refresh" ?disabled=${props.running} @click=${props.onRun}>刷新</button>
            </div>
            ${intelItems.length === 0
      ? html`<div class="muted stocks-empty">${text.noNews}</div>`
      : html`
                  <div class="stocks-intel-list">
                    ${intelItems.map(
        (item) => html`
                        <div class="stocks-intel-item">
                          <div class="stocks-intel-title">${item.title}</div>
                          ${item.link
            ? html`
                                <a class="stocks-intel-link" href=${item.link} target="_blank" rel="noreferrer">
                                  跳转 ↗
                                </a>
                              `
            : nothing}
                        </div>
                      `,
      )}
                  </div>
                `}
          </section>

          <section class="card report-pane stocks-report-pane">
            <div class="report-pane__header">
              <div>
                <div class="card-title">${text.reportTitle}</div>
                <div class="card-sub">${text.reportSub}</div>
              </div>
            </div>
            <div class="report-pane__body">
              ${props.last?.reportMarkdown
      ? html`<div class="sidebar-markdown report-pane__markdown">${unsafeHTML(toSanitizedMarkdownHtml(props.last.reportMarkdown))}</div>`
      : html`<div class="muted">${text.noReport}</div>`}
            </div>
          </section>
        </main>
      </div>
    </section>
  `;
}

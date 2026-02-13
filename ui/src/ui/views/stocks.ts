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
    watchlistTitle: "Watchlist",
    watchlistSub:
      "One symbol per line. Supports US tickers, A-share (600519), HK (hk00700).",
    symbols: "symbols",
    refreshing: "Refreshing…",
    refresh: "Refresh",
    save: "Save",
    dailyRunTitle: "Daily Run",
    dailyRunSub: "Rule-based decision dashboards and a research-style note for your watchlist.",
    noSavedRun: "No saved run yet. Click Run to generate today's report.",
    date: "Date",
    timeframe: "Timeframe",
    bws: "BUY/WATCH/SELL",
    failed: "Failed",
    reportType: "Report Type",
    fundamentals: "Fundamentals",
    newsLimit: "News Limit",
    locale: "Locale",
    running: "Running…",
    runNow: "Run Now",
    reportTitle: "Report",
    reportSub: "Latest Daily Stock markdown. Designed to read like a compact research note.",
    run: "Run",
    noReport: "No report available yet.",
    simple: "simple (push-friendly)",
    full: "full (research)",
    workbenchTitle: "Connect Once Workbench",
    workbenchSub:
      "OpenBB-style unified data surface: configure once, then run a single cross-source workflow.",
    sourcePrice: "Price",
    sourceFundamentals: "Fundamentals",
    sourceNews: "News",
    sourceMarket: "Market Context",
    sourceReady: "ready",
    sourceStandby: "standby",
    symbolsSelected: "Symbols",
    reportMode: "Mode",
    localeLabel: "Locale",
    unifiedQuery: "Unified Query Preview",
    workbenchHint:
      "This profile keeps symbols, timeframe, fundamentals, and news under one command path.",
    presets: "Presets",
    presetGlobal: "Global Snapshot",
    presetDeep: "Equity Deep Dive",
    presetNews: "News Pulse",
    toggleSources: "Data Source Toggles",
    toggleFundamentals: "Fundamentals",
    toggleNews: "News Feed",
  },
  zh: {
    watchlistTitle: "观察列表",
    watchlistSub: "每行一个标的。支持美股代码、A 股（600519）、港股（hk00700）。",
    symbols: "个标的",
    refreshing: "刷新中…",
    refresh: "刷新",
    save: "保存",
    dailyRunTitle: "每日运行",
    dailyRunSub: "为观察列表生成规则化决策面板与研究风格摘要。",
    noSavedRun: "暂无已保存运行，点击运行以生成今日报告。",
    date: "日期",
    timeframe: "时间范围",
    bws: "买入/观察/卖出",
    failed: "失败",
    reportType: "报告类型",
    fundamentals: "基本面",
    newsLimit: "新闻数量",
    locale: "区域",
    running: "运行中…",
    runNow: "立即运行",
    reportTitle: "报告",
    reportSub: "最新每日股票 Markdown，按紧凑研究笔记方式呈现。",
    run: "运行",
    noReport: "暂无可用报告。",
    simple: "simple（适合推送）",
    full: "full（研究版）",
    workbenchTitle: "Connect Once 工作台",
    workbenchSub: "参考 OpenBB 的统一数据面板：一次配置，单次运行跨源工作流。",
    sourcePrice: "行情",
    sourceFundamentals: "基本面",
    sourceNews: "新闻",
    sourceMarket: "市场上下文",
    sourceReady: "就绪",
    sourceStandby: "待机",
    symbolsSelected: "标的数",
    reportMode: "模式",
    localeLabel: "区域",
    unifiedQuery: "统一查询预览",
    workbenchHint: "该配置把标的、周期、基本面与新闻统一到同一执行路径。",
    presets: "预设",
    presetGlobal: "全球快照",
    presetDeep: "股票深度",
    presetNews: "新闻脉冲",
    toggleSources: "数据源开关",
    toggleFundamentals: "基本面",
    toggleNews: "新闻流",
  },
} as const;

function renderSummary(last: DailyStockRunResult | null, text: (typeof STOCKS_TEXT)["en"]) {
  if (!last) return html`<div class="muted">${text.noSavedRun}</div>`;
  return html`
    <div class="stat-grid stocks-summary-grid">
      <div class="stat">
        <div class="stat-label">${text.date}</div>
        <div class="stat-value mono">${last.dateIso}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${text.timeframe}</div>
        <div class="stat-value mono">${last.timeframe}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${text.bws}</div>
        <div class="stat-value mono">${last.counts.buy}/${last.counts.watch}/${last.counts.sell}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${text.failed}</div>
        <div class="stat-value mono">${last.counts.failed}</div>
      </div>
    </div>
  `;
}

function normalizeSymbolsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderWorkbench(
  props: StocksProps,
  text: (typeof STOCKS_TEXT)["en"],
  watchlist: string[],
) {
  const newsLimit = Number.parseInt(props.newsLimit.trim() || "0", 10);
  const hasNews = Number.isFinite(newsLimit) && newsLimit > 0;
  const queryPreview = [
    "finance.daily.run",
    `symbols=[${watchlist.slice(0, 8).join(", ")}${watchlist.length > 8 ? ", ..." : ""}]`,
    `timeframe=${props.timeframe}`,
    `reportType=${props.reportType}`,
    `includeFundamentals=${props.includeFundamentals ? "true" : "false"}`,
    `newsLimit=${Number.isFinite(newsLimit) ? newsLimit : 0}`,
    `locale=${props.locale || "US"}`,
    "profile=marketbot",
  ].join("\n");

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
    <section class="card stocks-workbench">
      <div class="card-title">${text.workbenchTitle}</div>
      <div class="card-sub">${text.workbenchSub}</div>

      <div class="field stocks-field-group">
        <span>${text.presets}</span>
        <div class="row stocks-row-wrap stocks-row-tight">
          <button class="btn" type="button" @click=${() => applyPreset("global")}>
            ${text.presetGlobal}
          </button>
          <button class="btn" type="button" @click=${() => applyPreset("deep")}>
            ${text.presetDeep}
          </button>
          <button class="btn" type="button" @click=${() => applyPreset("news")}>
            ${text.presetNews}
          </button>
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

      <div class="chip-row stocks-source-chips">
        <span class="chip">${text.sourcePrice}: ${text.sourceReady}</span>
        <span class="chip">${text.sourceFundamentals}: ${props.includeFundamentals ? text.sourceReady : text.sourceStandby}</span>
        <span class="chip">${text.sourceNews}: ${hasNews ? text.sourceReady : text.sourceStandby}</span>
        <span class="chip">${text.sourceMarket}: ${text.sourceReady}</span>
      </div>

      <div class="stat-grid stocks-summary-grid">
        <div class="stat">
          <div class="stat-label">${text.symbolsSelected}</div>
          <div class="stat-value mono">${watchlist.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.timeframe}</div>
          <div class="stat-value mono">${props.timeframe}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.reportMode}</div>
          <div class="stat-value mono">${props.reportType}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.localeLabel}</div>
          <div class="stat-value mono">${props.locale || "US"}</div>
        </div>
      </div>

      <div class="field stocks-field-group">
        <span>${text.unifiedQuery}</span>
        <pre class="code-block stocks-query-code">${queryPreview}</pre>
      </div>

      <div class="row stocks-run-bar">
        <span class="muted stocks-run-hint">${text.workbenchHint}</span>
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
  const watchlist = normalizeSymbolsFromText(props.watchlistText);
  const lastMarkdown = props.last?.reportMarkdown ?? "";
  return html`
    <section class="stocks-layout finance-page">
      <div class="stocks-left">
        <div class="card stocks-card">
          <div class="row stocks-card-head">
            <div>
              <div class="card-title">${text.watchlistTitle}</div>
              <div class="card-sub">${text.watchlistSub}</div>
            </div>
            <div class="pill"><span class="mono">${watchlist.length}</span><span class="muted">${text.symbols}</span></div>
          </div>
          <label class="field stocks-watchlist-field">
            <textarea
              rows="10"
              .value=${props.watchlistText}
              placeholder="AAPL\nNVDA\n600519\nhk00700"
              @input=${(e: Event) => props.onWatchlistTextChange((e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
          <div class="row stocks-actions">
            <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
              ${props.loading ? text.refreshing : text.refresh}
            </button>
            <button class="btn primary finance-cta" ?disabled=${props.loading} @click=${props.onSaveWatchlist}>
              ${text.save}
            </button>
          </div>
          ${props.error ? html`<div class="callout danger stocks-callout">${props.error}</div>` : nothing}
        </div>

        <div class="card stocks-card">
          <div class="card-title">${text.dailyRunTitle}</div>
          <div class="card-sub">${text.dailyRunSub}</div>
          ${renderSummary(props.last, text)}
          <div class="form-grid stocks-options-grid">
            <label class="field">
              <span>${text.timeframe}</span>
              <select .value=${props.timeframe} @change=${(e: Event) => props.onTimeframeChange((e.target as HTMLSelectElement).value)}>
                <option value="6mo">6mo</option>
                <option value="1y">1y</option>
                <option value="ytd">ytd</option>
                <option value="max">max</option>
              </select>
            </label>
            <label class="field">
              <span>${text.reportType}</span>
              <select
                .value=${props.reportType}
                @change=${(e: Event) => {
                  const value = (e.target as HTMLSelectElement).value;
                  props.onReportTypeChange(value === "full" ? "full" : "simple");
                }}
              >
                <option value="simple">${text.simple}</option>
                <option value="full">${text.full}</option>
              </select>
            </label>
            <div class="field field--toggle">
              <span>${text.fundamentals}</span>
              <label class="toggle">
                <input
                  type="checkbox"
                  .checked=${props.includeFundamentals}
                  @change=${(e: Event) => props.onIncludeFundamentalsChange((e.target as HTMLInputElement).checked)}
                />
                <span class="toggle__track" aria-hidden="true"></span>
                <span class="toggle__thumb" aria-hidden="true"></span>
              </label>
            </div>
            <label class="field">
              <span>${text.newsLimit}</span>
              <input
                .value=${props.newsLimit}
                @input=${(e: Event) => props.onNewsLimitChange((e.target as HTMLInputElement).value)}
                placeholder="2"
              />
            </label>
            <label class="field">
              <span>${text.locale}</span>
              <input
                .value=${props.locale}
                @input=${(e: Event) => props.onLocaleChange((e.target as HTMLInputElement).value)}
                placeholder="US"
              />
            </label>
          </div>
          <div class="row stocks-actions">
            <button class="btn primary finance-cta" ?disabled=${props.running} @click=${props.onRun}>
              ${props.running ? text.running : text.runNow}
            </button>
          </div>
        </div>
      </div>

      <div class="stocks-right">
        ${renderWorkbench(props, text, watchlist)}

        <section class="card report-pane stocks-report-pane">
          <div class="report-pane__header">
            <div>
              <div class="card-title">${text.reportTitle}</div>
              <div class="card-sub">${text.reportSub}</div>
            </div>
            <div class="row">
              <button class="btn" ?disabled=${props.running} @click=${props.onRun}>
                ${props.running ? text.running : text.run}
              </button>
            </div>
          </div>
          <div class="report-pane__body">
            ${lastMarkdown
              ? html`<div class="sidebar-markdown report-pane__markdown">${unsafeHTML(toSanitizedMarkdownHtml(lastMarkdown))}</div>`
              : html`<div class="muted">${text.noReport}</div>`}
          </div>
        </section>
      </div>
    </section>
  `;
}

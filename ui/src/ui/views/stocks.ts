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
  },
} as const;

function renderSummary(last: DailyStockRunResult | null, text: (typeof STOCKS_TEXT)["en"]) {
  if (!last) return html`<div class="muted">${text.noSavedRun}</div>`;
  return html`
    <div class="stat-grid" style="margin-top: 12px;">
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

export function renderStocks(props: StocksProps) {
  const language = props.language ?? "en";
  const text = STOCKS_TEXT[language] ?? STOCKS_TEXT.en;
  const watchlist = normalizeSymbolsFromText(props.watchlistText);
  const lastMarkdown = props.last?.reportMarkdown ?? "";
  return html`
    <section class="stocks-layout">
      <div class="stocks-left">
        <div class="card">
          <div class="row" style="justify-content: space-between;">
            <div>
              <div class="card-title">${text.watchlistTitle}</div>
              <div class="card-sub">${text.watchlistSub}</div>
            </div>
            <div class="pill"><span class="mono">${watchlist.length}</span><span class="muted">${text.symbols}</span></div>
          </div>
          <label class="field" style="margin-top: 12px;">
            <textarea
              rows="10"
              .value=${props.watchlistText}
              placeholder="AAPL\nNVDA\n600519\nhk00700"
              @input=${(e: Event) => props.onWatchlistTextChange((e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
          <div class="row" style="margin-top: 12px;">
            <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
              ${props.loading ? text.refreshing : text.refresh}
            </button>
            <button class="btn primary" ?disabled=${props.loading} @click=${props.onSaveWatchlist}>
              ${text.save}
            </button>
          </div>
          ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}
        </div>

        <div class="card">
          <div class="card-title">${text.dailyRunTitle}</div>
          <div class="card-sub">${text.dailyRunSub}</div>
          ${renderSummary(props.last, text)}
          <div class="form-grid" style="margin-top: 16px;">
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
                @change=${(e: Event) => props.onReportTypeChange(((e.target as HTMLSelectElement).value as any) === "full" ? "full" : "simple")}
              >
                <option value="simple">${text.simple}</option>
                <option value="full">${text.full}</option>
              </select>
            </label>
            <label class="field field--toggle">
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
            </label>
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
          <div class="row" style="margin-top: 12px;">
            <button class="btn primary" ?disabled=${props.running} @click=${props.onRun}>
              ${props.running ? text.running : text.runNow}
            </button>
          </div>
        </div>
      </div>

      <div class="stocks-right">
        <section class="card report-pane">
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
              ? html`<div class="sidebar-markdown" style="max-width: 100%;">${unsafeHTML(toSanitizedMarkdownHtml(lastMarkdown))}</div>`
              : html`<div class="muted">${text.noReport}</div>`}
          </div>
        </section>
      </div>
    </section>
  `;
}

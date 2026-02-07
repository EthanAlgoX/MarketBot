import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { toSanitizedMarkdownHtml } from "../markdown";
import type { DailyStockRunResult } from "../types";

export type StocksProps = {
  loading: boolean;
  running: boolean;
  error: string | null;
  watchlistText: string;
  timeframe: string;
  reportType: "simple" | "full";
  newsLimit: string;
  locale: string;
  last: DailyStockRunResult | null;
  onWatchlistTextChange: (next: string) => void;
  onTimeframeChange: (next: string) => void;
  onReportTypeChange: (next: "simple" | "full") => void;
  onNewsLimitChange: (next: string) => void;
  onLocaleChange: (next: string) => void;
  onRefresh: () => void;
  onSaveWatchlist: () => void;
  onRun: () => void;
};

function renderSummary(last: DailyStockRunResult | null) {
  if (!last) return html`<div class="muted">No saved run yet. Click Run to generate today's report.</div>`;
  return html`
    <div class="stat-grid" style="margin-top: 12px;">
      <div class="stat">
        <div class="stat-label">Date</div>
        <div class="stat-value mono">${last.dateIso}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Timeframe</div>
        <div class="stat-value mono">${last.timeframe}</div>
      </div>
      <div class="stat">
        <div class="stat-label">BUY/WATCH/SELL</div>
        <div class="stat-value mono">${last.counts.buy}/${last.counts.watch}/${last.counts.sell}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Failed</div>
        <div class="stat-value mono">${last.counts.failed}</div>
      </div>
    </div>
  `;
}

export function renderStocks(props: StocksProps) {
  const lastMarkdown = props.last?.reportMarkdown ?? "";
  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Watchlist</div>
        <div class="card-sub">One symbol per line. Supports US tickers, A-share (600519), HK (hk00700).</div>
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
            ${props.loading ? "Refreshing…" : "Refresh"}
          </button>
          <button class="btn primary" ?disabled=${props.loading} @click=${props.onSaveWatchlist}>
            Save Watchlist
          </button>
        </div>
        ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}
      </div>

      <div class="card">
        <div class="card-title">Daily Run</div>
        <div class="card-sub">Rule-based decision dashboards and a research-style summary.</div>
        ${renderSummary(props.last)}
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Timeframe</span>
            <select .value=${props.timeframe} @change=${(e: Event) => props.onTimeframeChange((e.target as HTMLSelectElement).value)}>
              <option value="6mo">6mo</option>
              <option value="1y">1y</option>
              <option value="ytd">ytd</option>
              <option value="max">max</option>
            </select>
          </label>
          <label class="field">
            <span>Report Type</span>
            <select
              .value=${props.reportType}
              @change=${(e: Event) => props.onReportTypeChange(((e.target as HTMLSelectElement).value as any) === "full" ? "full" : "simple")}
            >
              <option value="simple">simple (push-friendly)</option>
              <option value="full">full (research)</option>
            </select>
          </label>
          <label class="field">
            <span>News Limit</span>
            <input
              .value=${props.newsLimit}
              @input=${(e: Event) => props.onNewsLimitChange((e.target as HTMLInputElement).value)}
              placeholder="2"
            />
          </label>
          <label class="field">
            <span>Locale</span>
            <input
              .value=${props.locale}
              @input=${(e: Event) => props.onLocaleChange((e.target as HTMLInputElement).value)}
              placeholder="US"
            />
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn primary" ?disabled=${props.running} @click=${props.onRun}>
            ${props.running ? "Running…" : "Run Now"}
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 16px;">
      <div class="card-title">Report</div>
      <div class="card-sub">Latest Daily Stock report markdown.</div>
      ${lastMarkdown
        ? html`<div class="sidebar-markdown" style="max-width: 100%;">${unsafeHTML(toSanitizedMarkdownHtml(lastMarkdown))}</div>`
        : html`<div class="muted">No report available yet.</div>`}
    </section>
  `;
}


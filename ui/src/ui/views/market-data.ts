import { html, nothing } from "lit";

import type { UiLanguage } from "../storage";
import type { MarketDataSnapshot, MarketDataSnapshotItem, MarketDataStatus } from "../types";

export type MarketDataProps = {
  language?: UiLanguage;
  loading: boolean;
  error: string | null;
  symbolsText: string;
  timeframe: string;
  newsLimit: string;
  activeSymbol: string;
  status: MarketDataStatus | null;
  snapshot: MarketDataSnapshot | null;
  onSymbolsTextChange: (next: string) => void;
  onTimeframeChange: (next: string) => void;
  onNewsLimitChange: (next: string) => void;
  onActiveSymbolChange: (next: string) => void;
  onApplyMag7: () => void;
  onRefreshStatus: () => void;
  onRun: () => void;
};

const TEXT = {
  en: {
    symbols: "Symbols",
    symbolsHint: "One symbol per line. Empty means Magnificent Seven preset.",
    timeframe: "Timeframe",
    newsLimit: "News Limit",
    activeSymbol: "Active Symbol",
    useMag7: "Use Magnificent Seven",
    refreshStatus: "Refresh Status",
    running: "Loading…",
    run: "Load Data",
    statusTitle: "Data Engine Status",
    notLoaded: "No data loaded yet.",
    summaryTitle: "Snapshot",
    chartTitle: "Price Trend",
    newsTitle: "Related News",
    fundamentalsTitle: "Fundamentals",
    symbol: "Symbol",
    price: "Price",
    change: "Change",
    source: "Source",
    marketCap: "Market Cap",
    pe: "Trailing PE",
    fwdPe: "Forward PE",
    beta: "Beta",
    target: "Target Price",
    dividendYield: "Dividend Yield",
    noNews: "No news returned.",
  },
  zh: {
    symbols: "股票列表",
    symbolsHint: "每行一个代码。留空将自动使用美股七姐妹。",
    timeframe: "时间范围",
    newsLimit: "新闻条数",
    activeSymbol: "当前标的",
    useMag7: "使用七姐妹预设",
    refreshStatus: "刷新状态",
    running: "加载中…",
    run: "加载数据",
    statusTitle: "数据引擎状态",
    notLoaded: "还没有加载数据。",
    summaryTitle: "行情快照",
    chartTitle: "价格走势",
    newsTitle: "相关新闻",
    fundamentalsTitle: "基本面",
    symbol: "代码",
    price: "价格",
    change: "涨跌幅",
    source: "来源",
    marketCap: "市值",
    pe: "市盈率(TTM)",
    fwdPe: "前瞻市盈率",
    beta: "Beta",
    target: "目标价",
    dividendYield: "股息率",
    noNews: "没有返回新闻。",
  },
} as const;

function normalizeSymbolsFromText(text: string): string[] {
  const lines = text
    .split(/[\n,]+/)
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    deduped.push(line);
  }
  return deduped;
}

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatCompact(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function toLineChartPath(points: Array<{ close: number }>, width: number, height: number) {
  if (points.length < 2) {
    return null;
  }
  const padding = 14;
  const values = points.map((point) => point.close).filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    return null;
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const xSpan = width - padding * 2;
  const ySpan = height - padding * 2;
  const coords = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * xSpan;
    const y = padding + ((max - point.close) / (max - min)) * ySpan;
    return { x, y };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const first = coords[0];
  const last = coords.at(-1)!;
  const area = `${line} L${last.x.toFixed(2)} ${(height - padding).toFixed(2)} L${first.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;
  return { line, area, min, max };
}

function renderStatus(status: MarketDataStatus | null) {
  const openbb = status?.engine?.openbb;
  const connected = openbb?.connected === true;
  const enabled = openbb?.enabled === true;
  const configured = openbb?.configured === true;
  return html`
    <div class="stat-grid market-data-status-grid">
      <div class="stat">
        <div class="stat-label">Connector</div>
        <div class="stat-value mono">${connected ? "connected" : "disconnected"}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Enabled</div>
        <div class="stat-value mono">${enabled ? "true" : "false"}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Configured</div>
        <div class="stat-value mono">${configured ? "true" : "false"}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Provider</div>
        <div class="stat-value mono">${openbb?.provider ?? "-"}</div>
      </div>
    </div>
    <div class="chip-row market-data-status-chips">
      <span class="chip mono">${openbb?.baseUrl ?? "baseUrl not set"}</span>
      ${openbb?.error ? html`<span class="chip">${openbb.error}</span>` : nothing}
    </div>
  `;
}

function renderChart(item: MarketDataSnapshotItem | null, text: (typeof TEXT)["en"]) {
  if (!item || item.points.length < 2) {
    return html`<div class="muted">${text.notLoaded}</div>`;
  }
  const width = 760;
  const height = 260;
  const chart = toLineChartPath(item.points, width, height);
  if (!chart) {
    return html`<div class="muted">${text.notLoaded}</div>`;
  }
  return html`
    <div class="market-data-chart-meta">
      <span class="chip mono">${item.symbol}</span>
      <span class="chip mono">${formatPrice(item.price)}</span>
      <span class="chip mono">${formatPercent(item.changePercent)}</span>
      <span class="chip mono">${item.marketTimeIso ?? "-"}</span>
    </div>
    <div class="market-data-chart-wrap">
      <svg class="market-data-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="market-data-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(56,197,255,0.40)"></stop>
            <stop offset="100%" stop-color="rgba(56,197,255,0.02)"></stop>
          </linearGradient>
        </defs>
        <path d=${chart.area} fill="url(#market-data-area)"></path>
        <path d=${chart.line} fill="none" stroke="rgba(56,197,255,0.95)" stroke-width="2.4"></path>
      </svg>
      <div class="market-data-chart-legend muted">
        <span>max ${formatPrice(chart.max)}</span>
        <span>min ${formatPrice(chart.min)}</span>
      </div>
    </div>
  `;
}

export function renderMarketData(props: MarketDataProps) {
  const language = props.language ?? "en";
  const text = TEXT[language] ?? TEXT.en;
  const parsedSymbols = normalizeSymbolsFromText(props.symbolsText);
  const activeSymbol = props.activeSymbol.trim().toUpperCase();
  const snapshot = props.snapshot;
  const activeItem =
    snapshot?.items.find((item) => item.symbol === (snapshot.activeSymbol || activeSymbol)) ?? null;

  return html`
    <section class="market-data-layout finance-page">
      <div class="market-data-left">
        <section class="card market-data-card market-data-card--highlight">
          <div class="card-title">${text.symbols}</div>
          <div class="card-sub">${text.symbolsHint}</div>
          <label class="field market-data-field">
            <textarea
              rows="9"
              .value=${props.symbolsText}
              placeholder="AAPL\nMSFT\nNVDA\nAMZN\nGOOGL\nMETA\nTSLA"
              @input=${(event: Event) =>
                props.onSymbolsTextChange((event.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
          <div class="form-grid market-data-options-grid">
            <label class="field">
              <span>${text.timeframe}</span>
              <select
                .value=${props.timeframe}
                @change=${(event: Event) =>
                  props.onTimeframeChange((event.target as HTMLSelectElement).value)}
              >
                <option value="1mo">1mo</option>
                <option value="3mo">3mo</option>
                <option value="6mo">6mo</option>
                <option value="1y">1y</option>
                <option value="ytd">ytd</option>
                <option value="max">max</option>
              </select>
            </label>
            <label class="field">
              <span>${text.newsLimit}</span>
              <input
                .value=${props.newsLimit}
                @input=${(event: Event) =>
                  props.onNewsLimitChange((event.target as HTMLInputElement).value)}
                placeholder="5"
              />
            </label>
            <label class="field">
              <span>${text.activeSymbol}</span>
              <input
                .value=${props.activeSymbol}
                list="market-data-symbol-options"
                @input=${(event: Event) =>
                  props.onActiveSymbolChange((event.target as HTMLInputElement).value)}
                placeholder="AAPL"
              />
            </label>
            <datalist id="market-data-symbol-options">
              ${(snapshot?.symbols ?? parsedSymbols).map(
                (symbol) => html`<option value=${symbol}></option>`,
              )}
            </datalist>
          </div>
          <div class="row stocks-actions">
            <button class="btn" ?disabled=${props.loading} @click=${props.onApplyMag7}>
              ${text.useMag7}
            </button>
            <button class="btn" ?disabled=${props.loading} @click=${props.onRefreshStatus}>
              ${text.refreshStatus}
            </button>
            <button class="btn primary finance-cta" ?disabled=${props.loading} @click=${props.onRun}>
              ${props.loading ? text.running : text.run}
            </button>
          </div>
          ${props.error ? html`<div class="callout danger stocks-callout">${props.error}</div>` : nothing}
        </section>

        <section class="card market-data-card">
          <div class="card-title">${text.statusTitle}</div>
          ${renderStatus(props.status)}
        </section>
      </div>

      <div class="market-data-right">
        <section class="card market-data-card">
          <div class="card-title">${text.summaryTitle}</div>
          ${(snapshot?.warnings?.length ?? 0) > 0
            ? html`<div class="callout warn stocks-callout">${snapshot?.warnings?.join(" | ")}</div>`
            : nothing}
          ${!snapshot
            ? html`<div class="muted">${text.notLoaded}</div>`
            : html`
                <div class="market-data-summary-table">
                  <div class="market-data-summary-row market-data-summary-row--head">
                    <span>${text.symbol}</span>
                    <span>${text.price}</span>
                    <span>${text.change}</span>
                    <span>${text.source}</span>
                  </div>
                  ${snapshot.items.map(
                    (item) => html`
                      <button
                        class="market-data-summary-row ${snapshot.activeSymbol === item.symbol ? "active" : ""}"
                        @click=${() => props.onActiveSymbolChange(item.symbol)}
                      >
                        <span class="mono">${item.symbol}</span>
                        <span class="mono">${formatPrice(item.price)}</span>
                        <span class=${`mono ${typeof item.changePercent === "number" && item.changePercent > 0
                          ? "market-data-up"
                          : typeof item.changePercent === "number" && item.changePercent < 0
                            ? "market-data-down"
                            : ""}`}>${formatPercent(item.changePercent)}</span>
                        <span class="mono">${item.source}</span>
                      </button>
                    `,
                  )}
                </div>
              `}
        </section>

        <section class="card market-data-card">
          <div class="card-title">${text.chartTitle}</div>
          ${renderChart(activeItem, text)}
        </section>

        <section class="card market-data-card">
          <div class="card-title">${text.newsTitle}</div>
          ${(snapshot?.news?.length ?? 0) === 0
            ? html`<div class="muted">${text.noNews}</div>`
            : html`
                <div class="market-data-news-list">
                  ${snapshot?.news?.map(
                    (news) => html`
                      <a class="market-data-news-item" href=${news.link} target="_blank" rel="noreferrer">
                        <div class="market-data-news-title">${news.title}</div>
                        <div class="muted market-data-news-meta">
                          ${(news.source ?? "-")} · ${(news.pubDate ?? "-")}
                        </div>
                      </a>
                    `,
                  )}
                </div>
              `}
        </section>

        <section class="card market-data-card">
          <div class="card-title">${text.fundamentalsTitle}</div>
          <div class="stat-grid market-data-fund-grid">
            <div class="stat">
              <div class="stat-label">${text.marketCap}</div>
              <div class="stat-value mono">${formatCompact(snapshot?.fundamentals?.marketCap)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.pe}</div>
              <div class="stat-value mono">${formatPrice(snapshot?.fundamentals?.trailingPE)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.fwdPe}</div>
              <div class="stat-value mono">${formatPrice(snapshot?.fundamentals?.forwardPE)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.beta}</div>
              <div class="stat-value mono">${formatPrice(snapshot?.fundamentals?.beta)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.target}</div>
              <div class="stat-value mono">${formatPrice(snapshot?.fundamentals?.targetMeanPrice)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.dividendYield}</div>
              <div class="stat-value mono">${formatPercent(
                typeof snapshot?.fundamentals?.dividendYield === "number"
                  ? snapshot.fundamentals.dividendYield * 100
                  : null,
              )}</div>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
}

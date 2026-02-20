import { html, nothing } from "lit";

import type { UiLanguage } from "../storage";
import type { FlowAssetClass, FlowBucket, FlowDetail, FlowDirection, FlowSnapshot } from "../types";

export type FlowRadarProps = {
  language?: UiLanguage;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  snapshot: FlowSnapshot | null;
  detail: FlowDetail | null;
  activeAssetClass: FlowAssetClass | null;
  activeSymbol: string | null;
  onRefresh: () => void;
  onSelect: (assetClass: FlowAssetClass, symbol: string) => void;
};

const TEXT = {
  en: {
    headline: "Global Liquidity Pulse",
    headlineSub: "Macro liquidity board for equities, metals, and crypto.",
    dataPipeline: "API-First Data Pipeline",
    metricsCoverage: "Metric Coverage",
    moversCoverage: "Top Movers Coverage",
    warnings: "Warnings",
    rowCount: "Rows",
    refresh: "Refresh Snapshot",
    loading: "Loading…",
    noSnapshot: "No snapshot loaded yet.",
    asOf: "As of",
    macroBoard: "Macro Liquidity Board",
    warningTitle: "Warnings",
    summary: "Liquidity Summary",
    fedSignal: "Fed Signal",
    bojSignal: "BoJ Signal",
    flowBoard: "Cross-Asset Capital Flow",
    metricBoard: "Global Flow Metrics",
    moversBoard: "Top Movers by Asset Class",
    clickHint: "Click a row to load 7-day trend and analysis.",
    details: "7-Day Trend & Analysis",
    noDetail: "Select an asset from any top-gainer table to inspect its 7-day trend.",
    detailSummary: "Position Summary",
    trend: "Trend",
    trendUp: "Up",
    trendDown: "Down",
    trendSideways: "Sideways",
    return7d: "7D Return",
    volatility: "Volatility",
    marketTime: "Market Time",
    chart: "7-Day Chart",
    relatedNews: "Related News",
    noNews: "No news returned.",
    symbol: "Symbol",
    price: "Price",
    change: "Change",
    reason: "Reason",
    inflow: "Inflow",
    outflow: "Outflow",
    neutral: "Neutral",
    riskOn: "Risk-On",
    riskOff: "Risk-Off",
    balanced: "Balanced",
  },
  zh: {
    headline: "全球流动性脉冲",
    headlineSub: "面向股票、金属、加密资产的宏观流动性驾驶舱。",
    dataPipeline: "API优先数据链路",
    metricsCoverage: "指标覆盖率",
    moversCoverage: "涨幅榜覆盖率",
    warnings: "警告",
    rowCount: "条目数",
    refresh: "刷新快照",
    loading: "加载中…",
    noSnapshot: "暂无快照数据。",
    asOf: "数据时间",
    macroBoard: "宏观流动性看板",
    warningTitle: "警告",
    summary: "流动性摘要",
    fedSignal: "美联储信号",
    bojSignal: "日本央行信号",
    flowBoard: "跨资产资金流向",
    metricBoard: "全球流动性指标",
    moversBoard: "分资产涨幅榜",
    clickHint: "点击任意标的，加载近 7 天走势与分析。",
    details: "近 7 天走势与分析",
    noDetail: "从任意涨幅榜点击标的，即可查看近 7 天走势。",
    detailSummary: "标的摘要",
    trend: "趋势",
    trendUp: "上行",
    trendDown: "下行",
    trendSideways: "震荡",
    return7d: "7日涨跌",
    volatility: "波动率",
    marketTime: "行情时间",
    chart: "7日走势图",
    relatedNews: "相关新闻",
    noNews: "暂无相关新闻。",
    symbol: "代码",
    price: "价格",
    change: "涨跌幅",
    reason: "原因",
    inflow: "流入",
    outflow: "流出",
    neutral: "中性",
    riskOn: "风险偏好",
    riskOff: "风险回避",
    balanced: "平衡",
  },
} as const;

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatDateTime(iso: string | null | undefined, language: UiLanguage): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = language === "zh" ? "zh-CN" : "en-US";
  return date.toLocaleString(locale, { hour12: false });
}

function flowTone(direction: FlowDirection): "up" | "down" | "flat" {
  if (direction === "inflow") return "up";
  if (direction === "outflow") return "down";
  return "flat";
}

function regimeTone(regime: "risk-on" | "risk-off" | "balanced"): "up" | "down" | "flat" {
  if (regime === "risk-on") return "up";
  if (regime === "risk-off") return "down";
  return "flat";
}

function flowStrength(changePercent: number | null | undefined): number {
  if (typeof changePercent !== "number" || !Number.isFinite(changePercent)) {
    return 24;
  }
  const abs = Math.min(8, Math.abs(changePercent));
  return Math.min(96, 22 + abs * 9);
}

function toLineChartPath(points: Array<{ close: number }>, width: number, height: number) {
  if (points.length < 2) return null;
  const padding = 14;
  const values = points.map((point) => point.close).filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;
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
  return { line, area };
}

function regimeLabel(language: UiLanguage, regime: "risk-on" | "risk-off" | "balanced") {
  const text = TEXT[language] ?? TEXT.en;
  if (regime === "risk-on") return text.riskOn;
  if (regime === "risk-off") return text.riskOff;
  return text.balanced;
}

function directionLabel(language: UiLanguage, direction: FlowDirection) {
  const text = TEXT[language] ?? TEXT.en;
  if (direction === "inflow") return text.inflow;
  if (direction === "outflow") return text.outflow;
  return text.neutral;
}

function trendLabel(language: UiLanguage, trend: "up" | "down" | "sideways") {
  const text = TEXT[language] ?? TEXT.en;
  if (trend === "up") return text.trendUp;
  if (trend === "down") return text.trendDown;
  return text.trendSideways;
}

function formatCoverage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function renderBucket(
  language: UiLanguage,
  bucket: FlowBucket,
  activeAssetClass: FlowAssetClass | null,
  activeSymbol: string | null,
  onSelect: (assetClass: FlowAssetClass, symbol: string) => void,
) {
  const text = TEXT[language] ?? TEXT.en;
  return html`
    <section class="card flow-radar-card flow-radar-bucket flow-radar-bucket-card">
      <div class="row flow-radar-bucket-head">
        <div class="card-title">${bucket.label}</div>
        <span class="chip mono">${bucket.items.length}</span>
      </div>
      <div class="muted flow-radar-bucket-hint">${text.clickHint}</div>
      <div class="flow-radar-table">
        <div class="flow-radar-row flow-radar-row--head">
          <span>${text.symbol}</span>
          <span>${text.price}</span>
          <span>${text.change}</span>
          <span>${text.reason}</span>
        </div>
        ${bucket.items.map((item) => {
          const selected = activeAssetClass === bucket.assetClass && activeSymbol === item.symbol;
          const directionClass =
            typeof item.changePercent === "number" && item.changePercent > 0
              ? "flow-radar-up"
              : typeof item.changePercent === "number" && item.changePercent < 0
                ? "flow-radar-down"
                : "";
          return html`
            <button
              class="flow-radar-row ${selected ? "active" : ""}"
              @click=${() => onSelect(bucket.assetClass, item.symbol)}
            >
              <span class="flow-radar-symbol-cell">
                <span class="mono flow-radar-symbol-main">${item.symbol}</span>
                <span class="flow-radar-symbol-sub" title=${item.name ?? "-"}>${item.name ?? "-"}</span>
              </span>
              <span class="mono">${formatPrice(item.price)}</span>
              <span class=${`mono ${directionClass}`}>${formatPercent(item.changePercent)}</span>
              <span class="flow-radar-reason" title=${item.reason}>${item.reason}</span>
            </button>
          `;
        })}
      </div>
    </section>
  `;
}

function renderDetailChart(detail: FlowDetail | null, language: UiLanguage) {
  const text = TEXT[language] ?? TEXT.en;
  if (!detail || detail.points.length < 2) {
    return html`<div class="muted">${text.noDetail}</div>`;
  }
  const chart = toLineChartPath(detail.points, 760, 260);
  if (!chart) {
    return html`<div class="muted">${text.noDetail}</div>`;
  }
  return html`
    <div class="flow-radar-chart-wrap">
      <svg class="flow-radar-chart" viewBox="0 0 760 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flow-radar-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(56,197,255,0.35)"></stop>
            <stop offset="100%" stop-color="rgba(56,197,255,0.02)"></stop>
          </linearGradient>
        </defs>
        <path d=${chart.area} fill="url(#flow-radar-area)"></path>
        <path d=${chart.line} fill="none" stroke="rgba(56,197,255,0.95)" stroke-width="2.4"></path>
      </svg>
    </div>
  `;
}

export function renderFlowRadar(props: FlowRadarProps) {
  const language = props.language ?? "en";
  const text = TEXT[language] ?? TEXT.en;
  const snapshot = props.snapshot;
  const detail = props.detail;
  const quality = snapshot?.dataQuality;
  const pipelineOrder =
    quality?.providerOrder?.length
      ? quality.providerOrder
      : snapshot?.providerOrder?.length
        ? snapshot.providerOrder
        : snapshot?.provider
          ? [snapshot.provider]
          : [];
  const warningCount = snapshot?.warnings?.length ?? 0;

  return html`
    <section class="flow-radar-layout flow-radar-dashboard finance-page">
      <div class="flow-radar-left">
        <section class="card flow-radar-card flow-radar-card--highlight flow-radar-hero">
          <div class="row flow-radar-hero-head">
            <div>
              <div class="flow-radar-hero-title">${text.headline}</div>
              <div class="flow-radar-hero-sub">${text.headlineSub}</div>
            </div>
            <div class="flow-radar-hero-actions">
              <span class="chip mono">${text.asOf}: ${formatDateTime(snapshot?.nowIso ?? null, language)}</span>
              <button
                class="btn primary finance-cta"
                ?disabled=${props.loading}
                @click=${props.onRefresh}
              >
                ${props.loading ? text.loading : text.refresh}
              </button>
            </div>
          </div>
          ${props.error ? html`<div class="callout danger stocks-callout">${props.error}</div>` : nothing}
          ${(snapshot?.warnings?.length ?? 0) > 0
            ? html`<div class="callout warn stocks-callout">${text.warningTitle}: ${snapshot?.warnings?.join(" | ")}</div>`
            : nothing}
        </section>

        ${!snapshot
          ? html`<section class="card flow-radar-card"><div class="muted">${text.noSnapshot}</div></section>`
          : html`
              <section class="card flow-radar-card flow-radar-board flow-radar-quality">
                <div class="card-title">${text.dataPipeline}</div>
                <div class="stat-grid flow-radar-quality-grid">
                  <div class="stat">
                    <div class="stat-label">Provider Order</div>
                    <div class="stat-value mono flow-radar-quality-value">
                      ${pipelineOrder.length > 0 ? pipelineOrder.join(" -> ") : "-"}
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.metricsCoverage}</div>
                    <div class="stat-value mono">${formatCoverage(quality?.metricCoveragePercent)}</div>
                    <div class="muted mono">${quality ? `${quality.metricAvailable}/${quality.metricTotal}` : "-"}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.moversCoverage}</div>
                    <div class="stat-value mono">${formatCoverage(quality?.moverCoveragePercent)}</div>
                    <div class="muted mono">
                      ${quality ? `${quality.moverRowsAvailable}/${quality.moverRowsRequested} ${text.rowCount}` : "-"}
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.warnings}</div>
                    <div class="stat-value mono">${warningCount}</div>
                    <div class="muted">${warningCount > 0 ? text.warningTitle : "-"}</div>
                  </div>
                </div>
              </section>

              <div class="flow-radar-overview-panels">
              <section class="card flow-radar-card flow-radar-board">
                <div class="card-title">${text.macroBoard}</div>
                <div class="stat-grid flow-radar-overview-grid">
                  <div class="stat">
                    <div class="stat-label">${text.summary}</div>
                    <div class="row flow-radar-regime-row">
                      <span
                        class=${`chip mono flow-radar-regime flow-radar-regime--${regimeTone(snapshot.overview.liquidityRegime)}`}
                      >
                        ${regimeLabel(language, snapshot.overview.liquidityRegime)}
                      </span>
                      <span class="muted">${snapshot.overview.summary}</span>
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.fedSignal}</div>
                    <div class="muted">${snapshot.overview.fedSignal}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.bojSignal}</div>
                    <div class="muted">${snapshot.overview.bojSignal}</div>
                  </div>
                </div>
              </section>

              <section class="card flow-radar-card flow-radar-board">
                <div class="card-title">${text.flowBoard}</div>
                <div class="flow-radar-river">
                  ${snapshot.overview.assetFlows.map((flow) => {
                    const tone = flowTone(flow.direction);
                    const width = flowStrength(flow.changePercent);
                    return html`
                      <div class="flow-radar-river-item">
                        <div class="row flow-radar-river-meta">
                          <span class="mono">${flow.label}</span>
                          <span class=${`mono flow-radar-flow flow-radar-flow--${tone}`}>
                            ${formatPercent(flow.changePercent)} · ${directionLabel(language, flow.direction)}
                          </span>
                        </div>
                        <div class="flow-radar-river-track">
                          <div class=${`flow-radar-river-fill flow-radar-river-fill--${tone}`} style=${`width:${width}%`}></div>
                        </div>
                      </div>
                    `;
                  })}
                </div>
              </section>
              </div>

              <section class="card flow-radar-card flow-radar-board">
                <div class="card-title">${text.metricBoard}</div>
                <div class="stat-grid flow-radar-metric-grid">
                  ${snapshot.overview.metrics.map((metric) => {
                    const tone = flowTone(metric.direction);
                    return html`
                      <div class="stat">
                        <div class="stat-label">${metric.label}</div>
                        <div class="stat-value mono">${formatPrice(metric.price)}</div>
                        <div class=${`mono flow-radar-flow flow-radar-flow--${tone}`}>
                          ${formatPercent(metric.changePercent)} · ${directionLabel(language, metric.direction)}
                        </div>
                      </div>
                    `;
                  })}
                </div>
              </section>

              <section class="flow-radar-buckets">
                <div class="card-title flow-radar-buckets-title">${text.moversBoard}</div>
                <div class="flow-radar-buckets-grid">
                  ${snapshot.buckets.map((bucket) =>
                    renderBucket(language, bucket, props.activeAssetClass, props.activeSymbol, props.onSelect),
                  )}
                </div>
              </section>
            `}
      </div>

      <div class="flow-radar-right">
        <section class="card flow-radar-card flow-radar-detail-shell">
          <div class="card-title">${text.details}</div>
          ${props.detailLoading ? html`<div class="muted">${text.loading}</div>` : nothing}
          ${!props.detailLoading && !detail ? html`<div class="muted">${text.noDetail}</div>` : nothing}
          ${detail
            ? html`
                <div class="card-sub">${text.detailSummary}</div>
                <div class="stat-grid flow-radar-detail-grid">
                  <div class="stat">
                    <div class="stat-label">${text.symbol}</div>
                    <div class="stat-value mono">${detail.symbol}</div>
                    <div class="muted mono">${formatPrice(detail.price)}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.return7d}</div>
                    <div class="stat-value mono">${formatPercent(detail.analysis.changePercent7d)}</div>
                    <div class="muted">
                      ${text.trend}: <span class="mono">${trendLabel(language, detail.analysis.trend)}</span>
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-label">${text.volatility}</div>
                    <div class="stat-value mono">${formatPercent(detail.analysis.volatilityPercent)}</div>
                    <div class="muted">${text.marketTime}: ${formatDateTime(detail.marketTimeIso ?? null, language)}</div>
                  </div>
                </div>
                ${(detail.warnings?.length ?? 0) > 0
                  ? html`<div class="callout warn stocks-callout">${detail.warnings?.join(" | ")}</div>`
                  : nothing}
                <div class="callout flow-radar-analysis">${detail.analysis.summary}</div>
                <div class="card-sub">${text.chart}</div>
                ${renderDetailChart(detail, language)}
              `
            : nothing}
        </section>

        <section class="card flow-radar-card">
          <div class="card-title">${text.relatedNews}</div>
          ${(detail?.news?.length ?? 0) === 0
            ? html`<div class="muted">${text.noNews}</div>`
            : html`
                <div class="market-data-news-list">
                  ${detail?.news.map(
                    (entry) => html`
                      <a class="market-data-news-item" href=${entry.link} target="_blank" rel="noreferrer">
                        <div class="market-data-news-title">${entry.title}</div>
                        <div class="muted market-data-news-meta">
                          ${(entry.source ?? "-")} · ${(entry.pubDate ?? "-")}
                        </div>
                      </a>
                    `,
                  )}
                </div>
              `}
        </section>
      </div>
    </section>
  `;
}

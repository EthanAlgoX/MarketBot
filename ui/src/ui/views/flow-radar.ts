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
  cacheTtlMsText: string;
  onCacheTtlMsTextChange: (value: string) => void;
  onRefresh: () => void;
  onForceRefresh: () => void;
  onSelect: (assetClass: FlowAssetClass, symbol: string) => void;
};

const TEXT = {
  en: {
    headline: "Global Liquidity Pulse",
    headlineSub: "Macro liquidity board for equities, metals, and crypto.",
    dataPipeline: "API-First Data Pipeline",
    providerOrder: "Provider Order",
    metricsCoverage: "Metric Coverage",
    moversCoverage: "Top Movers Coverage",
    warnings: "Warnings",
    rowCount: "Rows",
    controlPanel: "Control Panel",
    refresh: "Refresh Snapshot",
    forceRefresh: "Force Refresh",
    cacheTtlInput: "Cache TTL (ms)",
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
    decisionBoard: "Action Radar",
    signalBoard: "Signal Breakdown",
    regimeTimeline: "7D Regime Timeline",
    actionNow: "Action",
    actionTrack: "Track",
    actionObserve: "Observe",
    actionReduce: "Reduce",
    actionTrackHint: "Trend is strong and volatility is controlled.",
    actionObserveHint: "Signals are mixed, wait for confirmation.",
    actionReduceHint: "Pullback risk is increasing; reduce exposure pace.",
    signalPrice: "Price Action",
    signalMacro: "Macro Regime",
    signalNews: "News Signal",
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
    rank: "Rank",
    spotlight: "Hot Spotlight",
    confidence: "Confidence",
    confidenceHigh: "High",
    confidenceMid: "Medium",
    confidenceLow: "Low",
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
    cacheStatus: "Cache",
    cacheHit: "Local Hit",
    cacheMiss: "Fresh Pull",
    cacheAge: "Age",
    cacheTtl: "TTL",
    ttl3m: "3m",
    ttl10m: "10m",
    ttl30m: "30m",
    detailCache: "Detail Cache",
  },
  zh: {
    headline: "全球流动性脉冲",
    headlineSub: "面向股票、金属、加密资产的宏观流动性驾驶舱。",
    dataPipeline: "API优先数据链路",
    providerOrder: "数据源顺序",
    metricsCoverage: "指标覆盖率",
    moversCoverage: "涨幅榜覆盖率",
    warnings: "警告",
    rowCount: "条目数",
    controlPanel: "控制面板",
    refresh: "刷新快照",
    forceRefresh: "强制刷新",
    cacheTtlInput: "缓存TTL（毫秒）",
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
    decisionBoard: "动作雷达",
    signalBoard: "信号拆解",
    regimeTimeline: "7日状态时间线",
    actionNow: "当前动作",
    actionTrack: "跟踪",
    actionObserve: "观察",
    actionReduce: "降风险",
    actionTrackHint: "趋势向上且波动可控，可保持跟踪。",
    actionObserveHint: "信号分歧，建议等待确认。",
    actionReduceHint: "回撤与波动风险上升，优先收缩节奏。",
    signalPrice: "价格行为",
    signalMacro: "宏观状态",
    signalNews: "新闻信号",
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
    rank: "排名",
    spotlight: "热点聚焦",
    confidence: "置信度",
    confidenceHigh: "高",
    confidenceMid: "中",
    confidenceLow: "低",
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
    cacheStatus: "缓存",
    cacheHit: "本地命中",
    cacheMiss: "实时拉取",
    cacheAge: "已缓存",
    cacheTtl: "有效期",
    ttl3m: "3分钟",
    ttl10m: "10分钟",
    ttl30m: "30分钟",
    detailCache: "详情缓存",
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

function formatDurationMs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    return "-";
  }
  if (ms < 1_000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60_000).toFixed(1)}m`;
}

function dominantFlowLabel(snapshot: FlowSnapshot | null, language: UiLanguage): string {
  if (!snapshot || snapshot.overview.assetFlows.length === 0) {
    return "-";
  }
  const sorted = [...snapshot.overview.assetFlows].sort((a, b) => {
    const av = typeof a.changePercent === "number" ? Math.abs(a.changePercent) : -1;
    const bv = typeof b.changePercent === "number" ? Math.abs(b.changePercent) : -1;
    return bv - av;
  });
  const primary = sorted[0];
  if (!primary) {
    return "-";
  }
  return `${primary.label} · ${directionLabel(language, primary.direction)}`;
}

function reasonConfidence(item: { reason: string; headline: string | null }): "high" | "mid" | "low" {
  const reason = item.reason.trim();
  if (item.headline && reason && reason !== "-") {
    return "high";
  }
  if (reason.length >= 14 && reason !== "-") {
    return "mid";
  }
  return "low";
}

function reasonConfidenceLabel(language: UiLanguage, level: "high" | "mid" | "low"): string {
  const text = TEXT[language] ?? TEXT.en;
  if (level === "high") return text.confidenceHigh;
  if (level === "mid") return text.confidenceMid;
  return text.confidenceLow;
}

function collectSpotlight(snapshot: FlowSnapshot | null): Array<{
  assetClass: FlowAssetClass;
  symbol: string;
  label: string;
  changePercent: number | null;
  reason: string;
}> {
  if (!snapshot) {
    return [];
  }
  const rows: Array<{
    assetClass: FlowAssetClass;
    symbol: string;
    label: string;
    changePercent: number | null;
    reason: string;
  }> = [];
  for (const bucket of snapshot.buckets) {
    const top = bucket.items[0];
    if (!top) continue;
    rows.push({
      assetClass: bucket.assetClass,
      symbol: top.symbol,
      label: bucket.label,
      changePercent: top.changePercent,
      reason: top.reason,
    });
  }
  rows.sort((a, b) => {
    const av = typeof a.changePercent === "number" ? Math.abs(a.changePercent) : -1;
    const bv = typeof b.changePercent === "number" ? Math.abs(b.changePercent) : -1;
    return bv - av;
  });
  return rows.slice(0, 5);
}

type DerivedAction = {
  tone: "up" | "down" | "flat";
  label: string;
  hint: string;
};

function deriveAction(detail: FlowDetail, snapshot: FlowSnapshot | null, language: UiLanguage): DerivedAction {
  const text = TEXT[language] ?? TEXT.en;
  const ret = detail.analysis.changePercent7d ?? 0;
  const vol = detail.analysis.volatilityPercent ?? 0;
  const trend = detail.analysis.trend;
  const regime = snapshot?.overview.liquidityRegime ?? "balanced";
  if (trend === "up" && ret >= 2.5 && vol <= 4.5 && regime !== "risk-off") {
    return {
      tone: "up",
      label: text.actionTrack,
      hint: text.actionTrackHint,
    };
  }
  if (trend === "down" || ret <= -2.0 || vol >= 5 || regime === "risk-off") {
    return {
      tone: "down",
      label: text.actionReduce,
      hint: text.actionReduceHint,
    };
  }
  return {
    tone: "flat",
    label: text.actionObserve,
    hint: text.actionObserveHint,
  };
}

type TimelineTick = {
  label: string;
  tone: "up" | "down" | "flat";
  changePercent: number | null;
};

function formatShortDay(iso: string, language: UiLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(5, 10);
  }
  const locale = language === "zh" ? "zh-CN" : "en-US";
  return date.toLocaleDateString(locale, { month: "2-digit", day: "2-digit" });
}

function buildTimeline(detail: FlowDetail, language: UiLanguage): TimelineTick[] {
  const points = detail.points.slice(-7);
  if (points.length === 0) {
    return [];
  }
  return points.map((point, index) => {
    const prev = index > 0 ? points[index - 1] : undefined;
    const prevClose = prev?.close;
    const changePercent =
      typeof prevClose === "number" && prevClose !== 0
        ? ((point.close - prevClose) / prevClose) * 100
        : null;
    const tone: "up" | "down" | "flat" =
      typeof changePercent !== "number"
        ? "flat"
        : changePercent >= 0.8
          ? "up"
          : changePercent <= -0.8
            ? "down"
            : "flat";
    return {
      label: formatShortDay(point.iso, language),
      tone,
      changePercent,
    };
  });
}

function summarizeSignalRows(params: {
  detail: FlowDetail;
  snapshot: FlowSnapshot | null;
  language: UiLanguage;
}): Array<{ key: string; value: string; tone: "up" | "down" | "flat" }> {
  const { detail, snapshot, language } = params;
  const text = TEXT[language] ?? TEXT.en;
  const priceTone =
    detail.analysis.trend === "up" ? "up" : detail.analysis.trend === "down" ? "down" : "flat";
  const priceValue = `${trendLabel(language, detail.analysis.trend)} · ${formatPercent(detail.analysis.changePercent7d)}`;
  const macroRegime = snapshot?.overview.liquidityRegime ?? "balanced";
  const macroTone = regimeTone(macroRegime);
  const macroValue = `${regimeLabel(language, macroRegime)} · ${snapshot?.overview.fedSignal ?? "-"}`;
  const newsCount = detail.news.length;
  const newsTone: "up" | "down" | "flat" = newsCount >= 2 ? "up" : newsCount === 1 ? "flat" : "down";
  const newsValue =
    newsCount > 0 ? `${newsCount} · ${detail.news[0]?.title ?? "-"}` : text.noNews;
  return [
    { key: text.signalPrice, value: priceValue, tone: priceTone },
    { key: text.signalMacro, value: macroValue, tone: macroTone },
    { key: text.signalNews, value: newsValue, tone: newsTone },
  ];
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
      <div class="flow-radar-table-shell">
        <div class="flow-radar-table">
          <div class="flow-radar-row flow-radar-row--head">
            <span>${text.rank}</span>
            <span>${text.symbol}</span>
            <span>${text.price}</span>
            <span>${text.change}</span>
            <span>${text.reason}</span>
          </div>
          ${bucket.items.map((item, index) => {
            const selected = activeAssetClass === bucket.assetClass && activeSymbol === item.symbol;
            const directionClass =
              typeof item.changePercent === "number" && item.changePercent > 0
                ? "flow-radar-up"
                : typeof item.changePercent === "number" && item.changePercent < 0
                  ? "flow-radar-down"
                  : "";
            const confidence = reasonConfidence(item);
            return html`
              <button
                class="flow-radar-row ${selected ? "active" : ""}"
                @click=${() => onSelect(bucket.assetClass, item.symbol)}
              >
                <span class="chip mono flow-radar-rank">${index + 1}</span>
                <span class="flow-radar-symbol-cell">
                  <span class="mono flow-radar-symbol-main">${item.symbol}</span>
                  <span class="flow-radar-symbol-sub" title=${item.name ?? "-"}>${item.name ?? "-"}</span>
                </span>
                <span class="mono">${formatPrice(item.price)}</span>
                <span class=${`mono ${directionClass}`}>${formatPercent(item.changePercent)}</span>
                <span class="flow-radar-reason-wrap">
                  <span class=${`chip mono flow-radar-confidence flow-radar-confidence--${confidence}`}>
                    ${text.confidence}: ${reasonConfidenceLabel(language, confidence)}
                  </span>
                  <span class="flow-radar-reason" title=${item.reason}>${item.reason}</span>
                </span>
              </button>
            `;
          })}
        </div>
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
  const totalRows = snapshot?.buckets.reduce((sum, bucket) => sum + bucket.items.length, 0) ?? 0;
  const warningCount = snapshot?.warnings?.length ?? 0;
  const snapshotCache = snapshot?.cache;
  const cacheLabel = snapshotCache?.hit ? text.cacheHit : text.cacheMiss;
  const detailCache = detail?.cache;
  const detailCacheLabel = detailCache?.hit ? text.cacheHit : text.cacheMiss;
  const spotlight = collectSpotlight(snapshot);
  const detailAction = detail ? deriveAction(detail, snapshot, language) : null;
  const detailTimeline = detail ? buildTimeline(detail, language) : [];
  const detailSignals = detail ? summarizeSignalRows({ detail, snapshot, language }) : [];

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
              <div class="flow-radar-chip-row">
                <span class="chip mono">${text.asOf}: ${formatDateTime(snapshot?.nowIso ?? null, language)}</span>
                <span class="chip mono">
                  ${text.cacheStatus}: ${cacheLabel}
                  (${text.cacheAge} ${formatDurationMs(snapshotCache?.ageMs)} / ${text.cacheTtl}
                  ${formatDurationMs(snapshotCache?.ttlMs)})
                </span>
                <span class="chip mono">${text.rowCount}: ${totalRows}</span>
              </div>
              <div class="flow-radar-control-panel">
                <div class="flow-radar-control-label muted">${text.controlPanel}</div>
                <div class="flow-radar-control-row">
                  <label class="field flow-radar-ttl-field">
                    <span>${text.cacheTtlInput}</span>
                    <input
                      class="input mono"
                      type="number"
                      min="1000"
                      step="1000"
                      .value=${props.cacheTtlMsText}
                      @input=${(event: Event) =>
                        props.onCacheTtlMsTextChange((event.target as HTMLInputElement).value)}
                      placeholder="180000"
                    />
                  </label>
                  <div class="flow-radar-ttl-presets">
                    <button class="btn btn--sm" ?disabled=${props.loading} @click=${() => props.onCacheTtlMsTextChange("180000")}>${text.ttl3m}</button>
                    <button class="btn btn--sm" ?disabled=${props.loading} @click=${() => props.onCacheTtlMsTextChange("600000")}>${text.ttl10m}</button>
                    <button class="btn btn--sm" ?disabled=${props.loading} @click=${() => props.onCacheTtlMsTextChange("1800000")}>${text.ttl30m}</button>
                  </div>
                  <button class="btn" ?disabled=${props.loading} @click=${props.onForceRefresh}>
                    ${text.forceRefresh}
                  </button>
                  <button
                    class="btn primary finance-cta"
                    ?disabled=${props.loading}
                    @click=${props.onRefresh}
                  >
                    ${props.loading ? text.loading : text.refresh}
                  </button>
                </div>
              </div>
            </div>
          </div>
          ${props.error ? html`<div class="callout danger stocks-callout">${props.error}</div>` : nothing}
          ${(snapshot?.warnings?.length ?? 0) > 0
            ? html`<div class="callout warn stocks-callout">${text.warningTitle}: ${snapshot?.warnings?.join(" | ")}</div>`
            : nothing}
          ${spotlight.length > 0
            ? html`
                <div class="flow-radar-spotlight">
                  <div class="flow-radar-spotlight-title">${text.spotlight}</div>
                  <div class="flow-radar-spotlight-list">
                    ${spotlight.map((entry) => {
                      const directionClass =
                        typeof entry.changePercent === "number" && entry.changePercent > 0
                          ? "flow-radar-up"
                          : typeof entry.changePercent === "number" && entry.changePercent < 0
                            ? "flow-radar-down"
                            : "";
                      return html`
                        <button
                          class="flow-radar-spotlight-item"
                          @click=${() => props.onSelect(entry.assetClass, entry.symbol)}
                          title=${`${entry.label} · ${entry.reason}`}
                        >
                          <span class="mono">${entry.symbol}</span>
                          <span class=${`mono ${directionClass}`}>${formatPercent(entry.changePercent)}</span>
                          <span class="muted">${entry.reason}</span>
                        </button>
                      `;
                    })}
                  </div>
                </div>
              `
            : nothing}
        </section>

        ${!snapshot
          ? html`
              <section class="card flow-radar-card flow-radar-empty">
                <div class="muted">${text.noSnapshot}</div>
              </section>
            `
          : html`
              <section class="flow-radar-core-grid">
                <section class="card flow-radar-card flow-radar-board flow-radar-quality flow-radar-core-span">
                  <div class="card-title">${text.dataPipeline}</div>
                  <div class="stat-grid flow-radar-quality-grid">
                    <div class="stat">
                      <div class="stat-label">${text.providerOrder}</div>
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
                    <div class="stat">
                      <div class="stat-label">${text.flowBoard}</div>
                      <div class="stat-value mono">${dominantFlowLabel(snapshot, language)}</div>
                      <div class="muted">${snapshot.overview.summary}</div>
                    </div>
                  </div>
                </section>

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

                <section class="card flow-radar-card flow-radar-board flow-radar-core-span">
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
          <div class="row flow-radar-detail-head">
            <div class="card-title">${text.details}</div>
            <span class="chip mono">
              ${text.detailCache}: ${detailCacheLabel}
              (${text.cacheAge} ${formatDurationMs(detailCache?.ageMs)} / ${text.cacheTtl}
              ${formatDurationMs(detailCache?.ttlMs)})
            </span>
          </div>
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
                ${detailAction
                  ? html`
                      <section class="flow-radar-decision">
                        <div class="row flow-radar-decision-head">
                          <div class="card-sub">${text.decisionBoard}</div>
                          <span class=${`chip mono flow-radar-regime flow-radar-regime--${detailAction.tone}`}>
                            ${text.actionNow}: ${detailAction.label}
                          </span>
                        </div>
                        <div class="muted">${detailAction.hint}</div>
                        ${detailTimeline.length > 0
                          ? html`
                              <div class="flow-radar-timeline-wrap">
                                <div class="flow-radar-timeline-title">${text.regimeTimeline}</div>
                                <div class="flow-radar-timeline">
                                  ${detailTimeline.map((tick) => html`
                                    <div class="flow-radar-tick">
                                      <span class=${`flow-radar-tick-dot flow-radar-tick-dot--${tick.tone}`}></span>
                                      <span class="mono">${tick.label}</span>
                                      <span class=${`mono flow-radar-flow flow-radar-flow--${tick.tone}`}>
                                        ${formatPercent(tick.changePercent)}
                                      </span>
                                    </div>
                                  `)}
                                </div>
                              </div>
                            `
                          : nothing}
                      </section>
                    `
                  : nothing}
                ${detailSignals.length > 0
                  ? html`
                      <section class="flow-radar-signal">
                        <div class="card-sub">${text.signalBoard}</div>
                        <div class="flow-radar-signal-grid">
                          ${detailSignals.map((signal) => html`
                            <div class="flow-radar-signal-item">
                              <div class="flow-radar-signal-key">${signal.key}</div>
                              <div class=${`flow-radar-signal-value mono flow-radar-flow flow-radar-flow--${signal.tone}`}>
                                ${signal.value}
                              </div>
                            </div>
                          `)}
                        </div>
                      </section>
                    `
                  : nothing}
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

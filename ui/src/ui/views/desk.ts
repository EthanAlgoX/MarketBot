import { html, nothing } from "lit";

import type { UiLanguage } from "../storage";
import type { DailyStockRunResult } from "../types";

export type DeskProps = {
  language?: UiLanguage;
  connected: boolean;
  lastError: string | null;
  stocksLast: DailyStockRunResult | null;
  watchlistText: string;
  onOpenStocks: () => void;
  onRunStocks: () => void;
  onOpenChannels: () => void;
  onOpenSessions: () => void;
  onOpenCron: () => void;
  onOpenLogs: () => void;
  onOpenChat: () => void;
};

const DESK_TEXT = {
  en: {
    heroTitle: "Finance Desk",
    heroSub:
      "Daily stocks, research workflows, and delivery operations in one control plane.",
    gateway: "Gateway",
    connected: "Connected",
    disconnected: "Disconnected",
    dailyStocksTitle: "Daily Stocks",
    dailyStocksSub: "Watchlist-driven decision dashboards and research-style notes.",
    symbols: "symbols",
    lastRun: "Last Run",
    mode: "Mode",
    modeValue: "simple/full",
    runNow: "Run Now",
    openStocks: "Open Stocks",
    connectHint: "Connect to the gateway to run Daily Stocks.",
    opsTitle: "Ops Console",
    opsSub: "Runtime visibility for delivery, sessions, and scheduling.",
    channels: "Channels",
    sessions: "Sessions",
    cron: "Cron",
    logs: "Logs",
    researchTitle: "Research Workflow",
    researchSub: "Use Chat to browse, capture sources, and generate a memo-like summary.",
    researchTip:
      "Tip: ask the agent to fetch primary sources via the built-in browser profile (marketbot) and cite links.",
    openChat: "Open Chat",
    fileTitle: "File Analysis",
    fileSub: "Attach CSV/JSON/PDF in Chat to summarize local datasets and produce a finance-style note.",
    fileTip: "The gateway sanitizes and stages attachments before tool runs.",
    attachInChat: "Attach in Chat",
    notAvailable: "n/a",
  },
  zh: {
    heroTitle: "财经工作台",
    heroSub: "在一个控制平面中完成每日股票、研究流程与交付运维。",
    gateway: "网关",
    connected: "已连接",
    disconnected: "未连接",
    dailyStocksTitle: "每日股票",
    dailyStocksSub: "基于观察列表的决策面板与研究风格笔记。",
    symbols: "个标的",
    lastRun: "最近运行",
    mode: "模式",
    modeValue: "simple/full",
    runNow: "立即运行",
    openStocks: "打开股票",
    connectHint: "请先连接网关，再运行每日股票任务。",
    opsTitle: "运维控制台",
    opsSub: "查看交付、会话与调度的运行状态。",
    channels: "渠道",
    sessions: "会话",
    cron: "定时任务",
    logs: "日志",
    researchTitle: "研究流程",
    researchSub: "在对话中检索信息、收集来源并生成备忘录式总结。",
    researchTip: "提示：让代理通过内置浏览器配置（marketbot）获取一手来源并附上链接。",
    openChat: "打开对话",
    fileTitle: "文件分析",
    fileSub: "在对话中附加 CSV/JSON/PDF，总结本地数据并生成金融风格分析。",
    fileTip: "网关会在工具运行前对附件做清洗与暂存。",
    attachInChat: "在对话中附加",
    notAvailable: "暂无",
  },
} as const;

function normalizeSymbolsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function renderDesk(props: DeskProps) {
  const language = props.language ?? "en";
  const text = DESK_TEXT[language] ?? DESK_TEXT.en;
  const watchlist = normalizeSymbolsFromText(props.watchlistText);
  const lastDate = props.stocksLast?.dateIso ?? null;

  return html`
    <section class="desk-layout">
      <section class="desk-hero">
        <div class="desk-hero__left">
          <div class="desk-hero__title">${text.heroTitle}</div>
          <div class="desk-hero__sub">
            ${text.heroSub}
          </div>
        </div>
        <div class="desk-hero__right">
          <div class="pill ${props.connected ? "ok" : "warn"}">
            <span class="statusDot ${props.connected ? "ok" : "warn"}"></span>
            <span>${text.gateway}</span>
            <span class="mono">${props.connected ? text.connected : text.disconnected}</span>
          </div>
          ${props.lastError ? html`<div class="pill danger">${props.lastError}</div>` : nothing}
        </div>
      </section>

        <section class="grid grid-cols-2">
        <section class="card">
          <div class="row" style="justify-content: space-between;">
            <div>
              <div class="card-title">${text.dailyStocksTitle}</div>
              <div class="card-sub">${text.dailyStocksSub}</div>
            </div>
            <div class="pill">
              <span class="mono">${watchlist.length}</span>
              <span class="muted">${text.symbols}</span>
            </div>
          </div>

          <div class="note-grid" style="margin-top: 14px;">
            <div class="stat">
              <div class="stat-label">${text.lastRun}</div>
              <div class="stat-value mono">${lastDate ?? text.notAvailable}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${text.mode}</div>
              <div class="stat-value mono">${text.modeValue}</div>
            </div>
          </div>

          <div class="row" style="margin-top: 14px;">
            <button class="btn primary" ?disabled=${!props.connected} @click=${props.onRunStocks}>
              ${text.runNow}
            </button>
            <button class="btn" @click=${props.onOpenStocks}>${text.openStocks}</button>
          </div>
          ${!props.connected
            ? html`<div class="callout warn" style="margin-top: 12px;">
                ${text.connectHint}
              </div>`
            : nothing}
        </section>

        <section class="card">
          <div class="card-title">${text.opsTitle}</div>
          <div class="card-sub">${text.opsSub}</div>

          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChannels}>${text.channels}</button>
            <button class="btn" @click=${props.onOpenSessions}>${text.sessions}</button>
            <button class="btn" @click=${props.onOpenCron}>${text.cron}</button>
            <button class="btn" @click=${props.onOpenLogs}>${text.logs}</button>
          </div>
        </section>
      </section>

      <section class="grid grid-cols-2">
        <section class="card">
          <div class="card-title">${text.researchTitle}</div>
          <div class="card-sub">
            ${text.researchSub}
          </div>
          <div class="muted" style="margin-top: 12px;">
            ${text.researchTip}
          </div>
          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChat}>${text.openChat}</button>
          </div>
        </section>

        <section class="card">
          <div class="card-title">${text.fileTitle}</div>
          <div class="card-sub">
            ${text.fileSub}
          </div>
          <div class="muted" style="margin-top: 12px;">
            ${text.fileTip}
          </div>
          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChat}>${text.attachInChat}</button>
          </div>
        </section>
      </section>
    </section>
  `;
}

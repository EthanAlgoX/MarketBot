import { html, nothing } from "lit";

import type { DailyStockRunResult } from "../types";

export type DeskProps = {
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

function normalizeSymbolsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function renderDesk(props: DeskProps) {
  const watchlist = normalizeSymbolsFromText(props.watchlistText);
  const lastDate = props.stocksLast?.dateIso ?? null;

  return html`
    <section class="desk-layout">
      <section class="desk-hero">
        <div class="desk-hero__left">
          <div class="desk-hero__title">Finance Desk</div>
          <div class="desk-hero__sub">
            Daily stocks, research workflows, and delivery operations in one control plane.
          </div>
        </div>
        <div class="desk-hero__right">
          <div class="pill ${props.connected ? "ok" : "warn"}">
            <span class="statusDot ${props.connected ? "ok" : "warn"}"></span>
            <span>Gateway</span>
            <span class="mono">${props.connected ? "Connected" : "Disconnected"}</span>
          </div>
          ${props.lastError ? html`<div class="pill danger">${props.lastError}</div>` : nothing}
        </div>
      </section>

        <section class="grid grid-cols-2">
        <section class="card">
          <div class="row" style="justify-content: space-between;">
            <div>
              <div class="card-title">Daily Stocks</div>
              <div class="card-sub">Watchlist-driven decision dashboards and research-style notes.</div>
            </div>
            <div class="pill">
              <span class="mono">${watchlist.length}</span>
              <span class="muted">symbols</span>
            </div>
          </div>

          <div class="note-grid" style="margin-top: 14px;">
            <div class="stat">
              <div class="stat-label">Last Run</div>
              <div class="stat-value mono">${lastDate ?? "n/a"}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Mode</div>
              <div class="stat-value mono">simple/full</div>
            </div>
          </div>

          <div class="row" style="margin-top: 14px;">
            <button class="btn primary" ?disabled=${!props.connected} @click=${props.onRunStocks}>
              Run Now
            </button>
            <button class="btn" @click=${props.onOpenStocks}>Open Stocks</button>
          </div>
          ${!props.connected
            ? html`<div class="callout warn" style="margin-top: 12px;">
                Connect to the gateway to run Daily Stocks.
              </div>`
            : nothing}
        </section>

        <section class="card">
          <div class="card-title">Ops Console</div>
          <div class="card-sub">Runtime visibility for delivery, sessions, and scheduling.</div>

          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChannels}>Channels</button>
            <button class="btn" @click=${props.onOpenSessions}>Sessions</button>
            <button class="btn" @click=${props.onOpenCron}>Cron</button>
            <button class="btn" @click=${props.onOpenLogs}>Logs</button>
          </div>
        </section>
      </section>

      <section class="grid grid-cols-2">
        <section class="card">
          <div class="card-title">Research Workflow</div>
          <div class="card-sub">
            Use Chat to browse, capture sources, and generate a memo-like summary.
          </div>
          <div class="muted" style="margin-top: 12px;">
            Tip: ask the agent to fetch primary sources via the built-in browser profile (marketbot) and cite links.
          </div>
          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChat}>Open Chat</button>
          </div>
        </section>

        <section class="card">
          <div class="card-title">File Analysis</div>
          <div class="card-sub">
            Attach CSV/JSON/PDF in Chat to summarize local datasets and produce a finance-style note.
          </div>
          <div class="muted" style="margin-top: 12px;">
            The gateway sanitizes and stages attachments before tool runs.
          </div>
          <div class="row" style="margin-top: 14px;">
            <button class="btn" @click=${props.onOpenChat}>Attach in Chat</button>
          </div>
        </section>
      </section>
    </section>
  `;
}

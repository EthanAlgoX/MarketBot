import { html, nothing } from "lit";

import { clampText, formatAgo, formatDurationMs } from "../format";
import type { UiLanguage } from "../storage";
import type { TraceRunEvent, TraceRunMeta } from "../types";

export type RunsProps = {
  language?: UiLanguage;
  loading: boolean;
  error: string | null;
  runs: TraceRunMeta[];
  selectedRunId: string | null;

  runLoading: boolean;
  runError: string | null;
  runEvents: TraceRunEvent[];
  runTruncated: boolean;

  streamsFilter: Record<string, boolean>;
  replayIndex: number;

  onRefreshRuns: () => void;
  onSelectRun: (runId: string) => void;
  onRefreshRun: () => void;
  onToggleStream: (stream: string, enabled: boolean) => void;
  onReplayIndex: (next: number) => void;
};

const RUNS_TEXT = {
  en: {
    tool: "tool",
    event: "event",
    policy: "policy",
    lifecycle: "lifecycle",
    compaction: "compaction",
    error: "error",
    ok: "ok",
    toolsCount: (n: number) => `${n} tools`,
    running: "RUNNING",
    ended: "ENDED",
    sessionNA: "session: n/a",
    last: "last",
    tools: "tools",
    err: "err",
    dur: "dur",
    title: "Runs",
    sub: "Replayable run graph built from agent lifecycle, tool, and policy events.",
    loading: "Loading…",
    refresh: "Refresh",
    recent: "Recent",
    noRuns: "No runs captured yet.",
    replay: "Replay",
    selectRun: "Select a run on the left.",
    runPrefix: "Run:",
    reload: "Reload",
    traceTruncated: "Trace truncated. Showing the latest window from disk.",
    replayLabel: "Replay",
    events: "events",
    noEvents: "No events (filter/replay window).",
  },
  zh: {
    tool: "工具",
    event: "事件",
    policy: "策略",
    lifecycle: "生命周期",
    compaction: "压缩",
    error: "错误",
    ok: "正常",
    toolsCount: (n: number) => `${n} 个工具`,
    running: "运行中",
    ended: "已结束",
    sessionNA: "会话: 暂无",
    last: "最近",
    tools: "工具",
    err: "错",
    dur: "时长",
    title: "运行记录",
    sub: "基于代理生命周期、工具和策略事件构建的可回放运行图。",
    loading: "加载中…",
    refresh: "刷新",
    recent: "最近",
    noRuns: "暂无运行记录。",
    replay: "回放",
    selectRun: "请先在左侧选择一条运行记录。",
    runPrefix: "运行:",
    reload: "重新加载",
    traceTruncated: "轨迹已截断，仅显示磁盘中的最新窗口。",
    replayLabel: "回放",
    events: "事件",
    noEvents: "暂无事件（可能被筛选或回放窗口为空）。",
  },
} as const;

function safeNum(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function deriveEventLabel(evt: TraceRunEvent, text: (typeof RUNS_TEXT)["en"]): string {
  if (evt.stream === "tool") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    const name = typeof evt.data?.name === "string" ? evt.data.name : text.tool;
    const call = typeof evt.data?.toolCallId === "string" ? evt.data.toolCallId : "";
    const suffix = call ? ` (${call})` : "";
    return `${text.tool}.${phase || text.event} ${name}${suffix}`;
  }
  if (evt.stream === "policy") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : text.event;
    return `${text.policy}.${phase}`;
  }
  if (evt.stream === "lifecycle") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : text.event;
    return `${text.lifecycle}.${phase}`;
  }
  if (evt.stream === "compaction") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : text.event;
    return `${text.compaction}.${phase}`;
  }
  return evt.stream;
}

function summarizeEvent(evt: TraceRunEvent, text: (typeof RUNS_TEXT)["en"]): string | null {
  if (evt.stream === "tool") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    if (phase === "start") {
      const args = evt.data?.args;
      if (!args) return null;
      try {
        return clampText(JSON.stringify(args), 220);
      } catch {
        return clampText(String(args), 220);
      }
    }
    if (phase === "result") {
      const isError = Boolean(evt.data?.isError);
      return isError ? text.error : text.ok;
    }
  }
  if (evt.stream === "policy") {
    const tools = evt.data?.tools;
    if (Array.isArray(tools)) {
      return text.toolsCount(tools.length);
    }
  }
  return null;
}

function renderRunRow(
  run: TraceRunMeta,
  selected: boolean,
  onClick: () => void,
  text: (typeof RUNS_TEXT)["en"],
) {
  const runId = run.runId || "";
  const status = run.status === "running" ? text.running : text.ended;
  const durationMs =
    run.startedAtMs != null && run.endedAtMs != null ? run.endedAtMs - run.startedAtMs : null;
  return html`
    <button class="list-row ${selected ? "selected" : ""}" @click=${onClick}>
      <div class="row" style="justify-content: space-between;">
        <div class="mono" style="font-weight: 700;">${runId.slice(0, 12)}</div>
        <span class="chip ${run.status === "running" ? "warn" : ""}">${status}</span>
      </div>
      <div class="muted" style="margin-top: 4px;">
        ${run.sessionKey ? clampText(run.sessionKey, 42) : text.sessionNA}
      </div>
      <div class="row muted" style="margin-top: 6px; gap: 10px;">
        <span>${text.last} ${formatAgo(run.lastEventAtMs)}</span>
        <span>${text.tools} ${safeNum(run.toolCalls, 0)} (${safeNum(run.toolErrors, 0)} ${text.err})</span>
        ${durationMs != null ? html`<span>${text.dur} ${formatDurationMs(durationMs)}</span>` : nothing}
      </div>
    </button>
  `;
}

export function renderRuns(props: RunsProps) {
  const language = props.language ?? "en";
  const text = RUNS_TEXT[language] ?? RUNS_TEXT.en;
  const selected = props.selectedRunId;
  const eventsAll = Array.isArray(props.runEvents) ? props.runEvents : [];
  const replayIndex = Math.max(0, Math.min(props.replayIndex, eventsAll.length));
  const eventsWindow = eventsAll.slice(0, replayIndex);
  const availableStreams = Array.from(
    new Set(eventsAll.map((e) => (typeof e.stream === "string" ? e.stream : "event"))),
  ).sort();
  const filtered = eventsWindow.filter((evt) => props.streamsFilter[evt.stream] !== false);

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${text.title}</div>
          <div class="card-sub">${text.sub}</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefreshRuns}>
            ${props.loading ? text.loading : text.refresh}
          </button>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger" style="margin-top: 10px;">${props.error}</div>` : nothing}

      <div class="split" style="margin-top: 14px; display: grid; grid-template-columns: 360px 1fr; gap: 12px;">
        <div class="list">
          <div class="muted" style="margin-bottom: 8px;">${text.recent}</div>
          <div class="list-box">
            ${props.runs.length === 0
              ? html`<div class="muted" style="padding: 12px;">${text.noRuns}</div>`
              : props.runs.map((run) =>
                  renderRunRow(
                    run,
                    run.runId === selected,
                    () => props.onSelectRun(run.runId),
                    text,
                  ),
                )}
          </div>
        </div>

        <div class="detail">
          <div class="row" style="justify-content: space-between;">
            <div>
              <div class="card-title">${text.replay}</div>
              <div class="card-sub">
                ${selected
                  ? html`${text.runPrefix} <span class="mono">${selected}</span>`
                  : text.selectRun}
              </div>
            </div>
            <div class="row" style="gap: 8px;">
              <button class="btn" ?disabled=${!selected || props.runLoading} @click=${props.onRefreshRun}>
                ${props.runLoading ? text.loading : text.reload}
              </button>
            </div>
          </div>

          ${props.runError ? html`<div class="callout danger" style="margin-top: 10px;">${props.runError}</div>` : nothing}
          ${props.runTruncated
            ? html`<div class="callout" style="margin-top: 10px;">
                ${text.traceTruncated}
              </div>`
            : nothing}

          ${selected
            ? html`
                <div class="row" style="margin-top: 12px; gap: 10px; align-items: end;">
                  <label class="field" style="min-width: 220px;">
                    <span>${text.replayLabel}</span>
                    <input
                      type="range"
                      min="0"
                      max=${eventsAll.length}
                      .value=${String(replayIndex)}
                      @input=${(e: Event) =>
                        props.onReplayIndex(
                          Number((e.target as HTMLInputElement).value),
                        )}
                    />
                  </label>
                  <div class="muted">
                    ${replayIndex}/${eventsAll.length} ${text.events}
                  </div>
                </div>

                <div class="chip-row" style="margin-top: 10px;">
                  ${availableStreams.map((stream) => {
                    const enabled = props.streamsFilter[stream] !== false;
                    return html`
                      <label class="chip">
                        <input
                          type="checkbox"
                          .checked=${enabled}
                          @change=${(e: Event) =>
                            props.onToggleStream(
                              stream,
                              (e.target as HTMLInputElement).checked,
                            )}
                        />
                        <span class="mono">${stream}</span>
                      </label>
                    `;
                  })}
                </div>

                <div class="log-stream" style="margin-top: 12px;">
                  ${filtered.length === 0
                    ? html`<div class="muted" style="padding: 12px;">${text.noEvents}</div>`
                    : filtered.map((evt) => {
                        const label = deriveEventLabel(evt, text);
                        const summary = summarizeEvent(evt, text);
                        return html`
                          <div class="log-row">
                            <div class="log-time mono">${new Date(evt.ts).toLocaleTimeString()}</div>
                            <div class="log-level">${evt.stream}</div>
                            <div class="log-subsystem mono">${label}</div>
                            <div class="log-message mono">
                              ${summary ?? nothing}
                            </div>
                          </div>
                        `;
                      })}
                </div>
              `
            : nothing}
        </div>
      </div>

      <style>
        .list-box {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--panel);
        }
        .list-row {
          width: 100%;
          text-align: left;
          border: 0;
          background: transparent;
          color: inherit;
          padding: 12px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
        }
        .list-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .list-row.selected {
          background: rgba(255, 255, 255, 0.06);
        }
        .list-row:last-child {
          border-bottom: 0;
        }
      </style>
    </section>
  `;
}

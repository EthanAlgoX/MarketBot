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
    totalRuns: "Total Runs",
    activeRuns: "Active",
    totalToolErrors: "Tool Errors",
    selectedRun: "Selected",
    streamsLabel: "Streams",
    replayCoverage: "Coverage",
    selectedNone: "None",
    recentRuns: "Recent Runs",
    notAvailable: "n/a",
    noRunsHint: "Use Desk or Stocks to trigger a run, then replay it here.",
    noSelectionHint: "Select a run from Recent Runs to inspect events, streams, and tool outcomes.",
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
    totalRuns: "总运行数",
    activeRuns: "运行中",
    totalToolErrors: "工具错误",
    selectedRun: "当前选择",
    streamsLabel: "流",
    replayCoverage: "回放覆盖",
    selectedNone: "未选择",
    recentRuns: "最近运行",
    notAvailable: "暂无",
    noRunsHint: "先在总览或股票页面触发一次运行，再回到这里回放。",
    noSelectionHint: "请先从左侧“最近运行”中选择一条记录以查看事件与工具结果。",
  },
} as const;

function safeNum(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toClassToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
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
    <button class="runs-row ${selected ? "selected" : ""}" @click=${onClick}>
      <div class="row runs-row__head">
        <div class="mono runs-row__id">${runId.slice(0, 12)}</div>
        <span class="chip ${run.status === "running" ? "warn" : ""}">${status}</span>
      </div>
      <div class="muted runs-row__session">
        ${run.sessionKey ? clampText(run.sessionKey, 42) : text.sessionNA}
      </div>
      <div class="row muted runs-row__meta">
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
  const selectedRun = props.runs.find((run) => run.runId === selected) ?? null;
  const eventsAll = Array.isArray(props.runEvents) ? props.runEvents : [];
  const replayIndex = Math.max(0, Math.min(props.replayIndex, eventsAll.length));
  const eventsWindow = eventsAll.slice(0, replayIndex);
  const availableStreams = Array.from(
    new Set(eventsAll.map((e) => (typeof e.stream === "string" ? e.stream : "event"))),
  ).sort();
  const filtered = eventsWindow.filter((evt) => props.streamsFilter[evt.stream] !== false);
  const runsTotal = props.runs.length;
  const runsActive = props.runs.filter((run) => run.status === "running").length;
  const totalToolErrors = props.runs.reduce((sum, run) => sum + safeNum(run.toolErrors, 0), 0);
  const replayCoverage = eventsAll.length === 0
    ? "0%"
    : `${Math.round((replayIndex / eventsAll.length) * 100)}%`;
  const selectedDuration =
    selectedRun?.startedAtMs != null && selectedRun.endedAtMs != null
      ? Math.max(0, selectedRun.endedAtMs - selectedRun.startedAtMs)
      : null;
  const selectedLastAgo = selectedRun?.lastEventAtMs ? formatAgo(selectedRun.lastEventAtMs) : text.notAvailable;

  return html`
    <section class="card runs-layout finance-page">
      <div class="row runs-header">
        <div>
          <div class="card-title">${text.title}</div>
          <div class="card-sub">${text.sub}</div>
        </div>
        <div class="row runs-header__actions">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefreshRuns}>
            ${props.loading ? text.loading : text.refresh}
          </button>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger runs-callout">${props.error}</div>` : nothing}

      <div class="stat-grid runs-summary-grid">
        <div class="stat">
          <div class="stat-label">${text.totalRuns}</div>
          <div class="stat-value mono">${runsTotal}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.activeRuns}</div>
          <div class="stat-value mono">${runsActive}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.totalToolErrors}</div>
          <div class="stat-value mono">${totalToolErrors}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${text.selectedRun}</div>
          <div class="stat-value mono">${selected ? selected.slice(0, 10) : text.selectedNone}</div>
        </div>
      </div>

      <div class="runs-split">
        <div class="list runs-list">
          <div class="row runs-list__title">
            <span class="muted">${text.recentRuns}</span>
            <span class="chip mono">${runsTotal}</span>
          </div>
          <div class="runs-list-box">
            ${props.runs.length === 0
              ? html`
                  <div class="runs-empty-state">
                    <div class="runs-empty-title">${text.noRuns}</div>
                    <div class="muted runs-empty-desc">${text.noRunsHint}</div>
                    <button class="btn btn--sm" ?disabled=${props.loading} @click=${props.onRefreshRuns}>
                      ${props.loading ? text.loading : text.refresh}
                    </button>
                  </div>
                `
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

        <div class="detail runs-detail">
          <div class="row runs-detail__head">
            <div>
              <div class="card-title">${text.replay}</div>
              <div class="card-sub">
                ${selected
                  ? html`${text.runPrefix} <span class="mono">${selected}</span>`
                  : text.selectRun}
              </div>
            </div>
            <div class="row runs-header__actions">
              <button class="btn" ?disabled=${!selected || props.runLoading} @click=${props.onRefreshRun}>
                ${props.runLoading ? text.loading : text.reload}
              </button>
            </div>
          </div>

          ${props.runError ? html`<div class="callout danger runs-callout">${props.runError}</div>` : nothing}
          ${props.runTruncated
            ? html`<div class="callout runs-callout">
                ${text.traceTruncated}
              </div>`
            : nothing}

          ${selected
            ? html`
                <div class="chip-row runs-selected-meta">
                  <span class="chip">${text.streamsLabel}: ${availableStreams.length}</span>
                  <span class="chip">${text.events}: ${filtered.length}/${eventsAll.length}</span>
                  <span class="chip">${text.replayCoverage}: ${replayCoverage}</span>
                  <span class="chip">${text.last}: ${selectedLastAgo}</span>
                  ${selectedDuration != null
                    ? html`<span class="chip">${text.dur}: ${formatDurationMs(selectedDuration)}</span>`
                    : nothing}
                </div>

                <div class="row runs-replay-row">
                  <label class="field runs-replay-slider">
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
                  <div class="muted runs-replay-meta">
                    ${replayIndex}/${eventsAll.length} ${text.events}
                  </div>
                </div>

                <div class="chip-row runs-stream-filters">
                  ${availableStreams.map((stream) => {
                    const enabled = props.streamsFilter[stream] !== false;
                    return html`
                      <label class="chip runs-stream-chip">
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

                <div class="log-stream runs-log-stream">
                  ${filtered.length === 0
                    ? html`
                        <div class="runs-empty-state runs-empty-state--compact">
                          <div class="runs-empty-title">${text.noEvents}</div>
                        </div>
                      `
                    : filtered.map((evt) => {
                        const label = deriveEventLabel(evt, text);
                        const summary = summarizeEvent(evt, text);
                        const streamClass = `log-level--${toClassToken(evt.stream)}`;
                        return html`
                          <div class="log-row">
                            <div class="log-time mono">${new Date(evt.ts).toLocaleTimeString()}</div>
                            <div class="log-level ${streamClass}">${evt.stream}</div>
                            <div class="log-subsystem mono">${label}</div>
                            <div class="log-message mono">
                              ${summary ?? nothing}
                            </div>
                          </div>
                        `;
                      })}
                </div>
              `
            : html`
                <div class="runs-empty-state runs-empty-state--detail">
                  <div class="runs-empty-title">${text.selectRun}</div>
                  <div class="muted runs-empty-desc">${text.noSelectionHint}</div>
                </div>
              `}
        </div>
      </div>
    </section>
  `;
}

import { html, nothing } from "lit";

import { clampText, formatAgo, formatDurationMs, formatMs } from "../format";
import type { TraceRunEvent, TraceRunMeta } from "../types";

export type RunsProps = {
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

function safeNum(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function deriveEventLabel(evt: TraceRunEvent): string {
  if (evt.stream === "tool") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    const name = typeof evt.data?.name === "string" ? evt.data.name : "tool";
    const call = typeof evt.data?.toolCallId === "string" ? evt.data.toolCallId : "";
    const suffix = call ? ` (${call})` : "";
    return `tool.${phase || "event"} ${name}${suffix}`;
  }
  if (evt.stream === "policy") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "event";
    return `policy.${phase}`;
  }
  if (evt.stream === "lifecycle") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "event";
    return `lifecycle.${phase}`;
  }
  if (evt.stream === "compaction") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "event";
    return `compaction.${phase}`;
  }
  return evt.stream;
}

function summarizeEvent(evt: TraceRunEvent): string | null {
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
      return isError ? "error" : "ok";
    }
  }
  if (evt.stream === "policy") {
    const tools = evt.data?.tools;
    if (Array.isArray(tools)) {
      return `${tools.length} tools`;
    }
  }
  return null;
}

function renderRunRow(run: TraceRunMeta, selected: boolean, onClick: () => void) {
  const runId = run.runId || "";
  const status = run.status === "running" ? "RUNNING" : "ENDED";
  const durationMs =
    run.startedAtMs != null && run.endedAtMs != null ? run.endedAtMs - run.startedAtMs : null;
  return html`
    <button class="list-row ${selected ? "selected" : ""}" @click=${onClick}>
      <div class="row" style="justify-content: space-between;">
        <div class="mono" style="font-weight: 700;">${runId.slice(0, 12)}</div>
        <span class="chip ${run.status === "running" ? "warn" : ""}">${status}</span>
      </div>
      <div class="muted" style="margin-top: 4px;">
        ${run.sessionKey ? clampText(run.sessionKey, 42) : "session: n/a"}
      </div>
      <div class="row muted" style="margin-top: 6px; gap: 10px;">
        <span>last ${formatAgo(run.lastEventAtMs)}</span>
        <span>tools ${safeNum(run.toolCalls, 0)} (${safeNum(run.toolErrors, 0)} err)</span>
        ${durationMs != null ? html`<span>dur ${formatDurationMs(durationMs)}</span>` : nothing}
      </div>
    </button>
  `;
}

export function renderRuns(props: RunsProps) {
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
          <div class="card-title">Runs</div>
          <div class="card-sub">
            Replayable run graph built from agent lifecycle, tool, and policy events.
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefreshRuns}>
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger" style="margin-top: 10px;">${props.error}</div>` : nothing}

      <div class="split" style="margin-top: 14px; display: grid; grid-template-columns: 360px 1fr; gap: 12px;">
        <div class="list">
          <div class="muted" style="margin-bottom: 8px;">Recent</div>
          <div class="list-box">
            ${props.runs.length === 0
              ? html`<div class="muted" style="padding: 12px;">No runs captured yet.</div>`
              : props.runs.map((run) =>
                  renderRunRow(run, run.runId === selected, () => props.onSelectRun(run.runId)),
                )}
          </div>
        </div>

        <div class="detail">
          <div class="row" style="justify-content: space-between;">
            <div>
              <div class="card-title">Replay</div>
              <div class="card-sub">
                ${selected ? html`Run: <span class="mono">${selected}</span>` : "Select a run on the left."}
              </div>
            </div>
            <div class="row" style="gap: 8px;">
              <button class="btn" ?disabled=${!selected || props.runLoading} @click=${props.onRefreshRun}>
                ${props.runLoading ? "Loading…" : "Reload"}
              </button>
            </div>
          </div>

          ${props.runError ? html`<div class="callout danger" style="margin-top: 10px;">${props.runError}</div>` : nothing}
          ${props.runTruncated
            ? html`<div class="callout" style="margin-top: 10px;">
                Trace truncated. Showing the latest window from disk.
              </div>`
            : nothing}

          ${selected
            ? html`
                <div class="row" style="margin-top: 12px; gap: 10px; align-items: end;">
                  <label class="field" style="min-width: 220px;">
                    <span>Replay</span>
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
                    ${replayIndex}/${eventsAll.length} events
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
                    ? html`<div class="muted" style="padding: 12px;">No events (filter/replay window).</div>`
                    : filtered.map((evt) => {
                        const label = deriveEventLabel(evt);
                        const summary = summarizeEvent(evt);
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


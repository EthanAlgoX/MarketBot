import { html, nothing } from "lit";

import type { UiLanguage } from "../storage";
import type { LogEntry, LogLevel } from "../types";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

export type LogsProps = {
  language?: UiLanguage;
  loading: boolean;
  error: string | null;
  file: string | null;
  entries: LogEntry[];
  filterText: string;
  levelFilters: Record<LogLevel, boolean>;
  autoFollow: boolean;
  truncated: boolean;
  onFilterTextChange: (next: string) => void;
  onLevelToggle: (level: LogLevel, enabled: boolean) => void;
  onToggleAutoFollow: (next: boolean) => void;
  onRefresh: () => void;
  onExport: (lines: string[], label: string) => void;
  onScroll: (event: Event) => void;
};

const LOGS_TEXT = {
  en: {
    filtered: "filtered",
    visible: "visible",
    title: "Logs",
    sub: "Gateway file logs (JSONL).",
    loading: "Loading…",
    refresh: "Refresh",
    export: "Export",
    filter: "Filter",
    searchPlaceholder: "Search logs",
    autoFollow: "Auto-follow",
    file: "File",
    truncated: "Log output truncated; showing latest chunk.",
    noEntries: "No log entries.",
  },
  zh: {
    filtered: "已筛选",
    visible: "可见",
    title: "日志",
    sub: "网关文件日志（JSONL）。",
    loading: "加载中…",
    refresh: "刷新",
    export: "导出",
    filter: "筛选",
    searchPlaceholder: "搜索日志",
    autoFollow: "自动跟随",
    file: "文件",
    truncated: "日志输出已截断，仅显示最新片段。",
    noEntries: "暂无日志。",
  },
} as const;

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString();
}

function matchesFilter(entry: LogEntry, needle: string) {
  if (!needle) return true;
  const haystack = [entry.message, entry.subsystem, entry.raw]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function renderLogs(props: LogsProps) {
  const language = props.language ?? "en";
  const text = LOGS_TEXT[language] ?? LOGS_TEXT.en;
  const needle = props.filterText.trim().toLowerCase();
  const levelFiltered = LEVELS.some((level) => !props.levelFilters[level]);
  const filtered = props.entries.filter((entry) => {
    if (entry.level && !props.levelFilters[entry.level]) return false;
    return matchesFilter(entry, needle);
  });
  const exportLabel = needle || levelFiltered ? text.filtered : text.visible;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${text.title}</div>
          <div class="card-sub">${text.sub}</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? text.loading : text.refresh}
          </button>
          <button
            class="btn"
            ?disabled=${filtered.length === 0}
            @click=${() => props.onExport(filtered.map((entry) => entry.raw), exportLabel)}
          >
            ${text.export} ${exportLabel}
          </button>
        </div>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="min-width: 220px;">
          <span>${text.filter}</span>
          <input
            .value=${props.filterText}
            @input=${(e: Event) =>
              props.onFilterTextChange((e.target as HTMLInputElement).value)}
            placeholder=${text.searchPlaceholder}
          />
        </label>
        <label class="field checkbox">
          <span>${text.autoFollow}</span>
          <input
            type="checkbox"
            .checked=${props.autoFollow}
            @change=${(e: Event) =>
              props.onToggleAutoFollow((e.target as HTMLInputElement).checked)}
          />
        </label>
      </div>

      <div class="chip-row" style="margin-top: 12px;">
        ${LEVELS.map(
          (level) => html`
            <label class="chip log-chip ${level}">
              <input
                type="checkbox"
                .checked=${props.levelFilters[level]}
                @change=${(e: Event) =>
                  props.onLevelToggle(level, (e.target as HTMLInputElement).checked)}
              />
              <span>${level}</span>
            </label>
          `,
        )}
      </div>

      ${props.file
        ? html`<div class="muted" style="margin-top: 10px;">${text.file}: ${props.file}</div>`
        : nothing}
      ${props.truncated
        ? html`<div class="callout" style="margin-top: 10px;">
            ${text.truncated}
          </div>`
        : nothing}
      ${props.error
        ? html`<div class="callout danger" style="margin-top: 10px;">${props.error}</div>`
        : nothing}

      <div class="log-stream" style="margin-top: 12px;" @scroll=${props.onScroll}>
        ${filtered.length === 0
          ? html`<div class="muted" style="padding: 12px;">${text.noEntries}</div>`
          : filtered.map(
              (entry) => html`
                <div class="log-row">
                  <div class="log-time mono">${formatTime(entry.time)}</div>
                  <div class="log-level ${entry.level ?? ""}">${entry.level ?? ""}</div>
                  <div class="log-subsystem mono">${entry.subsystem ?? ""}</div>
                  <div class="log-message mono">${entry.message ?? entry.raw}</div>
                </div>
              `,
            )}
      </div>
    </section>
  `;
}

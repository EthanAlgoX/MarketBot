import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { formatSessionTokens } from "../presenter";
import { pathForTab } from "../navigation";
import type { UiLanguage } from "../storage";
import type { GatewaySessionRow, SessionsListResult } from "../types";

export type SessionsProps = {
  language?: UiLanguage;
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  onFiltersChange: (next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onDelete: (key: string) => void;
};

const THINK_LEVELS = ["", "off", "minimal", "low", "medium", "high"] as const;
const BINARY_THINK_LEVELS = ["", "off", "on"] as const;
const REASONING_LEVELS = ["", "off", "on", "stream"] as const;

const SESSIONS_TEXT = {
  en: {
    title: "Sessions",
    sub: "Active session keys and per-session overrides.",
    loading: "Loading…",
    refresh: "Refresh",
    activeWithin: "Active within (minutes)",
    limit: "Limit",
    includeGlobal: "Include global",
    includeUnknown: "Include unknown",
    store: "Store",
    key: "Key",
    label: "Label",
    kind: "Kind",
    updated: "Updated",
    tokens: "Tokens",
    thinking: "Thinking",
    verbose: "Verbose",
    reasoning: "Reasoning",
    actions: "Actions",
    noSessions: "No sessions found.",
    notAvailable: "n/a",
    optional: "(optional)",
    inherit: "inherit",
    offExplicit: "off (explicit)",
    on: "on",
    delete: "Delete",
  },
  zh: {
    title: "会话",
    sub: "活跃会话键与每会话覆盖项。",
    loading: "加载中…",
    refresh: "刷新",
    activeWithin: "活跃时间（分钟）",
    limit: "数量上限",
    includeGlobal: "包含全局",
    includeUnknown: "包含未知",
    store: "存储路径",
    key: "键",
    label: "标签",
    kind: "类型",
    updated: "更新时间",
    tokens: "Token",
    thinking: "思考",
    verbose: "详细级别",
    reasoning: "推理",
    actions: "操作",
    noSessions: "未找到会话。",
    notAvailable: "暂无",
    optional: "（可选）",
    inherit: "继承",
    offExplicit: "关闭（显式）",
    on: "开启",
    delete: "删除",
  },
} as const;

function resolveVerboseLevels(text: (typeof SESSIONS_TEXT)["en"]) {
  return [
    { value: "", label: text.inherit },
    { value: "off", label: text.offExplicit },
    { value: "on", label: text.on },
  ] as const;
}

function normalizeProviderId(provider?: string | null): string {
  if (!provider) return "";
  const normalized = provider.trim().toLowerCase();
  if (normalized === "z.ai" || normalized === "z-ai") return "zai";
  return normalized;
}

function isBinaryThinkingProvider(provider?: string | null): boolean {
  return normalizeProviderId(provider) === "zai";
}

function resolveThinkLevelOptions(provider?: string | null): readonly string[] {
  return isBinaryThinkingProvider(provider) ? BINARY_THINK_LEVELS : THINK_LEVELS;
}

function resolveThinkLevelDisplay(value: string, isBinary: boolean): string {
  if (!isBinary) return value;
  if (!value || value === "off") return value;
  return "on";
}

function resolveThinkLevelPatchValue(value: string, isBinary: boolean): string | null {
  if (!value) return null;
  if (!isBinary) return value;
  if (value === "on") return "low";
  return value;
}

export function renderSessions(props: SessionsProps) {
  const language = props.language ?? "en";
  const text = SESSIONS_TEXT[language] ?? SESSIONS_TEXT.en;
  const verboseLevels = resolveVerboseLevels(text);
  const rows = props.result?.sessions ?? [];
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${text.title}</div>
          <div class="card-sub">${text.sub}</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? text.loading : text.refresh}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field">
          <span>${text.activeWithin}</span>
          <input
            .value=${props.activeMinutes}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: (e.target as HTMLInputElement).value,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field">
          <span>${text.limit}</span>
          <input
            .value=${props.limit}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: (e.target as HTMLInputElement).value,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field checkbox">
          <span>${text.includeGlobal}</span>
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: (e.target as HTMLInputElement).checked,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field checkbox">
          <span>${text.includeUnknown}</span>
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: (e.target as HTMLInputElement).checked,
              })}
          />
        </label>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      <div class="muted" style="margin-top: 12px;">
        ${props.result ? `${text.store}: ${props.result.path}` : ""}
      </div>

      <div class="table" style="margin-top: 16px;">
        <div class="table-head">
          <div>${text.key}</div>
          <div>${text.label}</div>
          <div>${text.kind}</div>
          <div>${text.updated}</div>
          <div>${text.tokens}</div>
          <div>${text.thinking}</div>
          <div>${text.verbose}</div>
          <div>${text.reasoning}</div>
          <div>${text.actions}</div>
        </div>
        ${rows.length === 0
          ? html`<div class="muted">${text.noSessions}</div>`
          : rows.map((row) =>
              renderRow(
                row,
                props.basePath,
                props.onPatch,
                props.onDelete,
                props.loading,
                text,
                verboseLevels,
              ),
            )}
      </div>
    </section>
  `;
}

function renderRow(
  row: GatewaySessionRow,
  basePath: string,
  onPatch: SessionsProps["onPatch"],
  onDelete: SessionsProps["onDelete"],
  disabled: boolean,
  text: (typeof SESSIONS_TEXT)["en"],
  verboseLevels: ReturnType<typeof resolveVerboseLevels>,
) {
  const updated = row.updatedAt ? formatAgo(row.updatedAt) : text.notAvailable;
  const rawThinking = row.thinkingLevel ?? "";
  const isBinaryThinking = isBinaryThinkingProvider(row.modelProvider);
  const thinking = resolveThinkLevelDisplay(rawThinking, isBinaryThinking);
  const thinkLevels = resolveThinkLevelOptions(row.modelProvider);
  const verbose = row.verboseLevel ?? "";
  const reasoning = row.reasoningLevel ?? "";
  const displayName = row.displayName ?? row.key;
  const canLink = row.kind !== "global";
  const chatUrl = canLink
    ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(row.key)}`
    : null;

  return html`
    <div class="table-row">
      <div class="mono">${canLink
        ? html`<a href=${chatUrl} class="session-link">${displayName}</a>`
        : displayName}</div>
      <div>
        <input
          .value=${row.label ?? ""}
          ?disabled=${disabled}
          placeholder=${text.optional}
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value.trim();
            onPatch(row.key, { label: value || null });
          }}
        />
      </div>
      <div>${row.kind}</div>
      <div>${updated}</div>
      <div>${formatSessionTokens(row)}</div>
      <div>
        <select
          .value=${thinking}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, {
              thinkingLevel: resolveThinkLevelPatchValue(value, isBinaryThinking),
            });
          }}
        >
          ${thinkLevels.map((level) =>
            html`<option value=${level}>${level || text.inherit}</option>`,
          )}
        </select>
      </div>
      <div>
        <select
          .value=${verbose}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { verboseLevel: value || null });
          }}
        >
          ${verboseLevels.map(
            (level) => html`<option value=${level.value}>${level.label}</option>`,
          )}
        </select>
      </div>
      <div>
        <select
          .value=${reasoning}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { reasoningLevel: value || null });
          }}
        >
          ${REASONING_LEVELS.map((level) =>
            html`<option value=${level}>${level || text.inherit}</option>`,
          )}
        </select>
      </div>
      <div>
        <button class="btn danger" ?disabled=${disabled} @click=${() => onDelete(row.key)}>
          ${text.delete}
        </button>
      </div>
    </div>
  `;
}

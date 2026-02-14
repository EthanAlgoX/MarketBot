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
    sessionsCount: "Session Count",
    defaultModel: "Default Model",
    defaultContext: "Default Context",
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
    sessionsCount: "会话总数",
    defaultModel: "默认模型",
    defaultContext: "默认上下文",
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
  const defaultsModel = props.result?.defaults?.model ?? "";
  const defaultsContext = props.result?.defaults?.contextTokens;
  const count = props.result?.count ?? rows.length;
  const nextFilters = (patch: Partial<{
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }>) =>
    props.onFiltersChange({
      activeMinutes: patch.activeMinutes ?? props.activeMinutes,
      limit: patch.limit ?? props.limit,
      includeGlobal: patch.includeGlobal ?? props.includeGlobal,
      includeUnknown: patch.includeUnknown ?? props.includeUnknown,
    });

  return html`
    <section class="card sessions-layout">
      <div class="row sessions-header">
        <div>
          <div class="card-title">${text.title}</div>
          <div class="card-sub">${text.sub}</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? text.loading : text.refresh}
        </button>
      </div>

      <div class="sessions-filters">
        <label class="field sessions-filter-field">
          <span>${text.activeWithin}</span>
          <input
            .value=${props.activeMinutes}
            @input=${(e: Event) =>
              nextFilters({
                activeMinutes: (e.target as HTMLInputElement).value,
              })}
          />
        </label>
        <label class="field sessions-filter-field">
          <span>${text.limit}</span>
          <input
            .value=${props.limit}
            @input=${(e: Event) =>
              nextFilters({
                limit: (e.target as HTMLInputElement).value,
              })}
          />
        </label>
        <label class="sessions-check sessions-check--tile">
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e: Event) =>
              nextFilters({
                includeGlobal: (e.target as HTMLInputElement).checked,
              })}
          />
          <span>${text.includeGlobal}</span>
        </label>
        <label class="sessions-check sessions-check--tile">
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e: Event) =>
              nextFilters({
                includeUnknown: (e.target as HTMLInputElement).checked,
              })}
          />
          <span>${text.includeUnknown}</span>
        </label>
      </div>

      ${props.error
        ? html`<div class="callout danger sessions-error">${props.error}</div>`
        : nothing}

      ${props.result
        ? html`
          <div class="sessions-summary">
            <div class="stat-grid sessions-summary-grid">
              <div class="stat">
                <div class="stat-label">${text.sessionsCount}</div>
                <div class="stat-value mono">${count}</div>
              </div>
              <div class="stat">
                <div class="stat-label">${text.defaultModel}</div>
                <div class="stat-value mono">${defaultsModel || text.inherit}</div>
              </div>
              <div class="stat">
                <div class="stat-label">${text.defaultContext}</div>
                <div class="stat-value mono">
                  ${typeof defaultsContext === "number" && Number.isFinite(defaultsContext)
                    ? String(defaultsContext)
                    : text.notAvailable}
                </div>
              </div>
            </div>
            <div class="sessions-store">
              <span class="label">${text.store}</span>
              <span class="mono sessions-store__path">${props.result.path}</span>
            </div>
          </div>
          `
        : nothing}

      <div class="sessions-list">
        ${rows.length === 0
          ? html`<div class="sessions-empty muted">${text.noSessions}</div>`
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
  const contextLine = [row.surface, row.space, row.room, row.subject]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" · ");

  return html`
    <article class="sessions-item">
      <div class="sessions-item__head">
        <div class="sessions-item__identity">
          <div class="mono sessions-item__key">
            ${canLink
              ? html`<a href=${chatUrl} class="session-link">${displayName}</a>`
              : displayName}
          </div>
          ${contextLine
            ? html`<div class="muted sessions-item__context">${contextLine}</div>`
            : nothing}
        </div>
        <div class="sessions-item__meta">
          <span class="chip sessions-chip">${text.kind}: ${row.kind}</span>
          <span class="chip sessions-chip">${text.updated}: ${updated}</span>
          <span class="chip sessions-chip">${text.tokens}: ${formatSessionTokens(row)}</span>
        </div>
      </div>

      <div class="sessions-controls">
        <label class="field sessions-control sessions-control--label">
          <span>${text.label}</span>
          <input
            .value=${row.label ?? ""}
            ?disabled=${disabled}
            placeholder=${text.optional}
            @change=${(e: Event) => {
              const value = (e.target as HTMLInputElement).value.trim();
              onPatch(row.key, { label: value || null });
            }}
          />
        </label>

        <div class="sessions-controls__row">
          <label class="field sessions-control">
            <span>${text.thinking}</span>
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
          </label>

          <label class="field sessions-control">
            <span>${text.verbose}</span>
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
          </label>

          <label class="field sessions-control">
            <span>${text.reasoning}</span>
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
          </label>

          <div class="sessions-control sessions-control--actions">
            <button class="btn danger btn--sm" ?disabled=${disabled} @click=${() => onDelete(row.key)}>
              ${text.delete}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

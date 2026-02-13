import { html, nothing } from "lit";

import { icons } from "../icons";
import type { UiLanguage } from "../storage";
import type { ConfigUiHints } from "../types";
import { renderConfigForm, SECTION_META } from "./config-form";
import { hintForPath, humanize, schemaType, type JsonSchema } from "./config-form.shared";

export type ConfigProps = {
  language?: UiLanguage;
  raw: string;
  originalRaw: string;
  valid: boolean | null;
  issues: unknown[];
  loading: boolean;
  saving: boolean;
  applying: boolean;
  updating: boolean;
  connected: boolean;
  schema: JsonSchema | null;
  schemaLoading: boolean;
  uiHints: ConfigUiHints;
  formMode: "form" | "raw";
  formValue: Record<string, unknown> | null;
  originalValue: Record<string, unknown> | null;
  searchQuery: string;
  activeSection: string | null;
  activeSubsection: string | null;
  onRawChange: (next: string) => void;
  onFormModeChange: (next: "form" | "raw") => void;
  onFormPatch: (path: Array<string | number>, value: unknown) => void;
  onSearchChange: (next: string) => void;
  onSectionChange: (next: string | null) => void;
  onSubsectionChange: (next: string | null) => void;
  onReload: () => void;
  onSave: () => void;
  onApply: () => void;
  onUpdate: () => void;
};

const CONFIG_TEXT = {
  en: {
    saving: "Saving…",
    save: "Save",
    applying: "Applying…",
    apply: "Apply",
    updating: "Updating…",
    update: "Update",
    disconnected: "Disconnected",
    validationUnknown: "Validation unknown",
    valid: "Config valid",
    invalid: "Config invalid",
    title: "Configuration",
    searchPlaceholder: "Search settings",
    clearSearch: "Clear search",
    all: "All",
    noSchemaLoaded: "No schema loaded.",
    form: "Form",
    raw: "Raw",
    unsaved: "Unsaved changes",
    reload: "Reload",
    allSettings: "All settings",
    allSettingsDesc: "Configure AI models, tools, channels, and gateway settings.",
    loading: "Loading configuration…",
    rawConfig: "Raw config",
  },
  zh: {
    saving: "保存中…",
    save: "保存",
    applying: "应用中…",
    apply: "应用",
    updating: "更新中…",
    update: "更新",
    disconnected: "未连接",
    validationUnknown: "校验状态未知",
    valid: "配置有效",
    invalid: "配置无效",
    title: "配置",
    searchPlaceholder: "搜索设置",
    clearSearch: "清空搜索",
    all: "全部",
    noSchemaLoaded: "未加载配置 Schema。",
    form: "表单",
    raw: "原始",
    unsaved: "有未保存更改",
    reload: "重新加载",
    allSettings: "全部设置",
    allSettingsDesc: "配置 AI 模型、工具、渠道与网关设置。",
    loading: "正在加载配置…",
    rawConfig: "原始配置",
  },
} as const;

function jsonEqual(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

function resolveSchemaSections(
  schema: JsonSchema | null,
  hints: ConfigUiHints,
) {
  if (!schema || schemaType(schema) !== "object" || !schema.properties) return [];
  return Object.entries(schema.properties)
    .map(([key, node]) => ({
      key,
      node,
      label:
        hintForPath([key], hints)?.label ??
        SECTION_META[key]?.label ??
        humanize(key),
      description:
        hintForPath([key], hints)?.help ??
        SECTION_META[key]?.description ??
        node.description ??
        "",
      order: hintForPath([key], hints)?.order ?? 50,
    }))
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.key.localeCompare(b.key)));
}

function resolveSubsections(
  schema: JsonSchema | null,
  sectionKey: string,
  hints: ConfigUiHints,
) {
  if (!schema || schemaType(schema) !== "object" || !schema.properties) return [];
  const section = schema.properties[sectionKey];
  if (!section || schemaType(section) !== "object" || !section.properties) return [];
  return Object.entries(section.properties)
    .map(([key, node]) => ({
      key,
      label: hintForPath([sectionKey, key], hints)?.label ?? node.title ?? humanize(key),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function renderConfig(props: ConfigProps) {
  const language = props.language ?? "en";
  const text = CONFIG_TEXT[language] ?? CONFIG_TEXT.en;
  const schema = props.schema ?? null;
  const sections = resolveSchemaSections(schema, props.uiHints);
  const rawDirty = props.raw.trim() !== props.originalRaw.trim();
  const formDirty = !jsonEqual(props.formValue, props.originalValue);
  const isDirty = props.formMode === "raw" ? rawDirty : formDirty;
  const schemaReady = Boolean(schema && schemaType(schema) === "object");
  const saveDisabled =
    props.saving ||
    props.applying ||
    props.updating ||
    !props.connected ||
    !isDirty ||
    (props.formMode === "form" && !schemaReady);
  const applyDisabled = saveDisabled;
  const saveLabel = props.saving ? text.saving : text.save;
  const applyLabel = props.applying ? text.applying : text.apply;
  const updateLabel = props.updating ? text.updating : text.update;
  const hasSections = sections.length > 0;
  const activeSection = props.activeSection;
  const activeSubsection = props.activeSubsection;
  const subsectionOptions =
    activeSection && schemaReady
      ? resolveSubsections(schema, activeSection, props.uiHints)
      : [];

  const statusLabel = (() => {
    if (!props.connected) return text.disconnected;
    if (props.valid == null) return text.validationUnknown;
    if (props.valid) return text.valid;
    return text.invalid;
  })();

  return html`
    <div class="config-layout">
      <aside class="config-sidebar">
        <div class="config-sidebar__header">
          <div class="config-sidebar__title">${text.title}</div>
        </div>
        <div class="config-search">
          <span class="config-search__icon">${icons.search}</span>
          <input
            class="config-search__input"
            type="search"
            placeholder=${text.searchPlaceholder}
            .value=${props.searchQuery}
            @input=${(event: Event) =>
              props.onSearchChange((event.target as HTMLInputElement).value)}
          />
          ${props.searchQuery
            ? html`
                <button
                  class="config-search__clear"
                  @click=${() => props.onSearchChange("")}
                  aria-label=${text.clearSearch}
                >
                  ×
                </button>
              `
            : nothing}
        </div>
        <nav class="config-nav">
          <button
            class="config-nav__item ${!activeSection ? "active" : ""}"
            @click=${() => props.onSectionChange(null)}
          >
            <span class="config-nav__icon">${icons.settings}</span>
            <span class="config-nav__label">${text.all}</span>
          </button>
          ${sections.map(
            (section) => html`
              <button
                class="config-nav__item ${activeSection === section.key ? "active" : ""}"
                @click=${() =>
                  props.onSectionChange(
                    activeSection === section.key ? null : section.key,
                  )}
              >
                <span class="config-nav__icon">${icons.settings}</span>
                <span class="config-nav__label">${section.label}</span>
              </button>
            `,
          )}
          ${!hasSections && !props.schemaLoading
            ? html`<div class="muted" style="padding: 10px 14px;">${text.noSchemaLoaded}</div>`
            : nothing}
        </nav>
        <div class="config-sidebar__footer">
          <div class="config-mode-toggle">
            <button
              class="config-mode-toggle__btn ${props.formMode === "form" ? "active" : ""}"
              @click=${() => props.onFormModeChange("form")}
            >
              ${text.form}
            </button>
            <button
              class="config-mode-toggle__btn ${props.formMode === "raw" ? "active" : ""}"
              @click=${() => props.onFormModeChange("raw")}
            >
              ${text.raw}
            </button>
          </div>
        </div>
      </aside>

      <section class="config-main">
        <div class="config-actions">
          <div class="config-actions__left">
            ${isDirty ? html`<span class="config-changes-badge">${text.unsaved}</span>` : nothing}
            <span class="config-status">${statusLabel}</span>
          </div>
          <div class="config-actions__right">
            <button class="btn" @click=${() => props.onReload()}>
              ${text.reload}
            </button>
            <button
              class="btn"
              ?disabled=${props.updating || !props.connected}
              @click=${() => props.onUpdate()}
            >
              ${updateLabel}
            </button>
            <button class="btn" ?disabled=${saveDisabled} @click=${() => props.onSave()}>
              ${saveLabel}
            </button>
            <button
              class="btn primary"
              ?disabled=${applyDisabled}
              @click=${() => props.onApply()}
            >
              ${applyLabel}
            </button>
          </div>
        </div>

        <div class="config-section-hero">
          <div class="config-section-hero__icon">${icons.settings}</div>
          <div class="config-section-hero__text">
            <div class="config-section-hero__title">
              ${activeSection
                ? SECTION_META[activeSection]?.label ?? humanize(activeSection)
                : text.allSettings}
            </div>
            <div class="config-section-hero__desc">
              ${activeSection
                ? SECTION_META[activeSection]?.description ?? ""
                : text.allSettingsDesc}
            </div>
          </div>
        </div>

        ${activeSection && subsectionOptions.length
          ? html`
              <div class="config-subnav">
                <button
                  class="config-subnav__item ${!activeSubsection ? "active" : ""}"
                  @click=${() => props.onSubsectionChange(null)}
                >
                  ${text.all}
                </button>
                ${subsectionOptions.map(
                  (entry) => html`
                    <button
                      class="config-subnav__item ${activeSubsection === entry.key ? "active" : ""}"
                      @click=${() =>
                        props.onSubsectionChange(
                          activeSubsection === entry.key ? null : entry.key,
                        )}
                    >
                      ${entry.label}
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}

        <div class="config-content">
          ${props.loading || props.schemaLoading
            ? html`
                <div class="config-loading">
                  <div class="config-loading__spinner"></div>
                  <div>${text.loading}</div>
                </div>
              `
            : props.formMode === "raw"
              ? html`
                  <div class="config-raw-field field">
                    <label class="field">
                      <span>${text.rawConfig}</span>
                      <textarea
                        class="mono"
                        .value=${props.raw}
                        @input=${(event: Event) =>
                          props.onRawChange((event.target as HTMLTextAreaElement).value)}
                      ></textarea>
                    </label>
                  </div>
                `
              : renderConfigForm({
                  schema,
                  uiHints: props.uiHints,
                  value: props.formValue,
                  disabled: props.saving || props.applying,
                  searchQuery: props.searchQuery,
                  activeSection: props.activeSection,
                  activeSubsection: props.activeSubsection,
                  onPatch: props.onFormPatch,
                })}
        </div>
      </section>
    </div>
  `;
}

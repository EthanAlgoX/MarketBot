import { html, nothing } from "lit";

import { icons } from "../icons";
import type { ConfigUiHints } from "../types";
import { renderConfigForm, SECTION_META } from "./config-form";
import { hintForPath, humanize, schemaType, type JsonSchema } from "./config-form.shared";

export type ConfigProps = {
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
  const saveLabel = props.saving ? "Saving…" : "Save";
  const applyLabel = props.applying ? "Applying…" : "Apply";
  const updateLabel = props.updating ? "Updating…" : "Update";
  const hasSections = sections.length > 0;
  const activeSection = props.activeSection;
  const activeSubsection = props.activeSubsection;
  const subsectionOptions =
    activeSection && schemaReady
      ? resolveSubsections(schema, activeSection, props.uiHints)
      : [];

  const statusLabel = (() => {
    if (!props.connected) return "Disconnected";
    if (props.valid == null) return "Validation unknown";
    if (props.valid) return "Config valid";
    return "Config invalid";
  })();

  return html`
    <div class="config-layout">
      <aside class="config-sidebar">
        <div class="config-sidebar__header">
          <div class="config-sidebar__title">Configuration</div>
        </div>
        <div class="config-search">
          <span class="config-search__icon">${icons.search}</span>
          <input
            class="config-search__input"
            type="search"
            placeholder="Search settings"
            .value=${props.searchQuery}
            @input=${(event: Event) =>
              props.onSearchChange((event.target as HTMLInputElement).value)}
          />
          ${props.searchQuery
            ? html`
                <button
                  class="config-search__clear"
                  @click=${() => props.onSearchChange("")}
                  aria-label="Clear search"
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
            <span class="config-nav__label">All</span>
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
            ? html`<div class="muted" style="padding: 10px 14px;">No schema loaded.</div>`
            : nothing}
        </nav>
        <div class="config-sidebar__footer">
          <div class="config-mode-toggle">
            <button
              class="config-mode-toggle__btn ${props.formMode === "form" ? "active" : ""}"
              @click=${() => props.onFormModeChange("form")}
            >
              Form
            </button>
            <button
              class="config-mode-toggle__btn ${props.formMode === "raw" ? "active" : ""}"
              @click=${() => props.onFormModeChange("raw")}
            >
              Raw
            </button>
          </div>
        </div>
      </aside>

      <section class="config-main">
        <div class="config-actions">
          <div class="config-actions__left">
            ${isDirty ? html`<span class="config-changes-badge">Unsaved changes</span>` : nothing}
            <span class="config-status">${statusLabel}</span>
          </div>
          <div class="config-actions__right">
            <button class="btn" @click=${() => props.onReload()}>
              Reload
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
                : "All settings"}
            </div>
            <div class="config-section-hero__desc">
              ${activeSection
                ? SECTION_META[activeSection]?.description ?? ""
                : "Configure AI models, tools, channels, and gateway settings."}
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
                  All
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
                  <div>Loading configuration…</div>
                </div>
              `
            : props.formMode === "raw"
              ? html`
                  <div class="config-raw-field field">
                    <label class="field">
                      <span>Raw config</span>
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

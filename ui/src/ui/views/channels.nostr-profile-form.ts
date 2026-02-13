/**
 * Nostr Profile Edit Form
 *
 * Provides UI for editing and publishing Nostr profile (kind:0).
 */

import { html, nothing, type TemplateResult } from "lit";

import type { UiLanguage } from "../storage";
import type { NostrProfile as NostrProfileType } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface NostrProfileFormState {
  /** Current form values */
  values: NostrProfileType;
  /** Original values for dirty detection */
  original: NostrProfileType;
  /** Whether the form is currently submitting */
  saving: boolean;
  /** Whether import is in progress */
  importing: boolean;
  /** Last error message */
  error: string | null;
  /** Last success message */
  success: string | null;
  /** Validation errors per field */
  fieldErrors: Record<string, string>;
  /** Whether to show advanced fields */
  showAdvanced: boolean;
}

export interface NostrProfileFormCallbacks {
  /** Called when a field value changes */
  onFieldChange: (field: keyof NostrProfileType, value: string) => void;
  /** Called when save is clicked */
  onSave: () => void;
  /** Called when import is clicked */
  onImport: () => void;
  /** Called when cancel is clicked */
  onCancel: () => void;
  /** Called when toggle advanced is clicked */
  onToggleAdvanced: () => void;
}

const PROFILE_FORM_TEXT = {
  en: {
    profilePicturePreview: "Profile picture preview",
    editProfile: "Edit Profile",
    account: "Account",
    username: "Username",
    displayName: "Display Name",
    bio: "Bio",
    avatarUrl: "Avatar URL",
    shortUsername: "Short username (e.g., satoshi)",
    fullDisplayName: "Your full display name",
    bioHelp: "A brief bio or description",
    pictureHelp: "HTTPS URL to your profile picture",
    advanced: "Advanced",
    bannerUrl: "Banner URL",
    website: "Website",
    nip05: "NIP-05 Identifier",
    lightningAddress: "Lightning Address",
    bannerHelp: "HTTPS URL to a banner image",
    websiteHelp: "Your personal website",
    nip05Help: "Verifiable identifier (e.g., you@domain.com)",
    lightningHelp: "Lightning address for tips (LUD-16)",
    saving: "Saving...",
    saveAndPublish: "Save & Publish",
    importing: "Importing...",
    importFromRelays: "Import from Relays",
    hideAdvanced: "Hide Advanced",
    showAdvanced: "Show Advanced",
    cancel: "Cancel",
    unsaved: "You have unsaved changes",
    satoshi: "satoshi",
    satoshiNakamoto: "Satoshi Nakamoto",
    bioPlaceholder: "Tell people about yourself...",
    avatarPlaceholder: "https://example.com/avatar.jpg",
    bannerPlaceholder: "https://example.com/banner.jpg",
    websitePlaceholder: "https://example.com",
    nip05Placeholder: "you@example.com",
    lightningPlaceholder: "you@getalby.com",
  },
  zh: {
    profilePicturePreview: "资料头像预览",
    editProfile: "编辑资料",
    account: "账号",
    username: "用户名",
    displayName: "显示名",
    bio: "简介",
    avatarUrl: "头像 URL",
    shortUsername: "简短用户名（例如 satoshi）",
    fullDisplayName: "完整显示名称",
    bioHelp: "简要个人介绍",
    pictureHelp: "资料头像的 HTTPS 地址",
    advanced: "高级",
    bannerUrl: "横幅 URL",
    website: "网站",
    nip05: "NIP-05 标识",
    lightningAddress: "闪电地址",
    bannerHelp: "横幅图片的 HTTPS 地址",
    websiteHelp: "你的个人网站",
    nip05Help: "可验证标识（例如 you@domain.com）",
    lightningHelp: "用于打赏的闪电地址（LUD-16）",
    saving: "保存中...",
    saveAndPublish: "保存并发布",
    importing: "导入中...",
    importFromRelays: "从中继导入",
    hideAdvanced: "隐藏高级项",
    showAdvanced: "显示高级项",
    cancel: "取消",
    unsaved: "你有未保存的更改",
    satoshi: "satoshi",
    satoshiNakamoto: "Satoshi Nakamoto",
    bioPlaceholder: "介绍一下你自己...",
    avatarPlaceholder: "https://example.com/avatar.jpg",
    bannerPlaceholder: "https://example.com/banner.jpg",
    websitePlaceholder: "https://example.com",
    nip05Placeholder: "you@example.com",
    lightningPlaceholder: "you@getalby.com",
  },
} as const;

// ============================================================================
// Helpers
// ============================================================================

function isFormDirty(state: NostrProfileFormState): boolean {
  const { values, original } = state;
  return (
    values.name !== original.name ||
    values.displayName !== original.displayName ||
    values.about !== original.about ||
    values.picture !== original.picture ||
    values.banner !== original.banner ||
    values.website !== original.website ||
    values.nip05 !== original.nip05 ||
    values.lud16 !== original.lud16
  );
}

// ============================================================================
// Form Rendering
// ============================================================================

export function renderNostrProfileForm(params: {
  state: NostrProfileFormState;
  callbacks: NostrProfileFormCallbacks;
  accountId: string;
  language?: UiLanguage;
}): TemplateResult {
  const { state, callbacks, accountId } = params;
  const text = PROFILE_FORM_TEXT[params.language === "zh" ? "zh" : "en"];
  const isDirty = isFormDirty(state);

  const renderField = (
    field: keyof NostrProfileType,
    label: string,
    opts: {
      type?: "text" | "url" | "textarea";
      placeholder?: string;
      maxLength?: number;
      help?: string;
    } = {}
  ) => {
    const { type = "text", placeholder, maxLength, help } = opts;
    const value = state.values[field] ?? "";
    const error = state.fieldErrors[field];

    const inputId = `nostr-profile-${field}`;

    if (type === "textarea") {
      return html`
        <div class="form-field" style="margin-bottom: 12px;">
          <label for="${inputId}" style="display: block; margin-bottom: 4px; font-weight: 500;">
            ${label}
          </label>
          <textarea
            id="${inputId}"
            .value=${value}
            placeholder=${placeholder ?? ""}
            maxlength=${maxLength ?? 2000}
            rows="3"
            style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; resize: vertical; font-family: inherit;"
            @input=${(e: InputEvent) => {
              const target = e.target as HTMLTextAreaElement;
              callbacks.onFieldChange(field, target.value);
            }}
            ?disabled=${state.saving}
          ></textarea>
          ${help ? html`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${help}</div>` : nothing}
          ${error ? html`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${error}</div>` : nothing}
        </div>
      `;
    }

    return html`
      <div class="form-field" style="margin-bottom: 12px;">
        <label for="${inputId}" style="display: block; margin-bottom: 4px; font-weight: 500;">
          ${label}
        </label>
        <input
          id="${inputId}"
          type=${type}
          .value=${value}
          placeholder=${placeholder ?? ""}
          maxlength=${maxLength ?? 256}
          style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;"
          @input=${(e: InputEvent) => {
            const target = e.target as HTMLInputElement;
            callbacks.onFieldChange(field, target.value);
          }}
          ?disabled=${state.saving}
        />
        ${help ? html`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${help}</div>` : nothing}
        ${error ? html`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${error}</div>` : nothing}
      </div>
    `;
  };

  const renderPicturePreview = () => {
    const picture = state.values.picture;
    if (!picture) return nothing;

    return html`
      <div style="margin-bottom: 12px;">
        <img
          src=${picture}
          alt=${text.profilePicturePreview}
          style="max-width: 80px; max-height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
          @error=${(e: Event) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
          }}
          @load=${(e: Event) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "block";
          }}
        />
      </div>
    `;
  };

  return html`
    <div class="nostr-profile-form" style="padding: 16px; background: var(--bg-secondary); border-radius: 8px; margin-top: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 16px;">${text.editProfile}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${text.account}: ${accountId}</div>
      </div>

      ${state.error
        ? html`<div class="callout danger" style="margin-bottom: 12px;">${state.error}</div>`
        : nothing}

      ${state.success
        ? html`<div class="callout success" style="margin-bottom: 12px;">${state.success}</div>`
        : nothing}

      ${renderPicturePreview()}

      ${renderField("name", text.username, {
        placeholder: text.satoshi,
        maxLength: 256,
        help: text.shortUsername,
      })}

      ${renderField("displayName", text.displayName, {
        placeholder: text.satoshiNakamoto,
        maxLength: 256,
        help: text.fullDisplayName,
      })}

      ${renderField("about", text.bio, {
        type: "textarea",
        placeholder: text.bioPlaceholder,
        maxLength: 2000,
        help: text.bioHelp,
      })}

      ${renderField("picture", text.avatarUrl, {
        type: "url",
        placeholder: text.avatarPlaceholder,
        help: text.pictureHelp,
      })}

      ${state.showAdvanced
        ? html`
            <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 12px; color: var(--text-muted);">${text.advanced}</div>

              ${renderField("banner", text.bannerUrl, {
                type: "url",
                placeholder: text.bannerPlaceholder,
                help: text.bannerHelp,
              })}

              ${renderField("website", text.website, {
                type: "url",
                placeholder: text.websitePlaceholder,
                help: text.websiteHelp,
              })}

              ${renderField("nip05", text.nip05, {
                placeholder: text.nip05Placeholder,
                help: text.nip05Help,
              })}

              ${renderField("lud16", text.lightningAddress, {
                placeholder: text.lightningPlaceholder,
                help: text.lightningHelp,
              })}
            </div>
          `
        : nothing}

      <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
        <button
          class="btn primary"
          @click=${callbacks.onSave}
          ?disabled=${state.saving || !isDirty}
        >
          ${state.saving ? text.saving : text.saveAndPublish}
        </button>

        <button
          class="btn"
          @click=${callbacks.onImport}
          ?disabled=${state.importing || state.saving}
        >
          ${state.importing ? text.importing : text.importFromRelays}
        </button>

        <button
          class="btn"
          @click=${callbacks.onToggleAdvanced}
        >
          ${state.showAdvanced ? text.hideAdvanced : text.showAdvanced}
        </button>

        <button
          class="btn"
          @click=${callbacks.onCancel}
          ?disabled=${state.saving}
        >
          ${text.cancel}
        </button>
      </div>

      ${isDirty
        ? html`<div style="font-size: 12px; color: var(--warning-color); margin-top: 8px;">
            ${text.unsaved}
          </div>`
        : nothing}
    </div>
  `;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create initial form state from existing profile
 */
export function createNostrProfileFormState(
  profile: NostrProfileType | undefined
): NostrProfileFormState {
  const values: NostrProfileType = {
    name: profile?.name ?? "",
    displayName: profile?.displayName ?? "",
    about: profile?.about ?? "",
    picture: profile?.picture ?? "",
    banner: profile?.banner ?? "",
    website: profile?.website ?? "",
    nip05: profile?.nip05 ?? "",
    lud16: profile?.lud16 ?? "",
  };

  return {
    values,
    original: { ...values },
    saving: false,
    importing: false,
    error: null,
    success: null,
    fieldErrors: {},
    showAdvanced: Boolean(
      profile?.banner || profile?.website || profile?.nip05 || profile?.lud16
    ),
  };
}

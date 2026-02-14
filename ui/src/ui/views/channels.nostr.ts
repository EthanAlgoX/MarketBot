import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { ChannelAccountSnapshot, NostrStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";
import {
  renderNostrProfileForm,
  type NostrProfileFormState,
  type NostrProfileFormCallbacks,
} from "./channels.nostr-profile-form";

const NOSTR_TEXT = {
  en: {
    cardSub: "Decentralized DMs via Nostr relays (NIP-04).",
    publicKey: "Public Key",
    profile: "Profile",
    editProfile: "Edit Profile",
    name: "Name",
    displayName: "Display Name",
    about: "About",
    noProfile: "No profile set. Click \"Edit Profile\" to add your name, bio, and avatar.",
  },
  zh: {
    cardSub: "通过 Nostr 中继进行去中心化私信（NIP-04）。",
    publicKey: "公钥",
    profile: "资料",
    editProfile: "编辑资料",
    name: "用户名",
    displayName: "显示名",
    about: "简介",
    noProfile: "尚未设置资料。点击“编辑资料”添加姓名、简介和头像。",
  },
} as const;

function truncatePubkey(pubkey: string | null | undefined, notAvailable: string): string {
  if (!pubkey) return notAvailable;
  if (pubkey.length <= 20) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

export function renderNostrCard(params: {
  props: ChannelsProps;
  nostr?: NostrStatus | null;
  nostrAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
  profileFormState?: NostrProfileFormState | null;
  profileFormCallbacks?: NostrProfileFormCallbacks | null;
  onEditProfile?: () => void;
}) {
  const {
    props,
    nostr,
    nostrAccounts,
    accountCountLabel,
    profileFormState,
    profileFormCallbacks,
    onEditProfile,
  } = params;
  const baseText = resolveChannelsText(props);
  const text = NOSTR_TEXT[props.language === "zh" ? "zh" : "en"];

  const primaryAccount = nostrAccounts[0];
  const summaryConfigured = nostr?.configured ?? primaryAccount?.configured ?? false;
  const summaryRunning = nostr?.running ?? primaryAccount?.running ?? false;
  const summaryPublicKey =
    nostr?.publicKey ??
    (primaryAccount as { publicKey?: string } | undefined)?.publicKey;
  const summaryLastStartAt = nostr?.lastStartAt ?? primaryAccount?.lastStartAt ?? null;
  const summaryLastError = nostr?.lastError ?? primaryAccount?.lastError ?? null;
  const hasMultipleAccounts = nostrAccounts.length > 1;
  const showingForm = profileFormState !== null && profileFormState !== undefined;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const publicKey = (account as { publicKey?: string }).publicKey;
    const profile = (account as { profile?: { name?: string; displayName?: string } }).profile;
    const displayName = profile?.displayName ?? profile?.name ?? account.name ?? account.accountId;

    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${displayName}</div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${baseText.running}</span>
            <span>${account.running ? baseText.yes : baseText.no}</span>
          </div>
          <div>
            <span class="label">${baseText.configured}</span>
            <span>${account.configured ? baseText.yes : baseText.no}</span>
          </div>
          <div>
            <span class="label">${text.publicKey}</span>
            <span class="monospace" title="${publicKey ?? ""}">
              ${truncatePubkey(publicKey, baseText.notAvailable)}
            </span>
          </div>
          <div>
            <span class="label">${baseText.lastInbound}</span>
            <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : baseText.notAvailable}</span>
          </div>
          ${account.lastError
            ? html`<div class="account-card-error">${account.lastError}</div>`
            : nothing}
        </div>
      </div>
    `;
  };

  const renderProfileSection = () => {
    if (showingForm && profileFormCallbacks) {
      return renderNostrProfileForm({
        state: profileFormState,
        callbacks: profileFormCallbacks,
        accountId: nostrAccounts[0]?.accountId ?? "default",
        language: props.language,
      });
    }

    const profile =
      (primaryAccount as
        | {
            profile?: {
              name?: string;
              displayName?: string;
              about?: string;
              picture?: string;
              nip05?: string;
            };
          }
        | undefined)?.profile ?? nostr?.profile;
    const { name, displayName, about, picture, nip05 } = profile ?? {};
    const hasAnyProfileData = name || displayName || about || picture || nip05;

    return html`
      <div class="channel-profile">
        <div class="channel-profile__head">
          <div class="channel-profile__title">${text.profile}</div>
          ${summaryConfigured
            ? html`
                <button
                  class="btn btn--sm channel-profile__edit"
                  @click=${onEditProfile}
                >
                  ${text.editProfile}
                </button>
              `
            : nothing}
        </div>
        ${hasAnyProfileData
          ? html`
              <div class="status-list">
                ${picture
                  ? html`
                      <div class="channel-profile__avatar-wrap">
                        <img
                          src=${picture}
                          alt=${props.language === "zh" ? "资料头像" : "Profile picture"}
                          class="channel-profile__avatar"
                          @error=${(e: Event) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    `
                  : nothing}
                ${name ? html`<div><span class="label">${text.name}</span><span>${name}</span></div>` : nothing}
                ${displayName
                  ? html`<div><span class="label">${text.displayName}</span><span>${displayName}</span></div>`
                  : nothing}
                ${about
                  ? html`<div><span class="label">${text.about}</span><span class="channel-profile__about">${about}</span></div>`
                  : nothing}
                ${nip05 ? html`<div><span class="label">NIP-05</span><span>${nip05}</span></div>` : nothing}
              </div>
            `
          : html`<div class="channel-profile__empty">${text.noProfile}</div>`}
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">Nostr</div>
      <div class="card-sub">${text.cardSub}</div>
      ${accountCountLabel}

      ${hasMultipleAccounts
        ? html`<div class="account-card-list">${nostrAccounts.map((account) => renderAccountCard(account))}</div>`
        : html`
            <div class="status-list channel-status-list">
              <div>
                <span class="label">${baseText.configured}</span>
                <span>${summaryConfigured ? baseText.yes : baseText.no}</span>
              </div>
              <div>
                <span class="label">${baseText.running}</span>
                <span>${summaryRunning ? baseText.yes : baseText.no}</span>
              </div>
              <div>
                <span class="label">${text.publicKey}</span>
                <span class="monospace" title="${summaryPublicKey ?? ""}">
                  ${truncatePubkey(summaryPublicKey, baseText.notAvailable)}
                </span>
              </div>
              <div>
                <span class="label">${baseText.lastStart}</span>
                <span>${summaryLastStartAt ? formatAgo(summaryLastStartAt) : baseText.notAvailable}</span>
              </div>
            </div>
          `}

      ${summaryLastError
        ? html`<div class="callout danger channel-callout">${summaryLastError}</div>`
        : nothing}

      ${renderProfileSection()}

      ${renderChannelConfigSection({ channelId: "nostr", props })}

      <div class="row channel-actions">
        <button class="btn" @click=${() => props.onRefresh(false)}>${baseText.refresh}</button>
      </div>
    </div>
  `;
}

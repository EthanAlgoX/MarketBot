import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
} from "../types";
import type {
  ChannelKey,
  ChannelsChannelData,
  ChannelsProps,
} from "./channels.types";
import { channelEnabled, renderChannelAccountCount } from "./channels.shared";
import { renderChannelConfigSection } from "./channels.config";
import { renderDiscordCard } from "./channels.discord";
import { renderGoogleChatCard } from "./channels.googlechat";
import { renderIMessageCard } from "./channels.imessage";
import { renderNostrCard } from "./channels.nostr";
import { renderSignalCard } from "./channels.signal";
import { renderSlackCard } from "./channels.slack";
import { renderTelegramCard } from "./channels.telegram";
import { renderWhatsAppCard } from "./channels.whatsapp";

const CHANNELS_TEXT = {
  en: {
    healthTitle: "Channel health",
    healthSub: "Channel status snapshots from the gateway.",
    notAvailable: "n/a",
    noSnapshot: "No snapshot yet.",
    genericSub: "Channel status and configuration.",
    configured: "Configured",
    running: "Running",
    connected: "Connected",
    lastInbound: "Last inbound",
    yes: "Yes",
    no: "No",
    active: "Active",
  },
  zh: {
    healthTitle: "渠道健康",
    healthSub: "来自网关的渠道状态快照。",
    notAvailable: "暂无",
    noSnapshot: "暂无快照。",
    genericSub: "渠道状态与配置。",
    configured: "已配置",
    running: "运行中",
    connected: "已连接",
    lastInbound: "最近入站",
    yes: "是",
    no: "否",
    active: "活跃",
  },
} as const;

export function renderChannels(props: ChannelsProps) {
  const language = props.language ?? "en";
  const text = CHANNELS_TEXT[language] ?? CHANNELS_TEXT.en;
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  const whatsapp = (channels?.whatsapp ?? undefined) as
    | WhatsAppStatus
    | undefined;
  const telegram = (channels?.telegram ?? undefined) as
    | TelegramStatus
    | undefined;
  const discord = (channels?.discord ?? null) as DiscordStatus | null;
  const googlechat = (channels?.googlechat ?? null) as GoogleChatStatus | null;
  const slack = (channels?.slack ?? null) as SlackStatus | null;
  const signal = (channels?.signal ?? null) as SignalStatus | null;
  const imessage = (channels?.imessage ?? null) as IMessageStatus | null;
  const nostr = (channels?.nostr ?? null) as NostrStatus | null;
  const channelOrder = resolveChannelOrder(props.snapshot);
  const orderedChannels = channelOrder
    .map((key, index) => ({
      key,
      enabled: channelEnabled(key, props),
      order: index,
    }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.order - b.order;
    });

  return html`
    <section class="grid grid-cols-2 channels-grid">
      ${orderedChannels.map((channel) =>
        renderChannel(channel.key, props, {
          whatsapp,
          telegram,
          discord,
          googlechat,
          slack,
          signal,
          imessage,
          nostr,
          channelAccounts: props.snapshot?.channelAccounts ?? null,
        }),
      )}
    </section>

    <section class="card channels-health">
      <div class="row channels-health__head">
        <div>
          <div class="card-title">${text.healthTitle}</div>
          <div class="card-sub">${text.healthSub}</div>
        </div>
        <div class="muted">${props.lastSuccessAt ? formatAgo(props.lastSuccessAt) : text.notAvailable}</div>
      </div>
      ${props.lastError
        ? html`<div class="callout danger channel-callout">
            ${props.lastError}
          </div>`
        : nothing}
      <pre class="code-block channels-health__snapshot">
${props.snapshot ? JSON.stringify(props.snapshot, null, 2) : text.noSnapshot}
      </pre>
    </section>
  `;
}

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  if (snapshot?.channelMeta?.length) {
    return snapshot.channelMeta.map((entry) => entry.id) as ChannelKey[];
  }
  if (snapshot?.channelOrder?.length) {
    return snapshot.channelOrder;
  }
  return [
    "whatsapp",
    "telegram",
    "discord",
    "googlechat",
    "slack",
    "signal",
    "imessage",
    "nostr",
  ];
}

function renderChannel(
  key: ChannelKey,
  props: ChannelsProps,
  data: ChannelsChannelData,
) {
  const accountCountLabel = renderChannelAccountCount(
    key,
    data.channelAccounts,
    props,
  );
  switch (key) {
    case "whatsapp":
      return renderWhatsAppCard({
        props,
        whatsapp: data.whatsapp,
        accountCountLabel,
      });
    case "telegram":
      return renderTelegramCard({
        props,
        telegram: data.telegram,
        telegramAccounts: data.channelAccounts?.telegram ?? [],
        accountCountLabel,
      });
    case "discord":
      return renderDiscordCard({
        props,
        discord: data.discord,
        accountCountLabel,
      });
    case "googlechat":
      return renderGoogleChatCard({
        props,
        googlechat: data.googlechat,
        accountCountLabel,
      });
    case "slack":
      return renderSlackCard({
        props,
        slack: data.slack,
        accountCountLabel,
      });
    case "signal":
      return renderSignalCard({
        props,
        signal: data.signal,
        accountCountLabel,
      });
    case "imessage":
      return renderIMessageCard({
        props,
        imessage: data.imessage,
        accountCountLabel,
      });
    case "nostr": {
      const nostrAccounts = data.channelAccounts?.nostr ?? [];
      const primaryAccount = nostrAccounts[0];
      const accountId = primaryAccount?.accountId ?? "default";
      const profile =
        (primaryAccount as { profile?: NostrProfile | null } | undefined)?.profile ?? null;
      const showForm =
        props.nostrProfileAccountId === accountId ? props.nostrProfileFormState : null;
      const profileFormCallbacks = showForm
        ? {
            onFieldChange: props.onNostrProfileFieldChange,
            onSave: props.onNostrProfileSave,
            onImport: props.onNostrProfileImport,
            onCancel: props.onNostrProfileCancel,
            onToggleAdvanced: props.onNostrProfileToggleAdvanced,
          }
        : null;
      return renderNostrCard({
        props,
        nostr: data.nostr,
        nostrAccounts,
        accountCountLabel,
        profileFormState: showForm,
        profileFormCallbacks,
        onEditProfile: () => props.onNostrProfileEdit(accountId, profile),
      });
    }
    default:
      return renderGenericChannelCard(
        key,
        props,
        data.channelAccounts ?? {},
        text,
      );
  }
}

function renderGenericChannelCard(
  key: ChannelKey,
  props: ChannelsProps,
  channelAccounts: Record<string, ChannelAccountSnapshot[]>,
  text: (typeof CHANNELS_TEXT)["en"],
) {
  const label = resolveChannelLabel(props.snapshot, key);
  const status = props.snapshot?.channels?.[key] as Record<string, unknown> | undefined;
  const configured = typeof status?.configured === "boolean" ? status.configured : undefined;
  const running = typeof status?.running === "boolean" ? status.running : undefined;
  const connected = typeof status?.connected === "boolean" ? status.connected : undefined;
  const lastError = typeof status?.lastError === "string" ? status.lastError : undefined;
  const accounts = channelAccounts[key] ?? [];
  const accountCountLabel = renderChannelAccountCount(key, channelAccounts);

  return html`
    <div class="card">
      <div class="card-title">${label}</div>
      <div class="card-sub">${text.genericSub}</div>
      ${accountCountLabel}

      ${accounts.length > 0
        ? html`
            <div class="account-card-list">
              ${accounts.map((account) => renderGenericAccount(account, text))}
            </div>
          `
        : html`
            <div class="status-list channel-status-list">
              <div>
                <span class="label">${text.configured}</span>
                <span>${configured == null ? text.notAvailable : configured ? text.yes : text.no}</span>
              </div>
              <div>
                <span class="label">${text.running}</span>
                <span>${running == null ? text.notAvailable : running ? text.yes : text.no}</span>
              </div>
              <div>
                <span class="label">${text.connected}</span>
                <span>${connected == null ? text.notAvailable : connected ? text.yes : text.no}</span>
              </div>
            </div>
          `}

      ${lastError
        ? html`<div class="callout danger channel-callout">
            ${lastError}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: key, props })}
    </div>
  `;
}

function resolveChannelMetaMap(
  snapshot: ChannelsStatusSnapshot | null,
): Record<string, ChannelUiMetaEntry> {
  if (!snapshot?.channelMeta?.length) return {};
  return Object.fromEntries(snapshot.channelMeta.map((entry) => [entry.id, entry]));
}

function resolveChannelLabel(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return meta?.label ?? snapshot?.channelLabels?.[key] ?? key;
}

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
  if (!account.lastInboundAt) return false;
  return Date.now() - account.lastInboundAt < RECENT_ACTIVITY_THRESHOLD_MS;
}

function deriveRunningStatus(account: ChannelAccountSnapshot): "yes" | "no" | "active" {
  if (account.running) return "yes";
  // If we have recent inbound activity, the channel is effectively running
  if (hasRecentActivity(account)) return "active";
  return "no";
}

function deriveConnectedStatus(account: ChannelAccountSnapshot): "yes" | "no" | "active" | "na" {
  if (account.connected === true) return "yes";
  if (account.connected === false) return "no";
  // If connected is null/undefined but we have recent activity, show as active
  if (hasRecentActivity(account)) return "active";
  return "na";
}

function renderGenericAccount(
  account: ChannelAccountSnapshot,
  text: (typeof CHANNELS_TEXT)["en"],
) {
  const runningStatusKey = deriveRunningStatus(account);
  const connectedStatusKey = deriveConnectedStatus(account);
  const runningStatus =
    runningStatusKey === "yes"
      ? text.yes
      : runningStatusKey === "active"
        ? text.active
        : text.no;
  const connectedStatus =
    connectedStatusKey === "yes"
      ? text.yes
      : connectedStatusKey === "no"
        ? text.no
        : connectedStatusKey === "active"
          ? text.active
          : text.notAvailable;

  return html`
    <div class="account-card">
      <div class="account-card-header">
        <div class="account-card-title">${account.name || account.accountId}</div>
        <div class="account-card-id">${account.accountId}</div>
      </div>
      <div class="status-list account-card-status">
        <div>
          <span class="label">${text.running}</span>
          <span>${runningStatus}</span>
        </div>
        <div>
          <span class="label">${text.configured}</span>
          <span>${account.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.connected}</span>
          <span>${connectedStatus}</span>
        </div>
        <div>
          <span class="label">${text.lastInbound}</span>
          <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : text.notAvailable}</span>
        </div>
        ${account.lastError
          ? html`
              <div class="account-card-error">
                ${account.lastError}
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

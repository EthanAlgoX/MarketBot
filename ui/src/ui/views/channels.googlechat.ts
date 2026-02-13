import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { GoogleChatStatus } from "../types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";
import type { ChannelsProps } from "./channels.types";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">Google Chat</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "Chat API Webhook 状态与渠道配置。"
          : "Chat API webhook status and channel configuration."}
      </div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${text.configured}</span>
          <span>${googleChat ? (googleChat.configured ? text.yes : text.no) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${googleChat ? (googleChat.running ? text.yes : text.no) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.credential}</span>
          <span>${googleChat?.credentialSource ?? text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.audience}</span>
          <span>
            ${googleChat?.audienceType
              ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
              : text.notAvailable}
          </span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${googleChat?.lastStartAt ? formatAgo(googleChat.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${googleChat?.lastProbeAt ? formatAgo(googleChat.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${googleChat?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${googleChat.lastError}
          </div>`
        : nothing}

      ${googleChat?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${text.probe} ${googleChat.probe.ok ? text.probeOk : text.probeFailed} ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

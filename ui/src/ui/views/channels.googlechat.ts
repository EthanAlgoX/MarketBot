import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { GoogleChatStatus } from "../types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";
import type { ChannelsProps } from "./channels.types";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googlechat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googlechat, accountCountLabel } = params;
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

      <div class="status-list channel-status-list">
        <div>
          <span class="label">${text.configured}</span>
          <span>${googlechat ? (googlechat.configured ? text.yes : text.no) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${googlechat ? (googlechat.running ? text.yes : text.no) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.credential}</span>
          <span>${googlechat?.credentialSource ?? text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.audience}</span>
          <span>
            ${googlechat?.audienceType
              ? `${googlechat.audienceType}${googlechat.audience ? ` · ${googlechat.audience}` : ""}`
              : text.notAvailable}
          </span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${googlechat?.lastStartAt ? formatAgo(googlechat.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${googlechat?.lastProbeAt ? formatAgo(googlechat.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${googlechat?.lastError
        ? html`<div class="callout danger channel-callout">
            ${googlechat.lastError}
          </div>`
        : nothing}

      ${googlechat?.probe
        ? html`<div class="callout channel-callout">
            ${text.probe} ${googlechat.probe.ok ? text.probeOk : text.probeFailed} ·
            ${googlechat.probe.status ?? ""} ${googlechat.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row channel-actions">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

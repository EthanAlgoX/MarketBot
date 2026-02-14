import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { IMessageStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">iMessage</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "macOS 桥接状态与渠道配置。"
          : "macOS bridge status and channel configuration."}
      </div>
      ${accountCountLabel}

      <div class="status-list channel-status-list">
        <div>
          <span class="label">${text.configured}</span>
          <span>${imessage?.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${imessage?.running ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${imessage?.lastStartAt ? formatAgo(imessage.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${imessage?.lastProbeAt ? formatAgo(imessage.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${imessage?.lastError
        ? html`<div class="callout danger channel-callout">
            ${imessage.lastError}
          </div>`
        : nothing}

      ${imessage?.probe
        ? html`<div class="callout channel-callout">
            ${text.probe} ${imessage.probe.ok ? text.probeOk : text.probeFailed} ·
            ${imessage.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row channel-actions">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { SlackStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";

export function renderSlackCard(params: {
  props: ChannelsProps;
  slack?: SlackStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, slack, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">Slack</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "Socket 模式状态与渠道配置。"
          : "Socket mode status and channel configuration."}
      </div>
      ${accountCountLabel}

      <div class="status-list channel-status-list">
        <div>
          <span class="label">${text.configured}</span>
          <span>${slack?.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${slack?.running ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${slack?.lastStartAt ? formatAgo(slack.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${slack?.lastProbeAt ? formatAgo(slack.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${slack?.lastError
        ? html`<div class="callout danger channel-callout">
            ${slack.lastError}
          </div>`
        : nothing}

      ${slack?.probe
        ? html`<div class="callout channel-callout">
            ${text.probe} ${slack.probe.ok ? text.probeOk : text.probeFailed} ·
            ${slack.probe.status ?? ""} ${slack.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "slack", props })}

      <div class="row channel-actions">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

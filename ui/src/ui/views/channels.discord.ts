import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { DiscordStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">Discord</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "机器人状态与渠道配置。"
          : "Bot status and channel configuration."}
      </div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${text.configured}</span>
          <span>${discord?.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${discord?.running ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${discord?.lastStartAt ? formatAgo(discord.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${discord?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${discord.lastError}
          </div>`
        : nothing}

      ${discord?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${text.probe} ${discord.probe.ok ? text.probeOk : text.probeFailed} ·
            ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "discord", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { SignalStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">Signal</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "signal-cli 状态与渠道配置。"
          : "signal-cli status and channel configuration."}
      </div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${text.configured}</span>
          <span>${signal?.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${signal?.running ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.baseUrl}</span>
          <span>${signal?.baseUrl ?? text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastStart}</span>
          <span>${signal?.lastStartAt ? formatAgo(signal.lastStartAt) : text.notAvailable}</span>
        </div>
        <div>
          <span class="label">${text.lastProbe}</span>
          <span>${signal?.lastProbeAt ? formatAgo(signal.lastProbeAt) : text.notAvailable}</span>
        </div>
      </div>

      ${signal?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${signal.lastError}
          </div>`
        : nothing}

      ${signal?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${text.probe} ${signal.probe.ok ? text.probeOk : text.probeFailed} ·
            ${signal.probe.status ?? ""} ${signal.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "signal", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

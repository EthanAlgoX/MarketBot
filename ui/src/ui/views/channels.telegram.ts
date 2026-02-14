import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { resolveChannelsText } from "./channels.shared";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel } = params;
  const text = resolveChannelsText(props);
  const hasMultipleAccounts = telegramAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${text.running}</span>
            <span>${account.running ? text.yes : text.no}</span>
          </div>
          <div>
            <span class="label">${text.configured}</span>
            <span>${account.configured ? text.yes : text.no}</span>
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
  };

  return html`
    <div class="card">
      <div class="card-title">Telegram</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "机器人状态与渠道配置。"
          : "Bot status and channel configuration."}
      </div>
      ${accountCountLabel}

      ${hasMultipleAccounts
        ? html`
            <div class="account-card-list">
              ${telegramAccounts.map((account) => renderAccountCard(account))}
            </div>
          `
        : html`
            <div class="status-list channel-status-list">
              <div>
                <span class="label">${text.configured}</span>
                <span>${telegram?.configured ? text.yes : text.no}</span>
              </div>
              <div>
                <span class="label">${text.running}</span>
                <span>${telegram?.running ? text.yes : text.no}</span>
              </div>
              <div>
                <span class="label">${text.mode}</span>
                <span>${telegram?.mode ?? text.notAvailable}</span>
              </div>
              <div>
                <span class="label">${text.lastStart}</span>
                <span>${telegram?.lastStartAt ? formatAgo(telegram.lastStartAt) : text.notAvailable}</span>
              </div>
              <div>
                <span class="label">${text.lastProbe}</span>
                <span>${telegram?.lastProbeAt ? formatAgo(telegram.lastProbeAt) : text.notAvailable}</span>
              </div>
            </div>
          `}

      ${telegram?.lastError
        ? html`<div class="callout danger channel-callout">
            ${telegram.lastError}
          </div>`
        : nothing}

      ${telegram?.probe
        ? html`<div class="callout channel-callout">
            ${text.probe} ${telegram.probe.ok ? text.probeOk : text.probeFailed} ·
            ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "telegram", props })}

      <div class="row channel-actions">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.probeButton}
        </button>
      </div>
    </div>
  `;
}

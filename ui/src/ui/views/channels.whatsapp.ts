import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { WhatsAppStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatDuration, resolveChannelsText } from "./channels.shared";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp, accountCountLabel } = params;
  const text = resolveChannelsText(props);

  return html`
    <div class="card">
      <div class="card-title">WhatsApp</div>
      <div class="card-sub">
        ${props.language === "zh"
          ? "绑定 WhatsApp Web 并监控连接健康。"
          : "Link WhatsApp Web and monitor connection health."}
      </div>
      ${accountCountLabel}

      <div class="status-list channel-status-list">
        <div>
          <span class="label">${text.configured}</span>
          <span>${whatsapp?.configured ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.linked}</span>
          <span>${whatsapp?.linked ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.running}</span>
          <span>${whatsapp?.running ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.connected}</span>
          <span>${whatsapp?.connected ? text.yes : text.no}</span>
        </div>
        <div>
          <span class="label">${text.lastConnect}</span>
          <span>
            ${whatsapp?.lastConnectedAt
              ? formatAgo(whatsapp.lastConnectedAt)
              : text.notAvailable}
          </span>
        </div>
        <div>
          <span class="label">${text.lastMessage}</span>
          <span>
            ${whatsapp?.lastMessageAt ? formatAgo(whatsapp.lastMessageAt) : text.notAvailable}
          </span>
        </div>
        <div>
          <span class="label">${text.authAge}</span>
          <span>
            ${whatsapp?.authAgeMs != null
              ? formatDuration(whatsapp.authAgeMs, props)
              : text.notAvailable}
          </span>
        </div>
      </div>

      ${whatsapp?.lastError
        ? html`<div class="callout danger channel-callout">
            ${whatsapp.lastError}
          </div>`
        : nothing}

      ${props.whatsappMessage
        ? html`<div class="callout channel-callout">
            ${props.whatsappMessage}
          </div>`
        : nothing}

      ${props.whatsappQrDataUrl
        ? html`<div class="qr-wrap">
            <img src=${props.whatsappQrDataUrl} alt=${props.language === "zh" ? "WhatsApp 二维码" : "WhatsApp QR"} />
          </div>`
        : nothing}

      <div class="row channel-actions channel-actions--roomy">
        <button
          class="btn primary"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(false)}
        >
          ${props.whatsappBusy ? text.working : text.showQr}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(true)}
        >
          ${text.relink}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppWait()}
        >
          ${text.waitForScan}
        </button>
        <button
          class="btn danger"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppLogout()}
        >
          ${text.logout}
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${text.refresh}
        </button>
      </div>

      ${renderChannelConfigSection({ channelId: "whatsapp", props })}
    </div>
  `;
}

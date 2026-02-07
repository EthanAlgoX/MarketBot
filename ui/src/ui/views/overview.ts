import { html } from "lit";

import type { UiSettings } from "../storage";

function guessGatewayWebSocketUrlFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.host;
  if (!host) return null;
  const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsScheme}//${host}`;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back below.
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-1000px";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch (err) {
    console.warn("Clipboard copy failed", err);
  }
}

export type OverviewProps = {
  connected: boolean;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
};

export function renderOverview(props: OverviewProps) {
  const remoteControl = (() => {
    if (typeof window === "undefined") return null;
    const token = props.settings.token.trim();
    const session =
      props.settings.lastActiveSessionKey?.trim() || props.settings.sessionKey.trim();

    const shareUrl = new URL(window.location.href);
    shareUrl.hash = "";
    shareUrl.search = "";
    if (token) shareUrl.searchParams.set("token", token);
    if (session) shareUrl.searchParams.set("session", session);
    const wsUrl = guessGatewayWebSocketUrlFromLocation();
    if (wsUrl) shareUrl.searchParams.set("gatewayUrl", wsUrl);

    const hostname = shareUrl.hostname;
    const isLoopback =
      hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";

    return html`
      <section class="card">
        <div class="card-title">Mobile Remote Control</div>
        <div class="card-sub">
          Open this link on your phone to control the same gateway. The URL can include a token.
        </div>

        <div class="form-grid" style="margin-top: 16px;">
          <label class="field" style="grid-column: 1 / -1;">
            <span>Share Link</span>
            <input class="mono" readonly .value=${shareUrl.toString()} />
          </label>
        </div>

        <div class="row" style="margin-top: 14px;">
          <button
            class="btn"
            @click=${async () => copyToClipboard(shareUrl.toString())}
            title="Copy share link"
          >
            Copy Link
          </button>
          <span class="muted">
            ${token
              ? "Treat this link like a password."
              : "No token in URL. If your gateway requires auth, paste a Gateway Token first."}
          </span>
        </div>

        ${isLoopback
          ? html`<div class="callout warn" style="margin-top: 14px;">
              This link points at <span class="mono">${hostname}</span>, which a phone cannot reach
              unless it is the same device. Use HTTPS (Tailscale Serve) to expose the Control UI,
              then re-open this page on that HTTPS URL and copy again.
              <div style="margin-top: 6px;">
                <a
                  class="session-link"
                  href="https://docs.marketbot.ai/gateway/tailscale"
                  target="_blank"
                  rel="noreferrer"
                  title="Tailscale Serve docs (opens in new tab)"
                  >Docs: Tailscale Serve</a
                >
              </div>
            </div>`
          : ""}
      </section>
    `;
  })();

  const authHint = (() => {
    if (props.connected || !props.lastError) return null;
    const lower = props.lastError.toLowerCase();
    const authFailed = lower.includes("unauthorized") || lower.includes("connect failed");
    if (!authFailed) return null;
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    if (!hasToken && !hasPassword) {
      return html`
        <div class="muted" style="margin-top: 8px;">
          This gateway requires auth. Paste a tokenized Control UI URL or set a Gateway Token, then
          click Connect.
          <div style="margin-top: 6px;">
            <a
              class="session-link"
              href="https://docs.marketbot.ai/web/control-ui"
              target="_blank"
              rel="noreferrer"
              title="Control UI auth docs (opens in new tab)"
              >Docs: Control UI auth</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        Auth failed. Re-copy a tokenized Control UI URL, or update the token, then click Connect.
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.marketbot.ai/web/control-ui"
            target="_blank"
            rel="noreferrer"
            title="Control UI auth docs (opens in new tab)"
            >Docs: Control UI auth</a
          >
        </div>
      </div>
    `;
  })();

  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) return null;
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext !== false) return null;
    const lower = props.lastError.toLowerCase();
    if (!lower.includes("secure context") && !lower.includes("device identity required")) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        This page is HTTP, so the browser blocks device identity. Use HTTPS (Tailscale Serve) or
        open <span class="mono">http://127.0.0.1:18789</span> on the gateway host.
        <div style="margin-top: 6px;">
          If you must stay on HTTP, set
          <span class="mono">gateway.controlUi.allowInsecureAuth: true</span> (token-only).
        </div>
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.marketbot.ai/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title="Tailscale Serve docs (opens in new tab)"
            >Docs: Tailscale Serve</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.marketbot.ai/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title="Insecure HTTP docs (opens in new tab)"
            >Docs: Insecure HTTP</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <div>
          <div class="card-title">Gateway Connection</div>
          <div class="card-sub">Configure the gateway URL and credentials for this browser.</div>
        </div>
        <div class="pill ${props.connected ? "ok" : "warn"}">
          <span class="statusDot ${props.connected ? "ok" : "warn"}"></span>
          <span class="mono">${props.connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>WebSocket URL</span>
          <input
            .value=${props.settings.gatewayUrl}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSettingsChange({ ...props.settings, gatewayUrl: v });
            }}
            placeholder="ws://127.0.0.1:18789"
          />
        </label>
        <label class="field">
          <span>Gateway Token</span>
          <input
            .value=${props.settings.token}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSettingsChange({ ...props.settings, token: v });
            }}
            placeholder="MARKETBOT_GATEWAY_TOKEN"
          />
        </label>
        <label class="field">
          <span>Password (not stored)</span>
          <input
            type="password"
            .value=${props.password}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onPasswordChange(v);
            }}
            placeholder="system or shared password"
          />
        </label>
        <label class="field">
          <span>Default Session Key</span>
          <input
            .value=${props.settings.sessionKey}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSessionKeyChange(v);
            }}
            placeholder="main"
          />
        </label>
      </div>

      <div class="row" style="margin-top: 14px;">
        <button class="btn primary" @click=${() => props.onConnect()}>Connect</button>
        <button class="btn" @click=${() => props.onRefresh()}>Refresh</button>
        <span class="muted">Connect applies connection changes.</span>
      </div>

      ${props.lastError
        ? html`<div class="callout danger" style="margin-top: 14px;">
            <div>${props.lastError}</div>
            ${authHint ?? ""}
            ${insecureContextHint ?? ""}
          </div>`
        : html`<div class="callout" style="margin-top: 14px;">
            Use Desk and Stocks for finance workflows. Use Ops for delivery and scheduling.
          </div>`}
    </section>

    ${remoteControl ?? ""}
  `;
}

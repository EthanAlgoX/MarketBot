import { html } from "lit";

import type { UiSettings } from "../storage";

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
  `;
}

import { html } from "lit";

import type { UiLanguage, UiSettings } from "../storage";

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
  language?: UiLanguage;
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

const OVERVIEW_TEXT = {
  en: {
    mobileTitle: "Mobile Remote Control",
    mobileSub:
      "Open this link on your phone to control the same gateway. The URL can include a token.",
    shareLink: "Share Link",
    copyTitle: "Copy share link",
    copy: "Copy Link",
    tokenWarning: "Treat this link like a password.",
    tokenMissing:
      "No token in URL. If your gateway requires auth, paste a Gateway Token first.",
    loopbackPrefix: "This link points at",
    loopbackBody:
      "which a phone cannot reach unless it is the same device. Use HTTPS (Tailscale Serve) to expose the Control UI, then re-open this page on that HTTPS URL and copy again.",
    tailscaleDocsTitle: "Tailscale Serve docs (opens in new tab)",
    tailscaleDocsLabel: "Docs: Tailscale Serve",
    authRequired:
      "This gateway requires auth. Paste a tokenized Control UI URL or set a Gateway Token, then click Connect.",
    authFailed:
      "Auth failed. Re-copy a tokenized Control UI URL, or update the token, then click Connect.",
    authDocsTitle: "Control UI auth docs (opens in new tab)",
    authDocsLabel: "Docs: Control UI auth",
    insecurePrefix:
      "This page is HTTP, so the browser blocks device identity. Use HTTPS (Tailscale Serve) or open",
    insecureSuffix: "on the gateway host.",
    insecureAllow: "If you must stay on HTTP, set",
    insecureAllowSuffix: "(token-only).",
    insecureDocsTitle: "Insecure HTTP docs (opens in new tab)",
    insecureDocsLabel: "Docs: Insecure HTTP",
    gatewayTitle: "Gateway Connection",
    gatewaySub: "Configure the gateway URL and credentials for this browser.",
    connected: "Connected",
    disconnected: "Disconnected",
    wsUrl: "WebSocket URL",
    token: "Gateway Token",
    password: "Password (not stored)",
    passwordPlaceholder: "system or shared password",
    sessionKey: "Default Session Key",
    connect: "Connect",
    refresh: "Refresh",
    connectHint: "Connect applies connection changes.",
    emptyHint:
      "Use Desk and Stocks for finance workflows. Use Ops for delivery and scheduling.",
  },
  zh: {
    mobileTitle: "移动端远程控制",
    mobileSub: "在手机打开此链接可控制同一网关。链接可包含令牌。",
    shareLink: "分享链接",
    copyTitle: "复制分享链接",
    copy: "复制链接",
    tokenWarning: "请将此链接视为密码。",
    tokenMissing: "链接中未包含令牌。若网关要求认证，请先填写网关令牌。",
    loopbackPrefix: "该链接指向",
    loopbackBody:
      "手机通常无法访问此地址（除非是同一设备）。请使用 HTTPS（Tailscale Serve）暴露控制台，再在该 HTTPS 地址重新打开并复制。",
    tailscaleDocsTitle: "Tailscale Serve 文档（新标签打开）",
    tailscaleDocsLabel: "文档：Tailscale Serve",
    authRequired: "该网关需要认证。请粘贴带令牌的控制台 URL 或设置网关令牌，然后点击连接。",
    authFailed: "认证失败。请重新复制带令牌的控制台 URL，或更新令牌后再点击连接。",
    authDocsTitle: "控制台认证文档（新标签打开）",
    authDocsLabel: "文档：控制台认证",
    insecurePrefix: "当前页面为 HTTP，浏览器会阻止设备身份认证。请使用 HTTPS（Tailscale Serve）或在网关主机访问",
    insecureSuffix: "。",
    insecureAllow: "若必须使用 HTTP，请设置",
    insecureAllowSuffix: "（仅令牌认证）。",
    insecureDocsTitle: "HTTP 不安全模式文档（新标签打开）",
    insecureDocsLabel: "文档：HTTP 不安全模式",
    gatewayTitle: "网关连接",
    gatewaySub: "为当前浏览器配置网关地址与认证信息。",
    connected: "已连接",
    disconnected: "未连接",
    wsUrl: "WebSocket 地址",
    token: "网关令牌",
    password: "密码（不存储）",
    passwordPlaceholder: "系统或共享密码",
    sessionKey: "默认会话 Key",
    connect: "连接",
    refresh: "刷新",
    connectHint: "点击连接会应用连接相关变更。",
    emptyHint: "使用工作台和股票页处理金融流程，使用控制页处理交付与调度。",
  },
} as const;

export function renderOverview(props: OverviewProps) {
  const language = props.language ?? "en";
  const text = OVERVIEW_TEXT[language] ?? OVERVIEW_TEXT.en;
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
        <div class="card-title">${text.mobileTitle}</div>
        <div class="card-sub">${text.mobileSub}</div>

        <div class="form-grid" style="margin-top: 16px;">
          <label class="field" style="grid-column: 1 / -1;">
            <span>${text.shareLink}</span>
            <input class="mono" readonly .value=${shareUrl.toString()} />
          </label>
        </div>

        <div class="row" style="margin-top: 14px;">
          <button
            class="btn"
            @click=${async () => copyToClipboard(shareUrl.toString())}
            title=${text.copyTitle}
          >
            ${text.copy}
          </button>
          <span class="muted">
            ${token
              ? text.tokenWarning
              : text.tokenMissing}
          </span>
        </div>

        ${isLoopback
          ? html`<div class="callout warn" style="margin-top: 14px;">
              ${text.loopbackPrefix} <span class="mono">${hostname}</span>, ${text.loopbackBody}
              <div style="margin-top: 6px;">
                <a
                  class="session-link"
                  href="https://docs.marketbot.ai/gateway/tailscale"
                  target="_blank"
                  rel="noreferrer"
                  title=${text.tailscaleDocsTitle}
                  >${text.tailscaleDocsLabel}</a
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
          ${text.authRequired}
          <div style="margin-top: 6px;">
            <a
              class="session-link"
              href="https://docs.marketbot.ai/web/control-ui"
              target="_blank"
              rel="noreferrer"
              title=${text.authDocsTitle}
              >${text.authDocsLabel}</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        ${text.authFailed}
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.marketbot.ai/web/control-ui"
            target="_blank"
            rel="noreferrer"
            title=${text.authDocsTitle}
            >${text.authDocsLabel}</a
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
        ${text.insecurePrefix}
        <span class="mono">http://127.0.0.1:18789</span> ${text.insecureSuffix}
        <div style="margin-top: 6px;">
          ${text.insecureAllow}
          <span class="mono">gateway.controlUi.allowInsecureAuth: true</span>
          ${text.insecureAllowSuffix}
        </div>
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.marketbot.ai/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title=${text.tailscaleDocsTitle}
            >${text.tailscaleDocsLabel}</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.marketbot.ai/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title=${text.insecureDocsTitle}
            >${text.insecureDocsLabel}</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <div>
          <div class="card-title">${text.gatewayTitle}</div>
          <div class="card-sub">${text.gatewaySub}</div>
        </div>
        <div class="pill ${props.connected ? "ok" : "warn"}">
          <span class="statusDot ${props.connected ? "ok" : "warn"}"></span>
          <span class="mono">${props.connected ? text.connected : text.disconnected}</span>
        </div>
      </div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>${text.wsUrl}</span>
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
          <span>${text.token}</span>
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
          <span>${text.password}</span>
          <input
            type="password"
            .value=${props.password}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onPasswordChange(v);
            }}
            placeholder=${text.passwordPlaceholder}
          />
        </label>
        <label class="field">
          <span>${text.sessionKey}</span>
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
        <button class="btn primary" @click=${() => props.onConnect()}>${text.connect}</button>
        <button class="btn" @click=${() => props.onRefresh()}>${text.refresh}</button>
        <span class="muted">${text.connectHint}</span>
      </div>

      ${props.lastError
        ? html`<div class="callout danger" style="margin-top: 14px;">
            <div>${props.lastError}</div>
            ${authHint ?? ""}
            ${insecureContextHint ?? ""}
          </div>`
        : html`<div class="callout" style="margin-top: 14px;">
            ${text.emptyHint}
          </div>`}
    </section>

    ${remoteControl ?? ""}
  `;
}

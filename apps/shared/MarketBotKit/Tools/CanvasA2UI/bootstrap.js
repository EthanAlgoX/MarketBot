import { html, css, LitElement, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ContextProvider } from "@lit/context";

import { v0_8 } from "@a2ui/lit";
import "@a2ui/lit/ui";
import { themeContext } from "@marketbot/a2ui-theme-context";

const modalStyles = css`
  dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 24px;
    border: none;
    background: rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(8px) saturate(140%);
    display: grid;
    place-items: center;
  }

  dialog::backdrop {
    background: rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(8px) saturate(140%);
  }
`;

const modalElement = customElements.get("a2ui-modal");
if (modalElement && Array.isArray(modalElement.styles)) {
  modalElement.styles = [...modalElement.styles, modalStyles];
}

const empty = Object.freeze({});
const emptyClasses = () => ({});
const textHintStyles = () => ({
  h1: {},
  h2: {},
  h3: {},
  h4: {},
  h5: {},
  h6: {},
  body: {},
  caption: {},
});

const isAndroid = /Android/i.test(globalThis.navigator?.userAgent ?? "");
const baseFont =
  '"Satoshi", "Avenir Next", "SF Pro Display", "Segoe UI Variable", "Helvetica Neue", sans-serif';
const uiText = "#0f172a";
const uiMuted = "#475569";
const surfaceBorder = "rgba(15, 23, 42, 0.08)";
const cardShadow = isAndroid
  ? "0 6px 18px rgba(15, 23, 42, 0.16)"
  : "0 16px 32px rgba(15, 23, 42, 0.18)";
const buttonShadow = isAndroid
  ? "0 6px 16px rgba(37, 99, 235, 0.26)"
  : "0 14px 28px rgba(37, 99, 235, 0.24)";
const statusShadow = isAndroid
  ? "0 6px 16px rgba(15, 23, 42, 0.16)"
  : "0 12px 24px rgba(15, 23, 42, 0.2)";
const statusBlur = isAndroid ? "10px" : "14px";

const marketbotTheme = {
  components: {
    AudioPlayer: emptyClasses(),
    Button: emptyClasses(),
    Card: emptyClasses(),
    Column: emptyClasses(),
    CheckBox: { container: emptyClasses(), element: emptyClasses(), label: emptyClasses() },
    DateTimeInput: { container: emptyClasses(), element: emptyClasses(), label: emptyClasses() },
    Divider: emptyClasses(),
    Image: {
      all: emptyClasses(),
      icon: emptyClasses(),
      avatar: emptyClasses(),
      smallFeature: emptyClasses(),
      mediumFeature: emptyClasses(),
      largeFeature: emptyClasses(),
      header: emptyClasses(),
    },
    Icon: emptyClasses(),
    List: emptyClasses(),
    Modal: { backdrop: emptyClasses(), element: emptyClasses() },
    MultipleChoice: { container: emptyClasses(), element: emptyClasses(), label: emptyClasses() },
    Row: emptyClasses(),
    Slider: { container: emptyClasses(), element: emptyClasses(), label: emptyClasses() },
    Tabs: { container: emptyClasses(), element: emptyClasses(), controls: { all: emptyClasses(), selected: emptyClasses() } },
    Text: {
      all: emptyClasses(),
      h1: emptyClasses(),
      h2: emptyClasses(),
      h3: emptyClasses(),
      h4: emptyClasses(),
      h5: emptyClasses(),
      caption: emptyClasses(),
      body: emptyClasses(),
    },
    TextField: { container: emptyClasses(), element: emptyClasses(), label: emptyClasses() },
    Video: emptyClasses(),
  },
  elements: {
    a: emptyClasses(),
    audio: emptyClasses(),
    body: emptyClasses(),
    button: emptyClasses(),
    h1: emptyClasses(),
    h2: emptyClasses(),
    h3: emptyClasses(),
    h4: emptyClasses(),
    h5: emptyClasses(),
    iframe: emptyClasses(),
    input: emptyClasses(),
    p: emptyClasses(),
    pre: emptyClasses(),
    textarea: emptyClasses(),
    video: emptyClasses(),
  },
  markdown: {
    p: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    ul: [],
    ol: [],
    li: [],
    a: [],
    strong: [],
    em: [],
  },
  additionalStyles: {
    Card: {
      background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.9))",
      border: `1px solid ${surfaceBorder}`,
      borderRadius: "16px",
      padding: "16px",
      boxShadow: cardShadow,
      color: uiText,
    },
    Modal: {
      background: "rgba(255, 255, 255, 0.96)",
      border: "1px solid rgba(15, 23, 42, 0.12)",
      borderRadius: "18px",
      padding: "18px",
      boxShadow: "0 30px 80px rgba(15, 23, 42, 0.25)",
      width: "min(560px, calc(100vw - 48px))",
      color: uiText,
    },
    Column: { gap: "12px" },
    Row: { gap: "12px", alignItems: "center" },
    Divider: { opacity: "0.22" },
    Button: {
      background: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
      border: "0",
      borderRadius: "12px",
      padding: "10px 16px",
      color: "#f8fafc",
      fontFamily: baseFont,
      fontWeight: "650",
      letterSpacing: "0.01em",
      cursor: "pointer",
      boxShadow: buttonShadow,
    },
    Text: {
      ...textHintStyles(),
      h1: {
        fontFamily: baseFont,
        fontSize: "20px",
        fontWeight: "700",
        margin: "0 0 6px 0",
        color: uiText,
      },
      h2: {
        fontFamily: baseFont,
        fontSize: "16px",
        fontWeight: "650",
        margin: "0 0 6px 0",
        color: uiText,
      },
      h3: {
        fontFamily: baseFont,
        fontSize: "14px",
        fontWeight: "650",
        margin: "0 0 4px 0",
        color: uiText,
      },
      h4: {
        fontFamily: baseFont,
        fontSize: "13px",
        fontWeight: "650",
        margin: "0 0 4px 0",
        color: uiText,
      },
      h5: {
        fontFamily: baseFont,
        fontSize: "12px",
        fontWeight: "650",
        margin: "0 0 4px 0",
        color: uiText,
      },
      h6: {
        fontFamily: baseFont,
        fontSize: "12px",
        fontWeight: "600",
        margin: "0 0 4px 0",
        color: uiText,
      },
      body: {
        fontFamily: baseFont,
        fontSize: "13px",
        lineHeight: "1.5",
        color: uiText,
      },
      caption: {
        fontFamily: baseFont,
        fontSize: "12px",
        lineHeight: "1.4",
        color: uiMuted,
      },
    },
    TextField: {
      background: "rgba(255, 255, 255, 0.92)",
      border: "1px solid rgba(15, 23, 42, 0.12)",
      borderRadius: "10px",
      padding: "8px 10px",
      color: uiText,
      fontFamily: baseFont,
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
    },
    Image: { borderRadius: "14px" },
  },
};

class MarketBotA2UIHost extends LitElement {
  static properties = {
    surfaces: { state: true },
    pendingAction: { state: true },
    toast: { state: true },
  };

  #processor = v0_8.Data.createSignalA2uiMessageProcessor();
  #themeProvider = new ContextProvider(this, {
    context: themeContext,
    initialValue: marketbotTheme,
  });

  surfaces = [];
  pendingAction = null;
  toast = null;
  #statusListener = null;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      position: relative;
      box-sizing: border-box;
      padding:
        var(--marketbot-a2ui-inset-top, 0px)
        var(--marketbot-a2ui-inset-right, 0px)
        var(--marketbot-a2ui-inset-bottom, 0px)
        var(--marketbot-a2ui-inset-left, 0px);
    }

    #surfaces {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      height: 100%;
      overflow: auto;
      padding-bottom: var(--marketbot-a2ui-scroll-pad-bottom, 0px);
    }

    .status {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: var(--marketbot-a2ui-status-top, 12px);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 23, 42, 0.12);
      color: ${unsafeCSS(uiText)};
      font: 12px/1.2 ${unsafeCSS(baseFont)};
      pointer-events: none;
      backdrop-filter: blur(${unsafeCSS(statusBlur)}) saturate(140%);
      -webkit-backdrop-filter: blur(${unsafeCSS(statusBlur)}) saturate(140%);
      box-shadow: ${unsafeCSS(statusShadow)};
      z-index: 5;
    }

    .toast {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: var(--marketbot-a2ui-toast-bottom, 12px);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 23, 42, 0.12);
      color: ${unsafeCSS(uiText)};
      font: 12px/1.2 ${unsafeCSS(baseFont)};
      pointer-events: none;
      backdrop-filter: blur(${unsafeCSS(statusBlur)}) saturate(140%);
      -webkit-backdrop-filter: blur(${unsafeCSS(statusBlur)}) saturate(140%);
      box-shadow: ${unsafeCSS(statusShadow)};
      z-index: 5;
    }

    .toast.error {
      border-color: rgba(248, 113, 113, 0.45);
      color: #b91c1c;
    }

    .empty {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: var(--marketbot-a2ui-empty-top, var(--marketbot-a2ui-status-top, 12px));
      text-align: center;
      opacity: 0.8;
      padding: 10px 12px;
      pointer-events: none;
    }

    .empty-title {
      font-weight: 700;
      margin-bottom: 6px;
    }

    .spinner {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      border-top-color: rgba(255, 255, 255, 0.92);
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    const api = {
      applyMessages: (messages) => this.applyMessages(messages),
      reset: () => this.reset(),
      getSurfaces: () => Array.from(this.#processor.getSurfaces().keys()),
    };
    globalThis.marketbotA2UI = api;
    this.addEventListener("a2uiaction", (evt) => this.#handleA2UIAction(evt));
    this.#statusListener = (evt) => this.#handleActionStatus(evt);
    for (const eventName of ["marketbot:a2ui-action-status"]) {
      globalThis.addEventListener(eventName, this.#statusListener);
    }
    this.#syncSurfaces();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#statusListener) {
      for (const eventName of ["marketbot:a2ui-action-status"]) {
        globalThis.removeEventListener(eventName, this.#statusListener);
      }
      this.#statusListener = null;
    }
  }

  #makeActionId() {
    return globalThis.crypto?.randomUUID?.() ?? `a2ui_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  #setToast(text, kind = "ok", timeoutMs = 1400) {
    const toast = { text, kind, expiresAt: Date.now() + timeoutMs };
    this.toast = toast;
    this.requestUpdate();
    setTimeout(() => {
      if (this.toast === toast) {
        this.toast = null;
        this.requestUpdate();
      }
    }, timeoutMs + 30);
  }

  #handleActionStatus(evt) {
    const detail = evt?.detail ?? null;
    if (!detail || typeof detail.id !== "string") return;
    if (!this.pendingAction || this.pendingAction.id !== detail.id) return;

    if (detail.ok) {
      this.pendingAction = { ...this.pendingAction, phase: "sent", sentAt: Date.now() };
    } else {
      const msg = typeof detail.error === "string" && detail.error ? detail.error : "send failed";
      this.pendingAction = { ...this.pendingAction, phase: "error", error: msg };
      this.#setToast(`Failed: ${msg}`, "error", 4500);
    }
    this.requestUpdate();
  }

  #handleA2UIAction(evt) {
    const payload = evt?.detail ?? evt?.payload ?? null;
    if (!payload || payload.eventType !== "a2ui.action") {
      return;
    }

    const action = payload.action;
    const name = action?.name;
    if (!name) {
      return;
    }

    const sourceComponentId = payload.sourceComponentId ?? "";
    const surfaces = this.#processor.getSurfaces();

    let surfaceId = null;
    let sourceNode = null;
    for (const [sid, surface] of surfaces.entries()) {
      const node = surface?.components?.get?.(sourceComponentId) ?? null;
      if (node) {
        surfaceId = sid;
        sourceNode = node;
        break;
      }
    }

    const context = {};
    const ctxItems = Array.isArray(action?.context) ? action.context : [];
    for (const item of ctxItems) {
      const key = item?.key;
      const value = item?.value ?? null;
      if (!key || !value) continue;

      if (typeof value.path === "string") {
        const resolved = sourceNode
          ? this.#processor.getData(sourceNode, value.path, surfaceId ?? undefined)
          : null;
        context[key] = resolved;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, "literalString")) {
        context[key] = value.literalString ?? "";
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, "literalNumber")) {
        context[key] = value.literalNumber ?? 0;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, "literalBoolean")) {
        context[key] = value.literalBoolean ?? false;
        continue;
      }
    }

    const actionId = this.#makeActionId();
    this.pendingAction = { id: actionId, name, phase: "sending", startedAt: Date.now() };
    this.requestUpdate();

    const userAction = {
      id: actionId,
      name,
      surfaceId: surfaceId ?? "main",
      sourceComponentId,
      timestamp: new Date().toISOString(),
      ...(Object.keys(context).length ? { context } : {}),
    };

    globalThis.__marketbotLastA2UIAction = userAction;

    const handler =
      globalThis.webkit?.messageHandlers?.marketbotCanvasA2UIAction ??
      globalThis.marketbotCanvasA2UIAction;
    if (handler?.postMessage) {
      try {
        // WebKit message handlers support structured objects; Android's JS interface expects strings.
        if (handler === globalThis.marketbotCanvasA2UIAction) {
          handler.postMessage(JSON.stringify({ userAction }));
        } else {
          handler.postMessage({ userAction });
        }
      } catch (e) {
        const msg = String(e?.message ?? e);
        this.pendingAction = { id: actionId, name, phase: "error", startedAt: Date.now(), error: msg };
        this.#setToast(`Failed: ${msg}`, "error", 4500);
      }
    } else {
      this.pendingAction = { id: actionId, name, phase: "error", startedAt: Date.now(), error: "missing native bridge" };
      this.#setToast("Failed: missing native bridge", "error", 4500);
    }
  }

  applyMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error("A2UI: expected messages array");
    }
    this.#processor.processMessages(messages);
    this.#syncSurfaces();
    if (this.pendingAction?.phase === "sent") {
      this.#setToast(`Updated: ${this.pendingAction.name}`, "ok", 1100);
      this.pendingAction = null;
    }
    this.requestUpdate();
    return { ok: true, surfaces: this.surfaces.map(([id]) => id) };
  }

  reset() {
    this.#processor.clearSurfaces();
    this.#syncSurfaces();
    this.pendingAction = null;
    this.requestUpdate();
    return { ok: true };
  }

  #syncSurfaces() {
    this.surfaces = Array.from(this.#processor.getSurfaces().entries());
  }

  render() {
    if (this.surfaces.length === 0) {
      return html`<div class="empty">
        <div class="empty-title">Canvas (A2UI)</div>
        <div>Waiting for A2UI messages…</div>
      </div>`;
    }

    const statusText =
      this.pendingAction?.phase === "sent"
        ? `Working: ${this.pendingAction.name}`
        : this.pendingAction?.phase === "sending"
          ? `Sending: ${this.pendingAction.name}`
          : this.pendingAction?.phase === "error"
            ? `Failed: ${this.pendingAction.name}`
            : "";

    return html`
      ${this.pendingAction && this.pendingAction.phase !== "error"
        ? html`<div class="status"><div class="spinner"></div><div>${statusText}</div></div>`
        : ""}
      ${this.toast
        ? html`<div class="toast ${this.toast.kind === "error" ? "error" : ""}">${this.toast.text}</div>`
        : ""}
      <section id="surfaces">
      ${repeat(
        this.surfaces,
        ([surfaceId]) => surfaceId,
        ([surfaceId, surface]) => html`<a2ui-surface
          .surfaceId=${surfaceId}
          .surface=${surface}
          .processor=${this.#processor}
        ></a2ui-surface>`
      )}
    </section>`;
  }
}

if (!customElements.get("marketbot-a2ui-host")) {
  customElements.define("marketbot-a2ui-host", MarketBotA2UIHost);
}

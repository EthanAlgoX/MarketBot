type GuiPageOptions = {
  baseUrl: string;
};

export function renderGuiPage(options: GuiPageOptions): string {
  const apiBase = options.baseUrl.replace(/\/$/, "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MarketBot GUI</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:wght@600&family=IBM+Plex+Mono:wght@400;500&display=swap");

      :root {
        color-scheme: light;
        --ink: #121417;
        --muted: #5a5f66;
        --accent: #0f766e;
        --accent-2: #f97316;
        --surface: rgba(255, 255, 255, 0.9);
        --surface-strong: #ffffff;
        --border: rgba(15, 23, 42, 0.12);
        --shadow: 0 22px 50px rgba(15, 23, 42, 0.12);
        --mono: "IBM Plex Mono", "JetBrains Mono", "Fira Code", monospace;
        --sans: "Space Grotesk", "Helvetica Neue", "Nimbus Sans", sans-serif;
        --serif: "Fraunces", "Iowan Old Style", serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: var(--sans);
        background:
          radial-gradient(circle at 12% 18%, rgba(15, 118, 110, 0.14), transparent 50%),
          radial-gradient(circle at 82% 12%, rgba(249, 115, 22, 0.16), transparent 52%),
          linear-gradient(135deg, #f8f2e8 0%, #e4f4f8 45%, #fffdf8 100%);
        color: var(--ink);
      }
      body::before,
      body::after {
        content: "";
        position: fixed;
        inset: -20% auto auto -20%;
        width: 320px;
        height: 320px;
        background: radial-gradient(circle, rgba(15, 118, 110, 0.18), transparent 60%);
        filter: blur(20px);
        z-index: 0;
      }
      body::after {
        inset: auto -20% -10% auto;
        width: 380px;
        height: 380px;
        background: radial-gradient(circle, rgba(249, 115, 22, 0.2), transparent 65%);
      }
      body[data-theme="dark"] {
        background:
          radial-gradient(circle at 15% 10%, rgba(34, 197, 94, 0.12), transparent 55%),
          radial-gradient(circle at 85% 20%, rgba(56, 189, 248, 0.16), transparent 60%),
          linear-gradient(160deg, #0b1220 0%, #0f172a 60%, #020617 100%);
        color: #e2e8f0;
      }
      body[data-theme="dark"]::before,
      body[data-theme="dark"]::after {
        opacity: 0.5;
      }
      .wrap {
        position: relative;
        z-index: 1;
        max-width: 1140px;
        margin: 0 auto;
        padding: 32px 20px 70px;
      }
      header.hero {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        gap: 24px;
        align-items: center;
        animation: fadeUp 0.7s ease both;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 118, 110, 0.12);
        color: #0f766e;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      body[data-theme="dark"] .pill {
        background: rgba(56, 189, 248, 0.18);
        color: #38bdf8;
      }
      h1 {
        margin: 14px 0 6px;
        font-family: var(--serif);
        font-size: 34px;
        letter-spacing: -0.02em;
      }
      .subtitle {
        font-size: 14px;
        color: var(--muted);
      }
      body[data-theme="dark"] .subtitle {
        color: #a7b1c2;
      }
      .meta-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 16px;
        box-shadow: var(--shadow);
      }
      body[data-theme="dark"] .meta-card {
        background: rgba(15, 23, 42, 0.86);
        border-color: rgba(148, 163, 184, 0.2);
      }
      .meta-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 4px;
      }
      body[data-theme="dark"] .meta-label {
        color: #94a3b8;
      }
      .meta-value {
        font-size: 14px;
        font-weight: 600;
      }
      .layout {
        margin-top: 22px;
        display: grid;
        grid-template-columns: minmax(0, 2.1fr) minmax(0, 1fr);
        gap: 18px;
      }
      .panel {
        background: var(--surface-strong);
        border-radius: 20px;
        padding: 18px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
        animation: fadeUp 0.7s ease both;
      }
      .panel-main {
        animation-delay: 0.05s;
      }
      .panel-side {
        animation-delay: 0.12s;
      }
      body[data-theme="dark"] .panel {
        background: rgba(15, 23, 42, 0.92);
        border-color: rgba(148, 163, 184, 0.2);
      }
      .input-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .input-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      input[type="text"], input[type="password"], select, textarea {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 14px;
        min-width: 140px;
        background: #ffffff;
        font-family: var(--sans);
      }
      body[data-theme="dark"] input[type="text"],
      body[data-theme="dark"] input[type="password"],
      body[data-theme="dark"] select,
      body[data-theme="dark"] textarea {
        background: #0b1220;
        border-color: rgba(148, 163, 184, 0.3);
        color: #e2e8f0;
      }
      textarea {
        min-height: 68px;
        resize: vertical;
        font-family: var(--mono);
      }
      input[type="text"].query {
        flex: 1 1 420px;
        min-width: 240px;
      }
      .btn {
        border: none;
        border-radius: 12px;
        padding: 10px 16px;
        font-size: 13px;
        cursor: pointer;
        font-weight: 600;
        font-family: var(--sans);
      }
      .btn.primary {
        background: linear-gradient(120deg, var(--accent), #14b8a6);
        color: #ffffff;
      }
      .btn.ghost {
        background: #f1f5f9;
        color: #0f172a;
      }
      body[data-theme="dark"] .btn.ghost {
        background: #1f2937;
        color: #e2e8f0;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .hint {
        font-size: 12px;
        color: var(--muted);
        margin-top: 8px;
      }
      .status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        gap: 12px;
        flex-wrap: wrap;
      }
      .status {
        font-size: 12px;
        font-weight: 600;
        color: var(--accent);
      }
      .status-detail {
        font-size: 12px;
        color: var(--muted);
      }
      .output-shell {
        margin-top: 12px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: #0b1220;
      }
      .output-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: #cbd5f5;
        background: rgba(15, 23, 42, 0.85);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #f97316;
      }
      .output {
        padding: 16px;
        font-family: var(--mono);
        font-size: 13px;
        color: #e2e8f0;
        white-space: pre-wrap;
        min-height: 180px;
      }
      body[data-theme="dark"] .output-shell {
        border-color: rgba(148, 163, 184, 0.2);
      }
      .section-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 10px;
      }
      .quick-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .quick-button {
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.85);
        color: #0f172a;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      body[data-theme="dark"] .quick-button {
        background: rgba(15, 23, 42, 0.6);
        color: #e2e8f0;
        border-color: rgba(148, 163, 184, 0.2);
      }
      .option-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
      }
      .option-grid .action-row {
        grid-column: 1 / -1;
      }
      .full-row {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .key-row {
        display: flex;
        gap: 8px;
        align-items: center;
        grid-column: 1 / -1;
      }
      .key-row input {
        flex: 1 1 auto;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
      }
      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .history {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .history button {
        text-align: left;
        background: #f8fafc;
        color: #0f172a;
        border-radius: 12px;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      .history button strong {
        display: block;
        font-size: 12px;
        font-weight: 600;
      }
      .history button small {
        display: block;
        font-size: 11px;
        color: #64748b;
        margin-top: 4px;
      }
      body[data-theme="dark"] .history button {
        background: #111827;
        color: #e2e8f0;
        border-color: rgba(148, 163, 184, 0.2);
      }
      .history small {
        color: #94a3b8;
      }
      .snapshot {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .card {
        background: #f8fafc;
        border-radius: 14px;
        padding: 12px;
        font-size: 12px;
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      body[data-theme="dark"] .card {
        background: #0b1220;
        border-color: rgba(148, 163, 184, 0.2);
      }
      .meter {
        position: relative;
        height: 8px;
        background: #e2e8f0;
        border-radius: 999px;
        margin-top: 6px;
      }
      body[data-theme="dark"] .meter {
        background: #1e293b;
      }
      .meter span {
        position: absolute;
        top: -3px;
        width: 10px;
        height: 14px;
        border-radius: 5px;
        background: #22c55e;
      }
      .meter strong {
        display: block;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ef4444, #f59e0b 45%, #22c55e);
      }
      .trace {
        margin-top: 12px;
        font-size: 12px;
        color: #64748b;
        white-space: pre-wrap;
      }
      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(18px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (max-width: 980px) {
        header.hero {
          grid-template-columns: 1fr;
        }
        .layout {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="hero">
        <div>
          <div class="pill">MarketBot</div>
          <h1>Market Intelligence Studio</h1>
          <div class="subtitle">Run focused analysis and keep context in one place.</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">API</div>
          <div class="meta-value">${apiBase}</div>
          <div class="meta-label" style="margin-top:10px;">Mode</div>
          <div class="meta-value">Interactive GUI</div>
        </div>
      </header>

      <div class="layout">
        <section class="panel panel-main">
          <div class="input-bar">
            <span class="input-label">Query</span>
            <input id="query" class="query" type="text" placeholder="e.g. GOOGL stock analysis" />
            <button id="run" class="btn primary">Analyze</button>
            <button id="clear" class="btn ghost">Clear</button>
          </div>
          <div class="hint">Press Enter to submit. Refine options on the right.</div>
          <div class="quick-row" id="quickRow"></div>

          <div class="status-row">
            <div id="status" class="status">Idle</div>
            <div id="statusDetail" class="status-detail">No runs yet.</div>
          </div>

          <div class="output-shell">
            <div class="output-header">
              <span class="dot"></span>
              <span>Analysis Output</span>
            </div>
            <div id="output" class="output">Waiting for input…</div>
          </div>

          <div class="section-title" style="margin-top:18px;">Snapshot</div>
          <div id="snapshot" class="snapshot"></div>
          <div id="trace" class="trace"></div>
        </section>

        <aside class="panel panel-side">
          <div class="section-title">Control Deck</div>
          <div class="option-grid">
            <label class="chip" for="mode">Mode</label>
            <select id="mode">
              <option value="">auto</option>
              <option value="api">api</option>
              <option value="scrape">scrape</option>
            </select>
            <label class="chip"><input id="search" type="checkbox" /> search</label>
            <label class="chip"><input id="scrape" type="checkbox" /> scrape</label>
            <label class="chip"><input id="traceToggle" type="checkbox" /> trace</label>
            <label class="chip"><input id="jsonToggle" type="checkbox" /> json</label>
          </div>

          <div class="option-grid" style="margin-top:12px;">
            <label class="chip" for="agentId">Agent</label>
            <input id="agentId" type="text" placeholder="agent id" />
            <label class="chip" for="sessionKey">Session</label>
            <input id="sessionKey" type="text" placeholder="session key" />
          </div>

          <div class="option-grid" style="margin-top:12px;">
            <label class="chip" for="theme">Theme</label>
            <select id="theme">
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
            <div class="action-row">
              <button id="copy" class="btn ghost">Copy</button>
              <button id="download" class="btn ghost">Download</button>
              <button id="save" class="btn ghost">Save</button>
            </div>
          </div>

          <div class="section-title" style="margin-top:18px;">History</div>
          <div id="history" class="history"></div>

          <div class="section-title" style="margin-top:18px;">LLM</div>
          <div class="option-grid">
            <label class="chip" for="llmPreset">Preset</label>
            <select id="llmPreset">
              <option value="">custom</option>
              <option value="openai">OpenAI API</option>
              <option value="openai-oauth">ChatGPT Subscription (OAuth)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral</option>
            </select>
            <label class="chip" for="llmProvider">Provider</label>
            <select id="llmProvider">
              <option value="">auto</option>
              <option value="openai-compatible">openai-compatible</option>
            </select>
            <label class="chip" for="llmModel">Model</label>
            <input id="llmModel" type="text" placeholder="gpt-4o-mini" />
            <label class="chip" for="llmBaseUrl">Base URL</label>
            <input id="llmBaseUrl" type="text" placeholder="https://api.openai.com/v1" />
            <label class="chip" for="llmApiKeyEnv">API Key Env</label>
            <input id="llmApiKeyEnv" type="text" placeholder="OPENAI_API_KEY" />
            <label class="chip" for="llmTimeout">Timeout (ms)</label>
            <input id="llmTimeout" type="text" placeholder="60000" />
            <label class="chip"><input id="llmJsonMode" type="checkbox" /> json mode</label>
          </div>
          <div class="key-row" style="margin-top:10px;">
            <input id="llmApiKey" type="password" placeholder="API key (not stored)" />
            <button id="toggleApiKey" class="btn ghost" type="button">Show</button>
          </div>
          <div class="option-grid" style="margin-top:10px;">
            <div class="full-row">
              <label class="chip" for="llmHeaders">Headers (JSON)</label>
              <textarea id="llmHeaders" placeholder='{"HTTP-Referer":"","X-Title":"MarketBot"}'></textarea>
            </div>
          </div>
          <div class="option-grid" style="margin-top:12px;">
            <div class="meta-card" style="grid-column: 1 / -1;">
              <div class="meta-label">OpenAI OAuth (ChatGPT)</div>
              <div class="meta-value" id="openAiStatus">Checking…</div>
              <div class="action-row" style="margin-top:10px;">
                <button id="openAiLogin" class="btn ghost" type="button">Sign in</button>
                <button id="openAiLogout" class="btn ghost" type="button">Sign out</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <script>
      const queryInput = document.getElementById("query");
      const runBtn = document.getElementById("run");
      const clearBtn = document.getElementById("clear");
      const output = document.getElementById("output");
      const status = document.getElementById("status");
      const statusDetail = document.getElementById("statusDetail");
      const trace = document.getElementById("trace");
      const historyEl = document.getElementById("history");
      const quickRow = document.getElementById("quickRow");
      const mode = document.getElementById("mode");
      const searchToggle = document.getElementById("search");
      const scrapeToggle = document.getElementById("scrape");
      const traceToggle = document.getElementById("traceToggle");
      const jsonToggle = document.getElementById("jsonToggle");
      const agentIdInput = document.getElementById("agentId");
      const sessionKeyInput = document.getElementById("sessionKey");
      const copyBtn = document.getElementById("copy");
      const saveBtn = document.getElementById("save");
      const downloadBtn = document.getElementById("download");
      const themeSelect = document.getElementById("theme");
      const snapshot = document.getElementById("snapshot");
      const llmPreset = document.getElementById("llmPreset");
      const llmProvider = document.getElementById("llmProvider");
      const llmModel = document.getElementById("llmModel");
      const llmBaseUrl = document.getElementById("llmBaseUrl");
      const llmApiKeyEnv = document.getElementById("llmApiKeyEnv");
      const llmTimeout = document.getElementById("llmTimeout");
      const llmJsonMode = document.getElementById("llmJsonMode");
      const llmApiKey = document.getElementById("llmApiKey");
      const llmHeaders = document.getElementById("llmHeaders");
      const toggleApiKey = document.getElementById("toggleApiKey");
      const openAiStatus = document.getElementById("openAiStatus");
      const openAiLogin = document.getElementById("openAiLogin");
      const openAiLogout = document.getElementById("openAiLogout");

      const STORAGE_KEY = "marketbot.gui.v1";
      const LLM_PRESETS = {
        "openai": {
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          baseUrl: "https://api.openai.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
          headers: "",
          note: "Preset applied: OpenAI API.",
        },
        "openai-oauth": {
          provider: "",
          model: "gpt-4o-mini",
          baseUrl: "",
          apiKeyEnv: "",
          headers: "",
          note: "Use OpenAI OAuth sign-in above; no API key needed.",
        },
        "gemini": {
          provider: "openai-compatible",
          model: "gemini-2.0-flash",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKeyEnv: "GEMINI_API_KEY",
          headers: "",
          note: "Preset applied: Gemini (OpenAI-compatible endpoint).",
        },
        "openrouter": {
          provider: "openai-compatible",
          model: "openai/gpt-4o-mini",
          baseUrl: "https://openrouter.ai/api/v1",
          apiKeyEnv: "OPENROUTER_API_KEY",
          headers: "{\"HTTP-Referer\":\"\",\"X-Title\":\"MarketBot\"}",
          note: "Preset applied: OpenRouter. Optional headers can be filled in.",
        },
        "groq": {
          provider: "openai-compatible",
          model: "llama-3.1-8b-instant",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKeyEnv: "GROQ_API_KEY",
          headers: "",
          note: "Preset applied: Groq.",
        },
        "mistral": {
          provider: "openai-compatible",
          model: "mistral-small-latest",
          baseUrl: "https://api.mistral.ai/v1",
          apiKeyEnv: "MISTRAL_API_KEY",
          headers: "",
          note: "Preset applied: Mistral.",
        },
      };

      function loadState() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return { history: [], settings: {} };
          return JSON.parse(raw);
        } catch {
          return { history: [], settings: {} };
        }
      }

      function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      function applySettings(settings) {
        mode.value = settings.mode || "";
        searchToggle.checked = Boolean(settings.search);
        scrapeToggle.checked = Boolean(settings.scrape);
        traceToggle.checked = Boolean(settings.trace);
        jsonToggle.checked = Boolean(settings.json);
        agentIdInput.value = settings.agentId || "";
        sessionKeyInput.value = settings.sessionKey || "";
        themeSelect.value = settings.theme || "light";
        document.body.dataset.theme = themeSelect.value;
        llmPreset.value = settings.llmPreset || "";
        llmProvider.value = settings.llmProvider || "";
        llmModel.value = settings.llmModel || "";
        llmBaseUrl.value = settings.llmBaseUrl || "";
        llmApiKeyEnv.value = settings.llmApiKeyEnv || "";
        llmTimeout.value = settings.llmTimeout || "";
        llmJsonMode.checked = Boolean(settings.llmJsonMode);
        llmHeaders.value = settings.llmHeaders || "";
        if (settings.llmApiKey) {
          llmApiKey.value = settings.llmApiKey;
        }
      }

      function collectSettings(options) {
        const includeSecrets = options && options.includeSecrets === true;
        return {
          mode: mode.value,
          search: searchToggle.checked,
          scrape: scrapeToggle.checked,
          trace: traceToggle.checked,
          json: jsonToggle.checked,
          agentId: agentIdInput.value.trim(),
          sessionKey: sessionKeyInput.value.trim(),
          theme: themeSelect.value,
          llmPreset: llmPreset.value,
          llmProvider: llmProvider.value,
          llmModel: llmModel.value.trim(),
          llmBaseUrl: llmBaseUrl.value.trim(),
          llmApiKeyEnv: llmApiKeyEnv.value.trim(),
          llmTimeout: llmTimeout.value.trim(),
          llmJsonMode: llmJsonMode.checked,
          llmHeaders: llmHeaders.value.trim(),
          llmApiKey: includeSecrets ? llmApiKey.value.trim() : "",
        };
      }

      function applyPreset(presetId) {
        const preset = LLM_PRESETS[presetId];
        if (!preset) return;
        llmProvider.value = preset.provider || "";
        llmModel.value = preset.model || "";
        llmBaseUrl.value = preset.baseUrl || "";
        llmApiKeyEnv.value = preset.apiKeyEnv || "";
        llmHeaders.value = preset.headers || "";
        llmJsonMode.checked = false;
        llmApiKey.value = "";
        if (preset.note) {
          status.textContent = preset.note;
        }
      }

      function renderHistory(history) {
        historyEl.innerHTML = "";
        if (!history.length) {
          historyEl.innerHTML = "<small>No history yet.</small>";
          return;
        }
        history.slice(0, 8).forEach((entry) => {
          const btn = document.createElement("button");
          btn.innerHTML = "<strong>" + escapeHtml(entry.query) + "</strong><small>" + formatTimestamp(entry.ts) + "</small>";
          btn.title = entry.query;
          btn.addEventListener("click", () => {
            queryInput.value = entry.query;
            applySettings(entry.settings || {});
          });
          historyEl.appendChild(btn);
        });
      }

      function renderSnapshot(data) {
        const market = data?.data?.market || {};
        const regime = data?.data?.regime || {};
        const risk = data?.data?.risk || {};

        const momentum = String(market.momentum || "");
        const momentumPct = momentumValue(momentum);
        const volatility = String(market.volatility_state || "");

        snapshot.innerHTML = [
          '<div class="card"><strong>Momentum</strong>',
          '<div class="meter"><strong></strong><span style="left:' + momentumPct + '%"></span></div>',
          '<div>' + escapeHtml(momentum || "n/a") + '</div></div>',
          '<div class="card"><strong>Regime</strong><div>' + escapeHtml(regime.regime || "n/a") + '</div></div>',
          '<div class="card"><strong>Volatility</strong><div>' + escapeHtml(volatility || "n/a") + '</div></div>',
          '<div class="card"><strong>Risk</strong><div>' + escapeHtml(risk.risk_level || "n/a") + '</div></div>',
        ].join("");
      }

      async function runQuery() {
        const query = queryInput.value.trim();
        if (!query) {
          status.textContent = "Please enter a query.";
          return;
        }

        runBtn.disabled = true;
        status.textContent = "Running analysis…";
        statusDetail.textContent = "Working…";
        output.textContent = "";
        trace.textContent = "";
        snapshot.innerHTML = "";
        const startedAt = Date.now();

        const settings = collectSettings({ includeSecrets: true });
        const storedSettings = collectSettings({ includeSecrets: false });
        const payload = { query };
        if (settings.mode) payload.mode = settings.mode;
        if (settings.search) payload.search = true;
        if (settings.scrape) payload.scrape = true;
        if (settings.trace) payload.includeTrace = true;
        const llmBuild = buildLlmPayload(settings);
        if (llmBuild.error) {
          status.textContent = llmBuild.error;
          runBtn.disabled = false;
          return;
        }
        if (llmBuild.payload) payload.llm = llmBuild.payload;
        if (settings.agentId) payload.agentId = settings.agentId;
        if (settings.sessionKey) payload.sessionKey = settings.sessionKey;

        try {
          const res = await fetch("${apiBase}/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            status.textContent = "Request failed.";
            output.textContent = data?.error || "Unknown error";
            return;
          }

          status.textContent = "Done.";
          if (settings.json) {
            output.textContent = JSON.stringify(data, null, 2);
          } else {
            output.textContent = data?.data?.report || JSON.stringify(data, null, 2);
          }

          renderSnapshot(data);

          if (data?.data?.trace?.phases?.length) {
            const lines = data.data.trace.phases.map(p => {
              const tag = p.ok ? "ok" : "err";
              return \`\${p.phase}: \${tag} (\${p.durationMs}ms)\`;
            });
            trace.textContent = "Trace:\\n" + lines.join("\\n");
          }

          const endedAt = Date.now();
          const duration = data?.data?.trace?.phases?.reduce((sum, p) => sum + (p.durationMs || 0), 0);
          const runtimeMs = duration && duration > 0 ? duration : endedAt - startedAt;
          statusDetail.textContent = "Last run: " + runtimeMs + "ms";

          const state = loadState();
          const nextEntry = { query, ts: Date.now(), settings: storedSettings };
          const nextHistory = [nextEntry, ...state.history.filter(e => e.query !== query)];
          state.history = nextHistory.slice(0, 20);
          state.settings = storedSettings;
          saveState(state);
          renderHistory(state.history);
        } catch (err) {
          status.textContent = "Request failed.";
          output.textContent = String(err);
        } finally {
          runBtn.disabled = false;
        }
      }

      runBtn.addEventListener("click", runQuery);
      queryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runQuery();
      });
      clearBtn.addEventListener("click", () => {
        output.textContent = "";
        trace.textContent = "";
        status.textContent = "Cleared.";
      });
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.textContent || "");
          status.textContent = "Copied output.";
        } catch {
          status.textContent = "Copy failed.";
        }
      });
      downloadBtn.addEventListener("click", () => {
        const content = output.textContent || "";
        if (!content) {
          status.textContent = "Nothing to download.";
          return;
        }
        const ext = jsonToggle.checked ? "json" : "txt";
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "marketbot-report." + ext;
        anchor.click();
        URL.revokeObjectURL(url);
        status.textContent = "Download started.";
      });
      saveBtn.addEventListener("click", () => {
        const state = loadState();
        state.settings = collectSettings({ includeSecrets: false });
        saveState(state);
        status.textContent = "Settings saved.";
      });
      themeSelect.addEventListener("change", () => {
        document.body.dataset.theme = themeSelect.value;
      });
      llmPreset.addEventListener("change", () => {
        applyPreset(llmPreset.value);
      });
      toggleApiKey.addEventListener("click", () => {
        const isHidden = llmApiKey.type === "password";
        llmApiKey.type = isHidden ? "text" : "password";
        toggleApiKey.textContent = isHidden ? "Hide" : "Show";
      });

      async function refreshOpenAiStatus() {
        try {
          const res = await fetch("/auth/openai/status");
          const data = await res.json();
          if (!data.ok) throw new Error("status failed");
          if (data.authenticated) {
            const expires = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "unknown";
            openAiStatus.textContent = "Authenticated · expires " + expires;
          } else {
            openAiStatus.textContent = "Not authenticated";
          }
        } catch (err) {
          openAiStatus.textContent = "Status unavailable";
        }
      }

      async function pollOpenAiStatus() {
        const started = Date.now();
        while (Date.now() - started < 120000) {
          await new Promise((r) => setTimeout(r, 2000));
          await refreshOpenAiStatus();
          if (openAiStatus.textContent && openAiStatus.textContent.startsWith("Authenticated")) {
            return;
          }
        }
      }

      openAiLogin.addEventListener("click", async () => {
        openAiStatus.textContent = "Starting OAuth…";
        try {
          const res = await fetch("/auth/openai/start", { method: "POST" });
          const data = await res.json();
          if (!data.ok || !data.authUrl) {
            openAiStatus.textContent = data.error || "OAuth start failed";
            return;
          }
          window.open(data.authUrl, "_blank", "noopener");
          openAiStatus.textContent = "Waiting for sign-in…";
          await pollOpenAiStatus();
        } catch (err) {
          openAiStatus.textContent = "OAuth error";
        }
      });

      openAiLogout.addEventListener("click", async () => {
        try {
          await fetch("/auth/openai/logout", { method: "POST" });
        } catch {}
        await refreshOpenAiStatus();
      });

      function renderQuickQueries() {
        const presets = [
          "GOOGL stock analysis",
          "BTC breakout watch",
          "AAPL earnings risk check",
          "ETH trend strength",
        ];
        quickRow.innerHTML = "";
        presets.forEach((preset) => {
          const button = document.createElement("button");
          button.className = "quick-button";
          button.textContent = preset;
          button.addEventListener("click", () => {
            queryInput.value = preset;
            runQuery();
          });
          quickRow.appendChild(button);
        });
      }

      const initial = loadState();
      applySettings(initial.settings || {});
      renderHistory(initial.history || []);
      renderQuickQueries();
      refreshOpenAiStatus();

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch]);
      }

      function formatTimestamp(ts) {
        if (!ts) return "";
        const date = new Date(ts);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString();
      }

      function momentumValue(value) {
        const map = {
          strong_bearish: 5,
          bearish: 20,
          neutral: 50,
          bullish: 80,
          strong_bullish: 95,
        };
        return map[value] ?? 50;
      }

      function buildLlmPayload(settings) {
        const llm = {};
        if (settings.llmProvider) llm.provider = settings.llmProvider;
        if (settings.llmModel) llm.model = settings.llmModel;
        if (settings.llmBaseUrl) llm.baseUrl = settings.llmBaseUrl;
        if (settings.llmApiKeyEnv) llm.apiKeyEnv = settings.llmApiKeyEnv;
        if (settings.llmApiKey) llm.apiKey = settings.llmApiKey;
        if (settings.llmJsonMode) llm.jsonMode = true;
        if (settings.llmHeaders) {
          try {
            const parsed = JSON.parse(settings.llmHeaders);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              return { error: "Invalid LLM headers JSON." };
            }
            const headers = {};
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value !== "string") {
                return { error: "LLM headers must be a JSON object of string values." };
              }
              headers[key] = value;
            }
            if (Object.keys(headers).length) llm.headers = headers;
          } catch {
            return { error: "Invalid LLM headers JSON." };
          }
        }
        if (settings.llmTimeout) {
          const parsed = Number(settings.llmTimeout);
          if (Number.isFinite(parsed)) llm.timeoutMs = parsed;
        }
        return { payload: Object.keys(llm).length ? llm : null };
      }
    </script>
  </body>
</html>`;
}

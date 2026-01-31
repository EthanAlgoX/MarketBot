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
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", monospace;
        background: radial-gradient(circle at 10% 10%, #f7f5ff 0%, #eaf3ff 55%, #fdfdfd 100%);
        color: #111111;
      }
      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px 18px 60px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: -0.02em;
      }
      .subtitle {
        font-size: 13px;
        color: #4a4a4a;
      }
      .grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        gap: 16px;
      }
      .panel {
        background: #ffffff;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 14px 32px rgba(17, 23, 40, 0.08);
      }
      .row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .row label {
        font-size: 12px;
        color: #4a4a4a;
      }
      input[type="text"], select {
        border: 1px solid #c9c9c9;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
        min-width: 140px;
        background: #ffffff;
      }
      input[type="text"].query {
        flex: 1 1 420px;
        min-width: 260px;
      }
      button {
        background: #111111;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 9px 14px;
        cursor: pointer;
        font-size: 13px;
      }
      button.secondary {
        background: #e8e8e8;
        color: #111111;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .hint {
        font-size: 12px;
        color: #5f5f5f;
        margin-top: 8px;
      }
      .output {
        margin-top: 14px;
        padding: 14px;
        border-radius: 12px;
        background: #0f172a;
        color: #e2e8f0;
        font-size: 13px;
        white-space: pre-wrap;
        min-height: 160px;
      }
      .status {
        margin-top: 10px;
        font-size: 12px;
        color: #334155;
      }
      .section-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .history {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .history button {
        text-align: left;
        background: #f3f4f6;
        color: #111111;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .history small {
        color: #64748b;
      }
      .trace {
        margin-top: 12px;
        font-size: 12px;
        color: #475569;
        white-space: pre-wrap;
      }
      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>MarketBot GUI</h1>
          <div class="subtitle">Query, analyze, and inspect results.</div>
        </div>
        <div class="subtitle">API: ${apiBase}</div>
      </header>

      <div class="grid">
        <section class="panel">
          <div class="row">
            <label for="query">Query</label>
            <input id="query" class="query" type="text" placeholder="e.g. GOOGL stock analysis" />
            <button id="run">Analyze</button>
            <button id="clear" class="secondary">Clear</button>
          </div>
          <div class="hint">Press Enter to submit. Use the right panel to tweak options.</div>

          <div id="status" class="status">Idle</div>
          <div id="output" class="output">Waiting for input…</div>
          <div id="trace" class="trace"></div>
        </section>

        <section class="panel">
          <div class="section-title">Options</div>
          <div class="row">
            <label for="mode">Mode</label>
            <select id="mode">
              <option value="">auto</option>
              <option value="api">api</option>
              <option value="scrape">scrape</option>
              <option value="mock">mock</option>
            </select>
            <label><input id="search" type="checkbox" /> search</label>
            <label><input id="scrape" type="checkbox" /> scrape</label>
            <label><input id="traceToggle" type="checkbox" /> trace</label>
            <label><input id="jsonToggle" type="checkbox" /> json</label>
          </div>
          <div class="row" style="margin-top:10px;">
            <label for="agentId">Agent</label>
            <input id="agentId" type="text" placeholder="agent id" />
            <label for="sessionKey">Session</label>
            <input id="sessionKey" type="text" placeholder="session key" />
          </div>
          <div class="row" style="margin-top:10px;">
            <button id="copy" class="secondary">Copy Output</button>
            <button id="save" class="secondary">Save Settings</button>
          </div>

          <div class="section-title" style="margin-top:16px;">History</div>
          <div id="history" class="history"></div>
        </section>
      </div>
    </div>

    <script>
      const queryInput = document.getElementById("query");
      const runBtn = document.getElementById("run");
      const clearBtn = document.getElementById("clear");
      const output = document.getElementById("output");
      const status = document.getElementById("status");
      const trace = document.getElementById("trace");
      const historyEl = document.getElementById("history");
      const mode = document.getElementById("mode");
      const searchToggle = document.getElementById("search");
      const scrapeToggle = document.getElementById("scrape");
      const traceToggle = document.getElementById("traceToggle");
      const jsonToggle = document.getElementById("jsonToggle");
      const agentIdInput = document.getElementById("agentId");
      const sessionKeyInput = document.getElementById("sessionKey");
      const copyBtn = document.getElementById("copy");
      const saveBtn = document.getElementById("save");

      const STORAGE_KEY = "marketbot.gui.v1";

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
      }

      function collectSettings() {
        return {
          mode: mode.value,
          search: searchToggle.checked,
          scrape: scrapeToggle.checked,
          trace: traceToggle.checked,
          json: jsonToggle.checked,
          agentId: agentIdInput.value.trim(),
          sessionKey: sessionKeyInput.value.trim(),
        };
      }

      function renderHistory(history) {
        historyEl.innerHTML = "";
        if (!history.length) {
          historyEl.innerHTML = "<small>No history yet.</small>";
          return;
        }
        history.slice(0, 8).forEach((entry, idx) => {
          const btn = document.createElement("button");
          btn.textContent = entry.query;
          btn.title = entry.query;
          btn.addEventListener("click", () => {
            queryInput.value = entry.query;
            applySettings(entry.settings || {});
          });
          historyEl.appendChild(btn);
        });
      }

      async function runQuery() {
        const query = queryInput.value.trim();
        if (!query) {
          status.textContent = "Please enter a query.";
          return;
        }

        runBtn.disabled = true;
        status.textContent = "Running analysis…";
        output.textContent = "";
        trace.textContent = "";

        const settings = collectSettings();
        const payload = { query };
        if (settings.mode) payload.mode = settings.mode;
        if (settings.search) payload.search = true;
        if (settings.scrape) payload.scrape = true;
        if (settings.trace) payload.includeTrace = true;
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

          if (data?.data?.trace?.phases?.length) {
            const lines = data.data.trace.phases.map(p => {
              const tag = p.ok ? "ok" : "err";
              return \`\${p.phase}: \${tag} (\${p.durationMs}ms)\`;
            });
            trace.textContent = "Trace:\\n" + lines.join("\\n");
          }

          const state = loadState();
          const nextEntry = { query, ts: Date.now(), settings };
          const nextHistory = [nextEntry, ...state.history.filter(e => e.query !== query)];
          state.history = nextHistory.slice(0, 20);
          state.settings = settings;
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
      saveBtn.addEventListener("click", () => {
        const state = loadState();
        state.settings = collectSettings();
        saveState(state);
        status.textContent = "Settings saved.";
      });

      const initial = loadState();
      applySettings(initial.settings || {});
      renderHistory(initial.history || []);
    </script>
  </body>
</html>`;
}

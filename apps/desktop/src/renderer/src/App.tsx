import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    marketbot: {
      openControlUi: () => Promise<void>;
      startGateway: () => Promise<void>;
      quickstart: () => Promise<void>;
      stopGateway: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
    };
  }
}

type NavTab = {
  id: string;
  label: string;
  path: string;
};

type HealthStatus = {
  ok: boolean;
  detail?: string;
};

type TraceRun = {
  runId: string;
  createdAt?: string;
  title?: string;
};

const NAV_TABS: NavTab[] = [
  { id: 'desk', label: 'Desk', path: '/desk' },
  { id: 'stocks', label: 'Stocks', path: '/stocks' },
  { id: 'runs', label: 'Runs', path: '/runs' },
  { id: 'chat', label: 'Chat', path: '/chat' },
  { id: 'overview', label: 'Connection', path: '/overview' },
  { id: 'config', label: 'Config', path: '/config' },
  { id: 'channels', label: 'Channels', path: '/channels' },
  { id: 'sessions', label: 'Sessions', path: '/sessions' },
  { id: 'cron', label: 'Cron', path: '/cron' },
  { id: 'logs', label: 'Logs', path: '/logs' },
];

function findTab(id: string) {
  return NAV_TABS.find((tab) => tab.id === id) ?? NAV_TABS[0];
}

function normalizeBase(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildTabUrl(base: string, path: string, token: string) {
  const normalized = normalizeBase(base);
  const url = `${normalized}${path}`;
  if (!token.trim()) return url;
  const encoded = encodeURIComponent(token.trim());
  return `${url}?token=${encoded}`;
}

async function postJson<T>(url: string, params?: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; result?: T };
    if (!data?.ok) return null;
    return (data.result ?? null) as T | null;
  } catch {
    return null;
  }
}

function injectTokenToWebview(webview: Electron.WebviewTag, token: string) {
  if (!token.trim()) return;
  const script = `(() => {
    const KEY = "marketbot.control.settings.v1";
    const raw = localStorage.getItem(KEY);
    let next = {};
    try { if (raw) next = JSON.parse(raw); } catch {}
    next.token = "${token.replace(/"/g, '\\"')}";
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  })();`;
  webview.executeJavaScript(script, true).catch(() => undefined);
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>(
    NAV_TABS.find((tab) => tab.id === 'chat') ?? NAV_TABS[0],
  );
  const [gatewayUrl, setGatewayUrl] = useState('http://127.0.0.1:18789');
  const [gatewayToken, setGatewayToken] = useState('');
  const [health, setHealth] = useState<HealthStatus>({ ok: false, detail: 'Unknown' });
  const [runs, setRuns] = useState<TraceRun[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const logCursorRef = useRef<number | undefined>(undefined);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);

  useEffect(() => {
    window.marketbot?.onGatewayStatus((status) => setRunning(status.running));
  }, []);

  const tabUrl = useMemo(() => {
    return buildTabUrl(gatewayUrl, activeTab.path, gatewayToken);
  }, [gatewayUrl, activeTab, gatewayToken]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;

    const handleLoaded = () => {
      injectTokenToWebview(view, gatewayToken);
    };

    view.addEventListener('did-finish-load', handleLoaded);
    view.loadURL(tabUrl);

    return () => {
      view.removeEventListener('did-finish-load', handleLoaded);
    };
  }, [tabUrl, gatewayToken]);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const poll = async () => {
      const base = normalizeBase(gatewayUrl);
      const healthRes = await postJson<{ ok?: boolean; detail?: string }>(
        `${base}/api/health`,
        {},
      );
      if (mounted) {
        const ok = Boolean(healthRes && (healthRes as { ok?: boolean }).ok !== false);
        setHealth({ ok, detail: ok ? 'Healthy' : 'Unavailable' });
      }

      const runsRes = await postJson<{ runs?: TraceRun[] }>(
        `${base}/api/trace.runs.list`,
        { limit: 5 },
      );
      if (mounted && runsRes?.runs) {
        setRuns(runsRes.runs);
      }

      const logsRes = await postJson<{
        cursor?: number;
        lines?: string[];
      }>(`${base}/api/logs.tail`, {
        cursor: logCursorRef.current,
        limit: 8,
      });
      if (mounted && logsRes?.lines) {
        logCursorRef.current = logsRes.cursor;
        setLogLines(logsRes.lines);
      }
    };

    poll();
    timer = window.setInterval(poll, 5000);

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [gatewayUrl]);

  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) return logLines;
    const needle = logFilter.trim().toLowerCase();
    return logLines.filter((line) => line.toLowerCase().includes(needle));
  }, [logLines, logFilter]);

  const onStart = async () => {
    setBusy(true);
    try {
      await window.marketbot.startGateway();
    } finally {
      setBusy(false);
    }
  };

  const onQuickstart = async () => {
    setBusy(true);
    try {
      await window.marketbot.quickstart();
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await window.marketbot.stopGateway();
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async () => {
    await window.marketbot.openControlUi();
  };

  const onAuthOpen = async () => {
    if (!gatewayToken.trim()) return;
    const url = buildTabUrl(gatewayUrl, '/', gatewayToken);
    await window.marketbot.openExternal(url);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">MB</div>
          <div>
            <div className="title">MarketBot Desktop</div>
            <div className="subtitle">Finance Desk Control UI</div>
          </div>
        </div>

        <div className={`status ${running ? 'ok' : 'off'}`}>
          {running ? 'Gateway running' : 'Gateway stopped'}
        </div>

        <div className="section">
          <div className="section-title">Quick Actions</div>
          <div className="actions">
            <button disabled={busy} onClick={onQuickstart}>
              Quickstart (Qwen3 + UI)
            </button>
            <button disabled={busy} onClick={onStart}>
              Start Gateway
            </button>
            <button disabled={busy || !running} onClick={onStop}>
              Stop Gateway
            </button>
            <button onClick={onOpen}>Open in Browser</button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Gateway URL</div>
          <input
            value={gatewayUrl}
            onChange={(event) => setGatewayUrl(event.target.value)}
            placeholder="http://127.0.0.1:18789"
          />
        </div>

        <div className="section">
          <div className="section-title">Gateway Token</div>
          <input
            value={gatewayToken}
            onChange={(event) => setGatewayToken(event.target.value)}
            placeholder="Paste gateway.auth.token"
          />
          <div className="token-actions">
            <button className="ghost" onClick={onAuthOpen}>
              Open Authenticated URL
            </button>
          </div>
          <div className="hint">
            Token is auto-injected into embedded Control UI and local settings.
          </div>
        </div>

        <div className="section">
          <div className="section-title">Configuration</div>
          <div className="actions">
            <button onClick={() => setActiveTab(findTab('config'))}>
              AI Models
            </button>
            <button onClick={() => setActiveTab(findTab('channels'))}>
              Channels
            </button>
            <button onClick={() => setActiveTab(findTab('sessions'))}>
              Sessions
            </button>
            <button onClick={() => setActiveTab(findTab('overview'))}>
              Gateway
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Navigation</div>
          <nav className="nav">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveTab(tab)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="content">
        <div className="content-header">
          <div>
            <div className="content-title">{activeTab.label}</div>
            <div className="content-subtitle">{tabUrl}</div>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={onOpen}>Open Control UI</button>
          </div>
        </div>
        <div className="content-body">
          <div className="viewer">
            <webview ref={webviewRef} src={tabUrl} className="viewer-frame" />
          </div>
          <aside className="sidepanel">
            <div className="panel-card">
              <div className="panel-title">Run Status</div>
              <div className="panel-list">
                <div className="panel-row">
                  <span>Gateway Health</span>
                  <strong>{health.ok ? 'Healthy' : 'Unavailable'}</strong>
                </div>
                <div className="panel-row">
                  <span>Recent Runs</span>
                  <strong>{runs.length}</strong>
                </div>
                <div className="panel-row">
                  <span>Logs Lines</span>
                  <strong>{filteredLogs.length}</strong>
                </div>
              </div>
            </div>
            <div className="panel-card">
            <div className="panel-title">Run Graph</div>
            {runs.length === 0 ? (
              <div className="panel-note">No runs captured yet.</div>
            ) : (
              <div className="panel-list">
                {runs.map((run) => (
                  <div key={run.runId} className="panel-row">
                    <span>{run.title ?? run.runId.slice(0, 8)}</span>
                    <strong>{run.createdAt ? 'Active' : 'Logged'}</strong>
                  </div>
                ))}
              </div>
            )}
            <button className="ghost" onClick={() => setActiveTab(findTab('runs'))}>
              Go to Runs
            </button>
          </div>
          <div className="panel-card">
            <div className="panel-title">Logs</div>
            <input
              className="log-filter"
                value={logFilter}
                onChange={(event) => setLogFilter(event.target.value)}
                placeholder="Filter logs"
              />
              {filteredLogs.length === 0 ? (
                <div className="panel-note">No log lines yet.</div>
              ) : (
                <div className="log-lines">
                  {filteredLogs.map((line, idx) => (
                    <div key={`${idx}-${line.slice(0, 12)}`} className="log-line">
                      {line}
                    </div>
                  ))}
                </div>
              )}
              <button className="ghost" onClick={() => setActiveTab(findTab('logs'))}>
                Go to Logs
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

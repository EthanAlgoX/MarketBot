import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    marketbot: {
      getGatewayToken: () => Promise<string>;
      getGatewayUrl: () => Promise<string>;
      getWebviewPreloadPath: () => Promise<string>;
      restartGateway: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
    };
  }
}

// ── Navigation ──

type TabId =
  | 'chat'
  | 'desk'
  | 'stocks'
  | 'runs'
  | 'overview'
  | 'config'
  | 'channels'
  | 'sessions'
  | 'cron'
  | 'logs';

interface NavTab {
  id: TabId;
  label: string;
  path: string;
  icon: string;
}

interface NavGroup {
  label: string;
  tabs: NavTab[];
}

const TABS: Record<TabId, NavTab> = {
  chat: {
    id: 'chat',
    label: 'Chat',
    path: '/chat',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5h12M4 8.5h8M4 12h10"/><path d="M3 3h14a1 1 0 011 1v9a1 1 0 01-1 1H7l-4 3V4a1 1 0 011-1z"/></svg>',
  },
  desk: {
    id: 'desk',
    label: 'Desk',
    path: '/desk',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="16" height="12" rx="2"/><path d="M7 18h6M10 15v3"/></svg>',
  },
  stocks: {
    id: 'stocks',
    label: 'Stocks',
    path: '/stocks',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 17l4-6 3 3 4-7 3 4"/></svg>',
  },
  runs: {
    id: 'runs',
    label: 'Runs',
    path: '/runs',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4l10 6-10 6V4z"/></svg>',
  },
  overview: {
    id: 'overview',
    label: 'Connection',
    path: '/overview',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41"/></svg>',
  },
  config: {
    id: 'config',
    label: 'Config',
    path: '/config',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="2.5"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.22 4.22l2.12 2.12M13.66 13.66l2.12 2.12M4.22 15.78l2.12-2.12M13.66 6.34l2.12-2.12"/></svg>',
  },
  channels: {
    id: 'channels',
    label: 'Channels',
    path: '/channels',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2l-2 16M15 2l-2 16M3 7h16M2 13h16"/></svg>',
  },
  sessions: {
    id: 'sessions',
    label: 'Sessions',
    path: '/sessions',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 4V2M13 4V2"/></svg>',
  },
  cron: {
    id: 'cron',
    label: 'Cron Jobs',
    path: '/cron',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><path d="M10 5v5l3 3"/></svg>',
  },
  logs: {
    id: 'logs',
    label: 'Logs',
    path: '/logs',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="14" height="16" rx="1.5"/><path d="M7 6h6M7 10h6M7 14h4"/></svg>',
  },
};

const NAV_GROUPS: NavGroup[] = [
  { label: 'Chat', tabs: [TABS.chat] },
  { label: 'Finance', tabs: [TABS.desk, TABS.stocks, TABS.runs] },
  {
    label: 'Control',
    tabs: [TABS.overview, TABS.config, TABS.channels, TABS.sessions, TABS.cron, TABS.logs],
  },
];

// ── Helpers ──

function normalizeBase(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildTabUrl(base: string, path: string, token: string) {
  const normalized = normalizeBase(base);
  const url = `${normalized}${path}`;
  const params = new URLSearchParams();
  if (token.trim()) params.set('token', token.trim());
  params.set('embed', '1');
  return `${url}?${params.toString()}`;
}

function injectTokenToWebview(webview: HTMLElement & { executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown> }, token: string) {
  if (!token.trim()) return;
  const script = `(() => {
    const KEY = "marketbot.control.settings.v1";
    const raw = localStorage.getItem(KEY);
    let next = {};
    try { if (raw) next = JSON.parse(raw); } catch {}
    next.token = "${token.replace(/"/g, '\\"')}";
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem("marketbot.device.auth.v1");
    return true;
  })();`;
  webview.executeJavaScript(script, true).catch(() => undefined);
}

// ── Boot phases ──

type BootPhase = 'init' | 'starting' | 'connecting' | 'ready';

// ── App Component ──

export default function App() {
  const [phase, setPhase] = useState<BootPhase>('init');
  const [running, setRunning] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [gatewayToken, setGatewayToken] = useState('');
  const [webviewPreload, setWebviewPreload] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const webviewRef = useRef<(HTMLElement & { loadURL: (url: string) => void; reload: () => void; executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown> }) | null>(null);
  const prevUrlRef = useRef('');

  // Phase 1: Fetch config from main process.
  useEffect(() => {
    let mounted = true;
    setPhase('init');

    Promise.all([
      window.marketbot?.getGatewayToken(),
      window.marketbot?.getGatewayUrl(),
      window.marketbot?.getWebviewPreloadPath(),
    ]).then(([token, url, preload]) => {
      if (!mounted) return;
      setGatewayToken(token || '');
      setGatewayUrl(url || 'http://127.0.0.1:18789/');
      setWebviewPreload(preload || '');
      setPhase('starting');
    }).catch(() => {
      if (mounted) setPhase('starting');
    });

    return () => { mounted = false; };
  }, []);

  // Listen for gateway status from main process.
  useEffect(() => {
    window.marketbot?.onGatewayStatus((status) => {
      setRunning(status.running);
    });
  }, []);

  // Phase 2: Poll health until gateway is up.
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'connecting') return;
    let mounted = true;

    const poll = async () => {
      if (!gatewayUrl) return;
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          if (data?.ok !== false) {
            setRunning(true);
            setPhase('ready');
            return;
          }
        }
      } catch {
        // Gateway not up yet.
      }
      if (mounted) setPhase('connecting');
    };

    poll();
    const timer = setInterval(poll, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [phase, gatewayUrl]);

  // Once ready, keep polling health at a slower rate.
  useEffect(() => {
    if (phase !== 'ready') return;
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!mounted) return;
        const ok = res.ok && ((await res.json()) as { ok?: boolean })?.ok !== false;
        setRunning(ok);
        if (!ok) setPhase('connecting');
      } catch {
        if (mounted) {
          setRunning(false);
          setPhase('connecting');
        }
      }
    };

    const timer = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [phase, gatewayUrl]);

  const tabUrl = useMemo(() => {
    if (!gatewayUrl) return '';
    return buildTabUrl(gatewayUrl, TABS[activeTab].path, gatewayToken);
  }, [gatewayUrl, gatewayToken, activeTab]);

  // Navigate webview on tab change.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || !tabUrl) return;
    if (!prevUrlRef.current) {
      prevUrlRef.current = tabUrl;
      return;
    }
    if (tabUrl === prevUrlRef.current) return;
    prevUrlRef.current = tabUrl;
    view.loadURL(tabUrl);
  }, [tabUrl]);

  // Reload webview when gateway comes up after being down.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (phase !== 'ready') return;
    if (running && !wasRunning.current && webviewRef.current && tabUrl) {
      const timer = setTimeout(() => {
        if (webviewRef.current) {
          webviewRef.current.loadURL(tabUrl);
          prevUrlRef.current = tabUrl;
        }
      }, 500);
      wasRunning.current = running;
      return () => clearTimeout(timer);
    }
    wasRunning.current = running;
  }, [running, phase, tabUrl]);

  // Inject token on dom-ready, retry on load failure.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;

    const handleReady = () => {
      injectTokenToWebview(view, gatewayToken);
    };
    const handleFail = () => {
      if (running) {
        setTimeout(() => webviewRef.current?.reload(), 1200);
      }
    };

    view.addEventListener('dom-ready', handleReady);
    view.addEventListener('did-fail-load', handleFail);
    return () => {
      view.removeEventListener('dom-ready', handleReady);
      view.removeEventListener('did-fail-load', handleFail);
    };
  }, [gatewayToken, running]);

  const handleRestart = useCallback(async () => {
    setPhase('connecting');
    await window.marketbot.restartGateway();
  }, []);

  const showWebview = phase === 'ready' && running && tabUrl;

  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="drag-region" />

        <div className="sidebar-header">
          <div className="brand">
            <div className="logo">MB</div>
            {!sidebarCollapsed && (
              <div>
                <div className="title">MarketBot</div>
                <div className="subtitle">Desktop</div>
              </div>
            )}
          </div>
          <button
            className="collapse-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        <div className={`status ${running ? 'ok' : 'off'}`}>
          <span className={`status-dot ${running ? 'ok' : 'off'}`} />
          {!sidebarCollapsed && (running ? 'Connected' : phase === 'init' ? 'Initializing' : 'Connecting')}
        </div>

        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              {!sidebarCollapsed && <div className="nav-group-title">{group.label}</div>}
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <span className="nav-icon" dangerouslySetInnerHTML={{ __html: tab.icon }} />
                  {!sidebarCollapsed && <span className="nav-label">{tab.label}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        {!sidebarCollapsed && (
          <button className="ghost sidebar-btn" onClick={handleRestart} title="Restart gateway">
            <span
              className="nav-icon"
              dangerouslySetInnerHTML={{
                __html:
                  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10a7 7 0 0113.36-2.83M17 10a7 7 0 01-13.36 2.83"/><path d="M16.5 3v4.5H12M3.5 17v-4.5H8"/></svg>',
              }}
            />
            <span>Restart Gateway</span>
          </button>
        )}
      </aside>

      <main className="content">
        {showWebview ? (
          <webview
            ref={webviewRef as React.Ref<HTMLElement>}
            src={tabUrl}
            {...(webviewPreload ? { preload: webviewPreload } : {})}
            className="webview-frame"
          />
        ) : (
          <div className="webview-frame loading-state">
            <div className="loading-content">
              <div className="loading-logo">
                <div className="loading-logo-inner">MB</div>
              </div>
              <div className="loading-text">
                {phase === 'init' && 'Initializing...'}
                {phase === 'starting' && 'Starting gateway...'}
                {phase === 'connecting' && 'Connecting to gateway...'}
              </div>
              <div className="loading-progress">
                <div className="loading-progress-bar" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

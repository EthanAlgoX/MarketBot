import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    marketbot: {
      openControlUi: () => Promise<void>;
      getGatewayToken: () => Promise<string>;
      getWebviewPreloadPath: () => Promise<string>;
      quickstart: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
    };
  }
}

function normalizeBase(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildChatUrl(base: string, token: string) {
  const normalized = normalizeBase(base);
  const url = `${normalized}/chat`;
  const params = new URLSearchParams();
  if (token.trim()) params.set('token', token.trim());
  params.set('embed', '1');
  return `${url}?${params.toString()}`;
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
    localStorage.removeItem("marketbot.device.auth.v1");
    return true;
  })();`;
  webview.executeJavaScript(script, true).catch(() => undefined);
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('http://127.0.0.1:18789');
  const [gatewayToken, setGatewayToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [webviewPreload, setWebviewPreload] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);

  useEffect(() => {
    window.marketbot?.onGatewayStatus((status) => setRunning(status.running));
  }, []);

  // Fetch token + preload path from main process.
  useEffect(() => {
    let mounted = true;
    if (!gatewayToken.trim()) {
      Promise.all([
        window.marketbot?.getGatewayToken(),
        window.marketbot?.getWebviewPreloadPath(),
      ]).then(([token, preloadPath]) => {
        if (mounted) {
          if (token) setGatewayToken(token);
          if (preloadPath) setWebviewPreload(preloadPath);
          setTokenReady(true);
        }
      }).catch(() => {
        if (mounted) setTokenReady(true);
      });
    } else {
      setTokenReady(true);
    }
    return () => {
      mounted = false;
    };
  }, [gatewayToken]);

  const chatUrl = useMemo(() => {
    return buildChatUrl(gatewayUrl, gatewayToken);
  }, [gatewayUrl, gatewayToken]);

  const prevUrlRef = useRef<string>('');

  // Navigate when chatUrl changes.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;
    if (!prevUrlRef.current) {
      prevUrlRef.current = chatUrl;
      return;
    }
    if (chatUrl === prevUrlRef.current) return;
    prevUrlRef.current = chatUrl;
    const timer = window.setTimeout(() => {
      webviewRef.current?.loadURL(chatUrl);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [chatUrl]);

  // Reload webview when gateway comes up.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (webviewRef.current) {
        webviewRef.current.loadURL(chatUrl);
        prevUrlRef.current = chatUrl;
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [running]);

  // Inject token on dom-ready, retry on load failure.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;

    const handleReady = () => {
      injectTokenToWebview(view, gatewayToken);
    };

    const handleFail = () => {
      if (running) {
        window.setTimeout(() => {
          webviewRef.current?.reload();
        }, 1200);
      }
    };

    view.addEventListener('dom-ready', handleReady);
    view.addEventListener('did-fail-load', handleFail);
    return () => {
      view.removeEventListener('dom-ready', handleReady);
      view.removeEventListener('did-fail-load', handleFail);
    };
  }, [gatewayToken, running]);

  // Lightweight health poll to track gateway status.
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          setRunning(Boolean(data?.ok !== false));
        } else {
          setRunning(false);
        }
      } catch {
        if (mounted) setRunning(false);
      }
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [gatewayUrl]);

  const onQuickstart = async () => {
    setBusy(true);
    try {
      await window.marketbot.quickstart();
    } finally {
      setBusy(false);
    }
  };

  const onOpenGateway = async () => {
    const url = buildChatUrl(gatewayUrl, gatewayToken).replace('/chat', '/overview');
    await window.marketbot.openExternal(url);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">MB</div>
          <div>
            <div className="title">MarketBot</div>
            <div className="subtitle">AI Chat</div>
          </div>
        </div>

        <div className={`status ${running ? 'ok' : 'off'}`}>
          {running ? 'Connected' : 'Disconnected'}
        </div>

        {!running && (
          <button className="primary" disabled={busy} onClick={onQuickstart}>
            {busy ? 'Starting...' : 'Start Gateway'}
          </button>
        )}

        <div className="sidebar-spacer" />

        <button className="ghost sidebar-btn" onClick={onOpenGateway}>
          Gateway Settings
        </button>

        <button
          className="ghost sidebar-btn"
          onClick={() => setShowSettings((prev) => !prev)}
        >
          {showSettings ? 'Hide Connection' : 'Connection'}
        </button>

        {showSettings && (
          <div className="settings-panel">
            <label className="field-label">Gateway URL</label>
            <input
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="http://127.0.0.1:18789"
            />
            <label className="field-label">Token</label>
            <input
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="gateway.auth.token"
              type="password"
            />
          </div>
        )}
      </aside>

      <main className="content">
        {tokenReady && running ? (
          <webview
            ref={webviewRef}
            src={chatUrl}
            {...(webviewPreload ? { preload: webviewPreload } : {})}
            className="chat-frame"
          />
        ) : (
          <div className="chat-frame chat-loading">
            {!tokenReady ? 'Loading...' : 'Waiting for gateway...'}
          </div>
        )}
      </main>
    </div>
  );
}

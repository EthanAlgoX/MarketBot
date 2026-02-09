import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  shell,
  session,
} from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import os from 'node:os';

// ── Paths ──

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const APP_NAME = 'MarketBot Desktop';
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}/`;
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith('/apps/desktop') ? resolve(CWD, '../..') : CWD;
const PRELOAD_PATH = join(REPO_ROOT, 'apps/desktop/preload.cjs');
const WEBVIEW_PRELOAD_PATH = join(REPO_ROOT, 'apps/desktop/webview-preload.cjs');

const STATE_DIR = join(os.homedir(), '.marketbot');
const CONFIG_PATH = join(STATE_DIR, 'marketbot.json');

// ── State ──

let mainWindow: BrowserWindow | null = null;
let gatewayProc: ChildProcess | null = null;
let isQuitting = false;
let tray: Tray | null = null;
let updateTimer: NodeJS.Timeout | null = null;
let autoUpdater: (typeof import('electron-updater'))['autoUpdater'] | null = null;
let gatewayToken = '';
let gatewayRestartTimer: NodeJS.Timeout | null = null;

// ── Config & Token bootstrap ──
// Ensures ~/.marketbot/marketbot.json exists with a gateway auth token.
// If none exists, generates one automatically so the app works out of the box.

function ensureConfig(): string {
  // Load .env from repo root (dev mode).
  const dotenvPath = join(REPO_ROOT, '.env');
  if (existsSync(dotenvPath)) {
    try {
      const raw = readFileSync(dotenvPath, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    } catch {
      // Ignore .env parse errors.
    }
  }

  // Resolve config path: env override > ~/.marketbot/marketbot.json.
  const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
  const configPath = envConfigPath
    ? resolve(REPO_ROOT, envConfigPath)
    : CONFIG_PATH;

  // Try reading existing config.
  let config: Record<string, unknown> = {};
  let token = '';

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
      const gw = config.gateway as Record<string, unknown> | undefined;
      const auth = gw?.auth as Record<string, unknown> | undefined;
      if (auth?.token && typeof auth.token === 'string') {
        token = auth.token;
      }
    } catch {
      // Corrupt config — will be regenerated below.
    }
  }

  // Check env fallback.
  if (!token) {
    token = process.env.MARKETBOT_GATEWAY_TOKEN ?? '';
  }

  // Generate token if still missing — first-run bootstrap.
  if (!token) {
    token = randomBytes(24).toString('hex');
    console.log('[Desktop] generated new gateway token');

    // Write config with the generated token.
    const gw = (config.gateway ?? {}) as Record<string, unknown>;
    const auth = (gw.auth ?? {}) as Record<string, unknown>;
    auth.mode = 'token';
    auth.token = token;
    gw.auth = auth;
    gw.port = GATEWAY_PORT;
    config.gateway = gw;

    try {
      mkdirSync(resolve(configPath, '..'), { recursive: true, mode: 0o700 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
      });
      console.log('[Desktop] wrote config to', configPath);
    } catch (err) {
      console.error('[Desktop] failed to write config', err);
    }
  }

  return token;
}

// ── Gateway health ──

async function probeGatewayHealth(timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY_URL}api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: {} }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data?.ok !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function broadcastGatewayStatus(running: boolean) {
  mainWindow?.webContents.send('gateway:status', { running });
}

// ── Gateway lifecycle ──
// Starts the gateway subprocess. If it exits unexpectedly, restarts after
// a brief delay. This gives a "just works" experience — the user never
// needs to manually start the gateway.

function startGateway() {
  if (gatewayProc) return;

  void (async () => {
    // If an external gateway is already running (e.g. CLI), piggyback on it.
    const alreadyRunning = await probeGatewayHealth();
    if (alreadyRunning) {
      console.log('[Desktop] external gateway already running');
      broadcastGatewayStatus(true);
      return;
    }

    console.log('[Desktop] starting gateway subprocess');
    const child = spawn(
      'pnpm',
      ['-s', 'marketbot', 'gateway', 'run', '--bind', 'loopback', '--port', String(GATEWAY_PORT), '--force'],
      {
        cwd: REPO_ROOT,
        env: { ...process.env },
        stdio: 'inherit',
      },
    );
    gatewayProc = child;

    child.on('exit', (code) => {
      console.log('[Desktop] gateway exited', { code });
      gatewayProc = null;
      broadcastGatewayStatus(false);

      // Auto-restart unless we're quitting.
      if (!isQuitting) {
        console.log('[Desktop] scheduling gateway restart in 3s');
        gatewayRestartTimer = setTimeout(() => {
          gatewayRestartTimer = null;
          startGateway();
        }, 3000);
      }
    });

    // Wait briefly then confirm it's up.
    await new Promise((r) => setTimeout(r, 2000));
    const running = await probeGatewayHealth();
    broadcastGatewayStatus(running);
  })();
}

function stopGateway() {
  if (gatewayRestartTimer) {
    clearTimeout(gatewayRestartTimer);
    gatewayRestartTimer = null;
  }
  if (!gatewayProc) return;
  console.log('[Desktop] stopping gateway');
  gatewayProc.kill('SIGTERM');
  gatewayProc = null;
  broadcastGatewayStatus(false);
}

// ── Tray ──

function ensureTray() {
  if (tray) return;
  const svg = `
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="14" rx="3" fill="black"/>
      <path d="M7 16l3-5 3 3 2-4 2 6" stroke="white" stroke-width="1.6" fill="none"/>
    </svg>
  `.trim();
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  );
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show MarketBot',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Restart Gateway',
      click: () => {
        stopGateway();
        startGateway();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

// ── Window ──

const isDevInstance =
  Boolean(process.env.VITE_DEV_SERVER_URL) || Boolean(process.env.ELECTRON_RENDERER_URL);

if (!isDevInstance) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#0b1118',
    title: APP_NAME,
    show: false, // Show after ready-to-show to avoid flash.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      webSecurity: false,
    },
  });

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  const isDev = Boolean(devServerUrl);

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(resolveRendererPath());
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    console.log('[Desktop] ready-to-show');
    if (process.platform === 'darwin') {
      try { app.dock.show(); } catch { /* ignore */ }
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Desktop] did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Desktop] render-process-gone', details);
  });
  mainWindow.webContents.on('console-message', (_e, level, msg, line, src) => {
    console.log(`[Desktop][console ${level}] ${msg} (${src}:${line})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // macOS: cmd+W hides instead of quitting.
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function resolveRendererPath(): string {
  const outRenderer = join(__dirname, '../renderer/index.html');
  if (existsSync(outRenderer)) return outRenderer;
  const distRenderer = join(REPO_ROOT, 'apps/desktop/dist/renderer/index.html');
  if (existsSync(distRenderer)) return distRenderer;
  return outRenderer;
}

// ── Auto-update ──

async function setupAutoUpdates() {
  if (!app.isPackaged || isDevInstance) {
    console.log('[Desktop] auto-update disabled (not packaged)');
    return;
  }
  if (!autoUpdater) {
    try {
      const updater = await import('electron-updater');
      autoUpdater = updater.autoUpdater;
    } catch (error) {
      console.error('[Desktop] auto-update unavailable', error);
      return;
    }
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on('error', (error) => {
    console.error('[Desktop] auto-update error', error);
  });
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Install and Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: 'A new version of MarketBot Desktop is ready to install.',
      detail: 'Restart to apply the update.',
    });
    if (result.response === 0) {
      autoUpdater!.quitAndInstall();
    }
  });
  autoUpdater.checkForUpdatesAndNotify().catch((e) => {
    console.error('[Desktop] auto-update check failed', e);
  });
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(() => {
    autoUpdater!.checkForUpdatesAndNotify().catch((e) => {
      console.error('[Desktop] auto-update check failed', e);
    });
  }, 30 * 60 * 1000);
}

// ── App ready ──

app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId('ai.marketbot.desktop');
  app.setActivationPolicy('regular');
  console.log('[Desktop] ready', { platform: process.platform });

  // Bootstrap config & token before anything else.
  gatewayToken = ensureConfig();

  // CORS bypass for gateway requests from renderer.
  const gatewayFilter = { urls: [`http://127.0.0.1:${GATEWAY_PORT}/*`, `http://localhost:${GATEWAY_PORT}/*`] };
  session.defaultSession.webRequest.onBeforeSendHeaders(gatewayFilter, (details, callback) => {
    const headers = { ...details.requestHeaders };
    delete headers['Origin'];
    callback({ cancel: false, requestHeaders: headers });
  });
  session.defaultSession.webRequest.onHeadersReceived(gatewayFilter, (details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['access-control-allow-origin'] = ['*'];
    headers['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
    headers['access-control-allow-headers'] = ['Content-Type, Authorization'];
    callback({ cancel: false, responseHeaders: headers });
  });

  // Register IPC handlers.
  ipcMain.handle('gateway:token', () => gatewayToken);
  ipcMain.handle('gateway:url', () => GATEWAY_URL);
  ipcMain.handle('webview:preload-path', () => `file://${WEBVIEW_PRELOAD_PATH}`);
  ipcMain.handle('gateway:restart', () => {
    stopGateway();
    startGateway();
  });
  ipcMain.handle('shell:open', (_event, url: string) => {
    if (url?.startsWith('http')) shell.openExternal(url);
  });

  // Create UI.
  if (process.platform === 'darwin') {
    try { app.dock.show(); } catch { /* ignore */ }
  }
  ensureTray();
  createWindow();
  void setupAutoUpdates();

  // Auto-start gateway — the core of "install and use" experience.
  startGateway();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  stopGateway();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
});

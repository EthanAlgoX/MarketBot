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
import { fork, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import os from 'node:os';

// ── Paths ──
// In dev mode, paths resolve relative to the repo root.
// In production (packaged), paths resolve relative to the app bundle's
// Resources directory, where electron-builder places extraResources.

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const APP_NAME = 'MarketBot Desktop';
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}/`;

const IS_PACKAGED = app.isPackaged;

// Dev mode: repo root derived from cwd or __dirname.
// Packaged mode: resources live at process.resourcesPath.
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith('/apps/desktop') ? resolve(CWD, '../..') : CWD;

// In a packaged app, electron-builder copies gateway-bundle/ into
// Contents/Resources/gateway-bundle/ (macOS) or resources/gateway-bundle/
// (Windows/Linux). process.resourcesPath points to that Resources dir.
const GATEWAY_BUNDLE_DIR = IS_PACKAGED
  ? join(process.resourcesPath, 'gateway-bundle')
  : REPO_ROOT;

// Preload scripts: in dev they live under apps/desktop/, in production
// they're packaged into the app.asar (files entry in electron-builder).
function resolvePreloadPath(): string {
  if (IS_PACKAGED) {
    // electron-builder puts files from the "files" config into the asar.
    // preload.cjs is at the root of the asar archive.
    return join(app.getAppPath(), 'preload.cjs');
  }
  return join(REPO_ROOT, 'apps/desktop/preload.cjs');
}

function resolveWebviewPreloadPath(): string {
  if (IS_PACKAGED) {
    return join(app.getAppPath(), 'webview-preload.cjs');
  }
  return join(REPO_ROOT, 'apps/desktop/webview-preload.cjs');
}

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
  // Load .env from repo root (dev mode only — packaged apps use the config file).
  if (!IS_PACKAGED) {
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

    console.log('[Desktop] starting gateway subprocess', { packaged: IS_PACKAGED });

    let child: ChildProcess;

    if (IS_PACKAGED) {
      // Production mode: fork the bundled marketbot.mjs using Electron's
      // embedded Node.js runtime. The gateway-bundle/ directory contains
      // the compiled dist/, node_modules/, and marketbot.mjs.
      const entryScript = join(GATEWAY_BUNDLE_DIR, 'marketbot.mjs');
      const gatewayArgs = [
        'gateway', 'run',
        '--bind', 'loopback',
        '--port', String(GATEWAY_PORT),
        '--force',
      ];

      console.log('[Desktop] forking', entryScript, gatewayArgs);
      child = fork(entryScript, gatewayArgs, {
        cwd: GATEWAY_BUNDLE_DIR,
        env: {
          ...process.env,
          // Ensure the gateway finds its own node_modules.
          NODE_PATH: join(GATEWAY_BUNDLE_DIR, 'node_modules'),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        // Use Electron's built-in Node.js to run the script.
        execPath: process.execPath,
        execArgv: ['--no-warnings'],
      });

      // Capture stdout/stderr for debugging.
      child.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(`[Gateway] ${data.toString()}`);
      });
      child.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(`[Gateway:err] ${data.toString()}`);
      });
    } else {
      // Dev mode: spawn via pnpm which resolves the CLI from the monorepo.
      child = spawn(
        'pnpm',
        ['-s', 'marketbot', 'gateway', 'run', '--bind', 'loopback', '--port', String(GATEWAY_PORT), '--force'],
        {
          cwd: REPO_ROOT,
          env: { ...process.env },
          stdio: 'inherit',
        },
      );
    }

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
  const preloadPath = resolvePreloadPath();
  console.log('[Desktop] preload path:', preloadPath);

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
      preload: preloadPath,
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
  // In packaged mode, electron-vite outputs to dist/renderer/ inside the asar.
  if (IS_PACKAGED) {
    const asarRenderer = join(app.getAppPath(), 'dist/renderer/index.html');
    if (existsSync(asarRenderer)) return asarRenderer;
  }
  const outRenderer = join(__dirname, '../renderer/index.html');
  if (existsSync(outRenderer)) return outRenderer;
  const distRenderer = join(REPO_ROOT, 'apps/desktop/dist/renderer/index.html');
  if (existsSync(distRenderer)) return distRenderer;
  return outRenderer;
}

// ── Auto-update ──

async function setupAutoUpdates() {
  if (!IS_PACKAGED || isDevInstance) {
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
  console.log('[Desktop] ready', {
    platform: process.platform,
    packaged: IS_PACKAGED,
    resourcesPath: IS_PACKAGED ? process.resourcesPath : 'N/A (dev)',
    gatewayBundle: GATEWAY_BUNDLE_DIR,
  });

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
  const webviewPreloadPath = resolveWebviewPreloadPath();
  ipcMain.handle('gateway:token', () => gatewayToken);
  ipcMain.handle('gateway:url', () => GATEWAY_URL);
  ipcMain.handle('webview:preload-path', () => `file://${webviewPreloadPath}`);
  ipcMain.handle('gateway:restart', () => {
    stopGateway();
    startGateway();
  });
  ipcMain.handle('shell:open', (_event, url: string) => {
    if (url?.startsWith('http')) shell.openExternal(url);
  });

  // Onboarding IPC: read/write config for the setup wizard.
  ipcMain.handle('config:read', () => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      if (existsSync(configPath)) {
        return JSON.parse(readFileSync(configPath, 'utf8'));
      }
    } catch { /* ignore */ }
    return {};
  });

  ipcMain.handle('config:write', (_event, patch: Record<string, unknown>) => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      let config: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* ignore */ }
      }
      // Deep merge patch into config.
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) &&
            typeof config[key] === 'object' && config[key] !== null && !Array.isArray(config[key])) {
          config[key] = { ...(config[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
        } else {
          config[key] = value;
        }
      }
      mkdirSync(resolve(configPath, '..'), { recursive: true, mode: 0o700 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
      });
      console.log('[Desktop] config updated via IPC');
      return { ok: true };
    } catch (err) {
      console.error('[Desktop] config:write failed', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('config:check-onboarding', () => {
    // Check if the user has completed onboarding by looking for:
    // 1. Auth profiles in ~/.marketbot/agents/main/agent/auth-profiles.json
    // 2. Legacy provider config in the main config file
    // 3. The _desktop.onboardingComplete flag
    // 4. Environment variable API keys
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;

      // Check the auth-profiles store for any configured credentials.
      const authStorePath = join(STATE_DIR, 'agents', 'main', 'agent', 'auth-profiles.json');
      let hasAuthProfiles = false;
      if (existsSync(authStorePath)) {
        try {
          const store = JSON.parse(readFileSync(authStorePath, 'utf8'));
          hasAuthProfiles = store?.profiles && Object.keys(store.profiles).length > 0;
        } catch { /* ignore */ }
      }

      if (hasAuthProfiles) return { needsOnboarding: false };

      // Check environment variable API keys.
      if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
        return { needsOnboarding: false };
      }

      // Check main config file.
      if (!existsSync(configPath)) return { needsOnboarding: true };
      const config = JSON.parse(readFileSync(configPath, 'utf8'));

      const hasOnboardingDone = config._desktop?.onboardingComplete === true;
      if (hasOnboardingDone) return { needsOnboarding: false };

      // Check for auth.profiles in config (legacy/alternative config pattern).
      const authProfiles = config.auth?.profiles;
      if (authProfiles && typeof authProfiles === 'object' && Object.keys(authProfiles).length > 0) {
        return { needsOnboarding: false };
      }

      return { needsOnboarding: true };
    } catch {
      return { needsOnboarding: true };
    }
  });

  ipcMain.handle('config:mark-onboarding-done', () => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      let config: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* ignore */ }
      }
      config._desktop = { ...(config._desktop as Record<string, unknown> ?? {}), onboardingComplete: true };
      mkdirSync(resolve(configPath, '..'), { recursive: true, mode: 0o700 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Credentials IPC: write API key credentials to the auth-profiles store.
  // The store lives at ~/.marketbot/agents/main/agent/auth-profiles.json.
  ipcMain.handle('credentials:write', (_event, args: {
    profileId: string;
    provider: string;
    apiKey: string;
  }) => {
    try {
      const agentDir = join(STATE_DIR, 'agents', 'main', 'agent');
      const authStorePath = join(agentDir, 'auth-profiles.json');

      // Ensure directory exists.
      mkdirSync(agentDir, { recursive: true, mode: 0o700 });

      // Load existing store or create new one.
      let store: { version: number; profiles: Record<string, unknown> } = {
        version: 1,
        profiles: {},
      };
      if (existsSync(authStorePath)) {
        try {
          const raw = JSON.parse(readFileSync(authStorePath, 'utf8'));
          if (raw && typeof raw === 'object' && raw.profiles) {
            store = raw;
          }
        } catch { /* ignore corrupt file */ }
      }

      // Upsert the credential.
      store.profiles[args.profileId] = {
        type: 'api_key',
        provider: args.provider,
        key: args.apiKey,
      };

      writeFileSync(authStorePath, JSON.stringify(store, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
      });
      console.log('[Desktop] credentials written for', args.profileId);
      return { ok: true };
    } catch (err) {
      console.error('[Desktop] credentials:write failed', err);
      return { ok: false, error: String(err) };
    }
  });

  // ── Ollama Local Model Management ──

  const OLLAMA_API = 'http://127.0.0.1:11434';

  // Check if ollama is running and list installed models.
  ipcMain.handle('ollama:check', async () => {
    try {
      const res = await fetch(`${OLLAMA_API}/api/tags`);
      if (!res.ok) return { available: false, models: [] };
      const data = (await res.json()) as { models?: { name: string; size: number }[] };
      const models = (data.models || []).map((m) => m.name);
      return { available: true, models };
    } catch {
      return { available: false, models: [] };
    }
  });

  // Pull (download) an ollama model, streaming progress to the renderer.
  ipcMain.handle('ollama:pull', async (_event, modelId: string) => {
    try {
      const res = await fetch(`${OLLAMA_API}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: true }),
      });
      if (!res.ok || !res.body) {
        return { ok: false, error: `Ollama returned ${res.status}` };
      }

      // Read NDJSON stream line by line.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines.
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const progress = JSON.parse(line) as {
              status: string;
              digest?: string;
              total?: number;
              completed?: number;
            };
            const percent =
              progress.total && progress.completed
                ? Math.round((progress.completed / progress.total) * 100)
                : undefined;
            mainWindow?.webContents.send('ollama:pull-progress', {
              model: modelId,
              status: progress.status,
              completed: progress.completed,
              total: progress.total,
              percent,
              done: progress.status === 'success',
            });
          } catch { /* skip malformed lines */ }
        }
      }

      // Process any remaining buffer.
      if (buffer.trim()) {
        try {
          const progress = JSON.parse(buffer);
          mainWindow?.webContents.send('ollama:pull-progress', {
            model: modelId,
            status: progress.status,
            done: progress.status === 'success',
          });
        } catch { /* ignore */ }
      }

      // After successful pull, ensure ollama credentials exist so auto-discovery works.
      const agentDir = join(STATE_DIR, 'agents', 'main', 'agent');
      const authStorePath = join(agentDir, 'auth-profiles.json');
      mkdirSync(agentDir, { recursive: true, mode: 0o700 });
      let store: { version: number; profiles: Record<string, unknown> } = {
        version: 1,
        profiles: {},
      };
      if (existsSync(authStorePath)) {
        try {
          const raw = JSON.parse(readFileSync(authStorePath, 'utf8'));
          if (raw && typeof raw === 'object' && raw.profiles) {
            store = raw;
          }
        } catch { /* ignore */ }
      }
      if (!store.profiles['ollama:default']) {
        store.profiles['ollama:default'] = {
          type: 'api_key',
          provider: 'ollama',
          key: 'ollama-local',
        };
        writeFileSync(authStorePath, JSON.stringify(store, null, 2) + '\n', {
          encoding: 'utf-8',
          mode: 0o600,
        });
        console.log('[Desktop] ollama credentials auto-created');
      }

      console.log('[Desktop] ollama:pull completed for', modelId);
      return { ok: true };
    } catch (err) {
      const errorMsg = String(err);
      mainWindow?.webContents.send('ollama:pull-progress', {
        model: modelId,
        status: 'error',
        done: true,
        error: errorMsg,
      });
      console.error('[Desktop] ollama:pull failed', err);
      return { ok: false, error: errorMsg };
    }
  });

  // Set an ollama model as the primary model in config.
  ipcMain.handle('ollama:set-model', async (_event, modelId: string) => {
    try {
      // Read current config.
      let config: Record<string, unknown> = {};
      if (existsSync(CONFIG_PATH)) {
        try {
          config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
        } catch { /* start fresh */ }
      }

      // Deep-merge the primary model setting.
      const agents = (config.agents as Record<string, unknown>) || {};
      const defaults = (agents.defaults as Record<string, unknown>) || {};
      const model = (defaults.model as Record<string, unknown>) || {};
      model.primary = `ollama/${modelId}`;
      defaults.model = model;
      agents.defaults = defaults;
      config.agents = agents;

      mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
      });

      console.log('[Desktop] primary model set to ollama/' + modelId);
      return { ok: true };
    } catch (err) {
      console.error('[Desktop] ollama:set-model failed', err);
      return { ok: false, error: String(err) };
    }
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

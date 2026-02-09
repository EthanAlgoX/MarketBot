import { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const APP_NAME = 'MarketBot Desktop';
const GATEWAY_URL = 'http://127.0.0.1:18789/';
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith('/apps/desktop') ? resolve(CWD, '../..') : CWD;
const PRELOAD_PATH = join(REPO_ROOT, 'apps/desktop/preload.cjs');

let mainWindow: BrowserWindow | null = null;
let gatewayProc: ChildProcess | null = null;
let isQuitting = false;
let dockPulseTimer: NodeJS.Timeout | null = null;
let tray: Tray | null = null;
let updateTimer: NodeJS.Timeout | null = null;
let autoUpdater: typeof import('electron-updater').autoUpdater | null = null;
let visibilityTimer: NodeJS.Timeout | null = null;

async function probeGatewayHealth(timeoutMs = 1200) {
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

function ensureDockVisible() {
  if (process.platform !== 'darwin') return;
  try {
    app.dock.show();
    console.log('[Desktop] dock show called');
  } catch {
    // Ignore dock errors in dev.
  }
}

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
      label: 'Show MarketBot Desktop',
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
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

const isDevInstance =
  Boolean(process.env.VITE_DEV_SERVER_URL) || Boolean(process.env.ELECTRON_RENDERER_URL);
if (!isDevInstance) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
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
    backgroundColor: '#0b1118',
    title: APP_NAME,
    show: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  const isDev = Boolean(devServerUrl);
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const rendererPath = resolveRendererPath();
    mainWindow.loadFile(rendererPath);
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.show();
  mainWindow.focus();
  console.log('[Desktop] window created', { visible: mainWindow.isVisible() });
  if (visibilityTimer) clearInterval(visibilityTimer);
  visibilityTimer = setInterval(() => {
    if (!mainWindow || isQuitting) return;
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      console.log('[Desktop] forced show (visibility guard)');
    }
  }, 1000);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.center();
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow?.show();
    mainWindow?.focus();
    console.log('[Desktop] ready-to-show', { visible: mainWindow?.isVisible() });
    if (process.platform === 'darwin') {
      ensureDockVisible();
    }
    app.focus({ steal: true });
    mainWindow?.setAlwaysOnTop(true, 'screen-saver');
    setTimeout(() => {
      if (mainWindow) mainWindow.setAlwaysOnTop(false);
    }, 2000);
  });

  // Safety net in case ready-to-show is never fired.
  setTimeout(() => {
    if (!mainWindow) return;
    if (!mainWindow.isVisible()) {
      mainWindow.center();
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.show();
      mainWindow.focus();
      console.log('[Desktop] forced show after timeout', { visible: mainWindow.isVisible() });
      if (process.platform === 'darwin') {
        ensureDockVisible();
      }
      app.focus({ steal: true });
    }
  }, 800);

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[Desktop] did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Desktop] render-process-gone', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Desktop] renderer unresponsive');
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Desktop][console ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (visibilityTimer) {
      clearInterval(visibilityTimer);
      visibilityTimer = null;
    }
  });

  mainWindow.on('show', () => {
    console.log('[Desktop] window show');
  });

  mainWindow.on('hide', () => {
    console.log('[Desktop] window hide');
    if (!isQuitting) {
      setTimeout(() => {
        mainWindow?.show();
        mainWindow?.focus();
      }, 100);
    }
  });

  mainWindow.on('minimize', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.restore();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function resolveRendererPath() {
  const outRenderer = join(__dirname, '../renderer/index.html');
  if (existsSync(outRenderer)) return outRenderer;
  const distRenderer = join(REPO_ROOT, 'apps/desktop/dist/renderer/index.html');
  if (existsSync(distRenderer)) return distRenderer;
  return outRenderer;
}

function runGateway(command: string[], env?: NodeJS.ProcessEnv) {
  if (gatewayProc) {
    return;
  }
  void (async () => {
    const alreadyRunning = await probeGatewayHealth();
    if (alreadyRunning) {
      mainWindow?.webContents.send('gateway:status', { running: true });
      return;
    }
    gatewayProc = spawn(command[0], command.slice(1), {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    gatewayProc.on('exit', async () => {
      gatewayProc = null;
      const stillRunning = await probeGatewayHealth();
      mainWindow?.webContents.send('gateway:status', { running: stillRunning });
    });

    mainWindow?.webContents.send('gateway:status', { running: true });
  })();
}

function stopGateway() {
  if (!gatewayProc) return;
  gatewayProc.kill('SIGTERM');
  gatewayProc = null;
  mainWindow?.webContents.send('gateway:status', { running: false });
}

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
  // macOS auto-updates require a signed app; unsigned builds can check but may not install.
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
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('[Desktop] auto-update check failed', error);
  });
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('[Desktop] auto-update check failed', error);
    });
  }, 30 * 60 * 1000);
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId('ai.marketbot.desktop');
  app.setActivationPolicy('regular');
  console.log('[Desktop] ready', { platform: process.platform, name: app.getName() });
  ensureDockVisible();
  ensureTray();
  createWindow();
  void setupAutoUpdates();

  if (process.platform === 'darwin') {
    if (dockPulseTimer) clearInterval(dockPulseTimer);
    dockPulseTimer = setInterval(() => {
      ensureDockVisible();
    }, 1200);
    setTimeout(() => {
      if (dockPulseTimer) clearInterval(dockPulseTimer);
      dockPulseTimer = null;
    }, 8000);
  }

  runGateway(['pnpm', '-s', 'marketbot', 'gateway', 'run', '--bind', 'loopback', '--port', '18789', '--force']);

  ipcMain.handle('gateway:open', () => {
    shell.openExternal(GATEWAY_URL);
  });

  ipcMain.handle('shell:open', (_event, url: string) => {
    if (!url?.startsWith('http')) return;
    shell.openExternal(url);
  });

ipcMain.handle('gateway:quickstart', () => {
  runGateway(['pnpm', 'quickstart:web', '--', '--no-open'], {
    OLLAMA_API_KEY: 'ollama-local',
  });
});

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (dockPulseTimer) {
    clearInterval(dockPulseTimer);
    dockPulseTimer = null;
  }
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
  ipcMain.handle('gateway:token', () => {
    try {
      const configPath = join(os.homedir(), '.marketbot', 'marketbot.json');
      if (!existsSync(configPath)) return '';
      const raw = readFileSync(configPath, 'utf8');
      const data = JSON.parse(raw) as {
        gateway?: { auth?: { mode?: string; token?: string } };
      };
      const auth = data.gateway?.auth;
      if (auth?.mode !== 'token') return '';
      return auth?.token ?? '';
    } catch (error) {
      console.error('[Desktop] failed to read gateway token', error);
      return '';
    }
  });

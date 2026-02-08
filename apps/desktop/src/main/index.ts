import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const APP_NAME = 'MarketBot Desktop';
const GATEWAY_URL = 'http://127.0.0.1:18789/';
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith('/apps/desktop') ? resolve(CWD, '../..') : CWD;
const PRELOAD_PATH = join(REPO_ROOT, 'apps/desktop/preload.cjs');

let mainWindow: BrowserWindow | null = null;
let gatewayProc: ChildProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    backgroundColor: '#0b1118',
    title: APP_NAME,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const rendererPath = join(__dirname, '../renderer/index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function runGateway(command: string[], env?: NodeJS.ProcessEnv) {
  if (gatewayProc) {
    return;
  }
  gatewayProc = spawn(command[0], command.slice(1), {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  gatewayProc.on('exit', () => {
    gatewayProc = null;
    mainWindow?.webContents.send('gateway:status', { running: false });
  });

  mainWindow?.webContents.send('gateway:status', { running: true });
}

function stopGateway() {
  if (!gatewayProc) return;
  gatewayProc.kill('SIGTERM');
  gatewayProc = null;
  mainWindow?.webContents.send('gateway:status', { running: false });
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId('ai.marketbot.desktop');
  createWindow();

  ipcMain.handle('gateway:open', () => {
    shell.openExternal(GATEWAY_URL);
  });

  ipcMain.handle('shell:open', (_event, url: string) => {
    if (!url?.startsWith('http')) return;
    shell.openExternal(url);
  });

  ipcMain.handle('gateway:start', () => {
    runGateway(['pnpm', '-s', 'marketbot', 'gateway', 'run', '--bind', 'loopback', '--port', '18789', '--force']);
  });

ipcMain.handle('gateway:quickstart', () => {
  runGateway(['pnpm', 'quickstart:web', '--', '--no-open'], {
    OLLAMA_API_KEY: 'ollama-local',
  });
});

  ipcMain.handle('gateway:stop', () => {
    stopGateway();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopGateway();
});

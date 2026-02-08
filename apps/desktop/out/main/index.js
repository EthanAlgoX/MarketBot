import { app, BrowserWindow, ipcMain, shell, nativeImage, Tray, Menu } from "electron";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = resolve(__filename$1, "..");
const APP_NAME = "MarketBot Desktop";
const GATEWAY_URL = "http://127.0.0.1:18789/";
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith("/apps/desktop") ? resolve(CWD, "../..") : CWD;
const PRELOAD_PATH = join(REPO_ROOT, "apps/desktop/preload.cjs");
let mainWindow = null;
let gatewayProc = null;
let isQuitting = false;
let dockPulseTimer = null;
let tray = null;
function ensureDockVisible() {
  if (process.platform !== "darwin") return;
  try {
    app.dock.show();
    console.log("[Desktop] dock show called");
  } catch {
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
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  );
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
  const menu = Menu.buildFromTemplate([
    {
      label: "Show MarketBot Desktop",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}
const isDevInstance = Boolean(process.env.VITE_DEV_SERVER_URL) || Boolean(process.env.ELECTRON_RENDERER_URL);
if (!isDevInstance) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on("second-instance", () => {
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
    backgroundColor: "#0b1118",
    title: APP_NAME,
    show: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  const isDev = Boolean(devServerUrl);
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const rendererPath = join(__dirname$1, "../renderer/index.html");
    mainWindow.loadFile(rendererPath);
  }
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.show();
  mainWindow.focus();
  console.log("[Desktop] window created", { visible: mainWindow.isVisible() });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.center();
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow?.show();
    mainWindow?.focus();
    console.log("[Desktop] ready-to-show", { visible: mainWindow?.isVisible() });
    if (process.platform === "darwin") {
      ensureDockVisible();
    }
    app.focus({ steal: true });
    mainWindow?.setAlwaysOnTop(true, "screen-saver");
    setTimeout(() => {
      if (mainWindow) mainWindow.setAlwaysOnTop(false);
    }, 2e3);
  });
  setTimeout(() => {
    if (!mainWindow) return;
    if (!mainWindow.isVisible()) {
      mainWindow.center();
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.show();
      mainWindow.focus();
      console.log("[Desktop] forced show after timeout", { visible: mainWindow.isVisible() });
      if (process.platform === "darwin") {
        ensureDockVisible();
      }
      app.focus({ steal: true });
    }
  }, 800);
  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("[Desktop] did-fail-load", { code, desc, url });
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Desktop] render-process-gone", details);
  });
  mainWindow.webContents.on("unresponsive", () => {
    console.error("[Desktop] renderer unresponsive");
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[Desktop][console ${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("show", () => {
    console.log("[Desktop] window show");
  });
  mainWindow.on("hide", () => {
    console.log("[Desktop] window hide");
  });
  mainWindow.on("minimize", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.restore();
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.show();
    mainWindow?.focus();
  });
}
function runGateway(command, env) {
  if (gatewayProc) {
    return;
  }
  gatewayProc = spawn(command[0], command.slice(1), {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  gatewayProc.on("exit", () => {
    gatewayProc = null;
    mainWindow?.webContents.send("gateway:status", { running: false });
  });
  mainWindow?.webContents.send("gateway:status", { running: true });
}
function stopGateway() {
  if (!gatewayProc) return;
  gatewayProc.kill("SIGTERM");
  gatewayProc = null;
  mainWindow?.webContents.send("gateway:status", { running: false });
}
app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId("ai.marketbot.desktop");
  app.setActivationPolicy("regular");
  console.log("[Desktop] ready", { platform: process.platform, name: app.getName() });
  ensureDockVisible();
  ensureTray();
  createWindow();
  if (process.platform === "darwin") {
    if (dockPulseTimer) clearInterval(dockPulseTimer);
    dockPulseTimer = setInterval(() => {
      ensureDockVisible();
    }, 1200);
    setTimeout(() => {
      if (dockPulseTimer) clearInterval(dockPulseTimer);
      dockPulseTimer = null;
    }, 8e3);
  }
  runGateway(["pnpm", "-s", "marketbot", "gateway", "run", "--bind", "loopback", "--port", "18789", "--force"]);
  ipcMain.handle("gateway:open", () => {
    shell.openExternal(GATEWAY_URL);
  });
  ipcMain.handle("shell:open", (_event, url) => {
    if (!url?.startsWith("http")) return;
    shell.openExternal(url);
  });
  ipcMain.handle("gateway:start", () => {
    runGateway(["pnpm", "-s", "marketbot", "gateway", "run", "--bind", "loopback", "--port", "18789", "--force"]);
  });
  ipcMain.handle("gateway:quickstart", () => {
    runGateway(["pnpm", "quickstart:web", "--", "--no-open"], {
      OLLAMA_API_KEY: "ollama-local"
    });
  });
  ipcMain.handle("gateway:stop", () => {
    stopGateway();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  isQuitting = true;
  if (dockPulseTimer) {
    clearInterval(dockPulseTimer);
    dockPulseTimer = null;
  }
  stopGateway();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
});

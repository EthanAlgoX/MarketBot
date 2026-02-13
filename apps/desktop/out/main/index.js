import { app, BrowserWindow, dialog, shell, session, ipcMain, nativeImage, Tray, Menu } from "electron";
import { fork, spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import os from "node:os";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function applyMergePatch(base, patch) {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch;
  const result = typeof base === "object" && base !== null && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const baseVal = result[key];
      result[key] = applyMergePatch(
        typeof baseVal === "object" && baseVal !== null && !Array.isArray(baseVal) ? baseVal : {},
        value
      );
      continue;
    }
    result[key] = value;
  }
  return result;
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = resolve(__filename$1, "..");
const APP_NAME = "MarketBot Desktop";
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}/`;
const IS_PACKAGED = app.isPackaged;
const CWD = process.cwd();
const REPO_ROOT = CWD.endsWith("/apps/desktop") ? resolve(CWD, "../..") : CWD;
const GATEWAY_BUNDLE_DIR = IS_PACKAGED ? join(process.resourcesPath, "gateway-bundle") : REPO_ROOT;
const GATEWAY_NODE_FALLBACK = "/opt/homebrew/bin/node";
function resolveGatewayExecPath() {
  const envNode = process.env.MARKETBOT_GATEWAY_NODE?.trim();
  if (envNode && existsSync(envNode)) return envNode;
  if (existsSync(GATEWAY_NODE_FALLBACK)) return GATEWAY_NODE_FALLBACK;
  return process.execPath;
}
function resolvePreloadPath() {
  if (IS_PACKAGED) {
    return join(app.getAppPath(), "preload.cjs");
  }
  return join(REPO_ROOT, "apps/desktop/preload.cjs");
}
function resolveWebviewPreloadPath() {
  if (IS_PACKAGED) {
    return join(app.getAppPath(), "webview-preload.cjs");
  }
  return join(REPO_ROOT, "apps/desktop/webview-preload.cjs");
}
const STATE_DIR = join(os.homedir(), ".marketbot");
const CONFIG_PATH = join(STATE_DIR, "marketbot.json");
function isRunningFromDiskImage() {
  if (!IS_PACKAGED) return false;
  const resources = process.resourcesPath || "";
  return resources.startsWith("/Volumes/");
}
let mainWindow = null;
let gatewayProc = null;
let isQuitting = false;
let tray = null;
let updateTimer = null;
let autoUpdater = null;
let gatewayToken = "";
let gatewayRestartTimer = null;
function ensureConfig() {
  if (!IS_PACKAGED) {
    const dotenvPath = join(REPO_ROOT, ".env");
    if (existsSync(dotenvPath)) {
      try {
        const raw = readFileSync(dotenvPath, "utf8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx <= 0) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!(key in process.env)) {
            process.env[key] = val;
          }
        }
      } catch {
      }
    }
  }
  const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
  const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
  let config = {};
  let token = "";
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
      const gw = config.gateway;
      const auth = gw?.auth;
      if (auth?.token && typeof auth.token === "string") {
        token = auth.token;
      }
    } catch {
    }
  }
  if (!token) {
    token = process.env.MARKETBOT_GATEWAY_TOKEN ?? "";
  }
  if (!token) {
    token = randomBytes(24).toString("hex");
    console.log("[Desktop] generated new gateway token");
    const gw = config.gateway ?? {};
    const auth = gw.auth ?? {};
    auth.mode = "token";
    auth.token = token;
    gw.auth = auth;
    gw.port = GATEWAY_PORT;
    config.gateway = gw;
    try {
      mkdirSync(resolve(configPath, ".."), { recursive: true, mode: 448 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
        encoding: "utf-8",
        mode: 384
      });
      console.log("[Desktop] wrote config to", configPath);
    } catch (err) {
      console.error("[Desktop] failed to write config", err);
    }
  }
  return token;
}
async function probeGatewayHealth(timeoutMs = 2e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY_URL}api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: {} }),
      signal: controller.signal
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
function broadcastGatewayStatus(running) {
  mainWindow?.webContents.send("gateway:status", { running });
}
function startGateway() {
  if (gatewayProc) return;
  void (async () => {
    const alreadyRunning = await probeGatewayHealth();
    if (alreadyRunning) {
      console.log("[Desktop] external gateway already running");
      broadcastGatewayStatus(true);
      return;
    }
    console.log("[Desktop] starting gateway subprocess", { packaged: IS_PACKAGED });
    let child;
    if (IS_PACKAGED) {
      const entryScript = join(GATEWAY_BUNDLE_DIR, "marketbot.mjs");
      const gatewayArgs = [
        "gateway",
        "run",
        "--bind",
        "loopback",
        "--port",
        String(GATEWAY_PORT),
        "--force"
      ];
      console.log("[Desktop] forking", entryScript, gatewayArgs);
      const gatewayExecPath = resolveGatewayExecPath();
      console.log("[Desktop] gateway execPath", gatewayExecPath);
      child = fork(entryScript, gatewayArgs, {
        cwd: GATEWAY_BUNDLE_DIR,
        env: {
          ...process.env,
          // Ensure the gateway finds its own node_modules.
          NODE_PATH: join(GATEWAY_BUNDLE_DIR, "node_modules")
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        // Prefer system Node when available (gateway requires Node 22+).
        execPath: gatewayExecPath,
        execArgv: ["--no-warnings"]
      });
      child.stdout?.on("data", (data) => {
        process.stdout.write(`[Gateway] ${data.toString()}`);
      });
      child.stderr?.on("data", (data) => {
        process.stderr.write(`[Gateway:err] ${data.toString()}`);
      });
    } else {
      child = spawn(
        "pnpm",
        ["-s", "marketbot", "gateway", "run", "--bind", "loopback", "--port", String(GATEWAY_PORT), "--force"],
        {
          cwd: REPO_ROOT,
          env: { ...process.env },
          stdio: "inherit"
        }
      );
    }
    gatewayProc = child;
    child.on("exit", (code) => {
      console.log("[Desktop] gateway exited", { code });
      gatewayProc = null;
      broadcastGatewayStatus(false);
      if (!isQuitting) {
        console.log("[Desktop] scheduling gateway restart in 3s");
        gatewayRestartTimer = setTimeout(() => {
          gatewayRestartTimer = null;
          startGateway();
        }, 3e3);
      }
    });
    await new Promise((r) => setTimeout(r, 2e3));
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
  console.log("[Desktop] stopping gateway");
  gatewayProc.kill("SIGTERM");
  gatewayProc = null;
  broadcastGatewayStatus(false);
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
      label: "Show MarketBot",
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
      label: "Restart Gateway",
      click: () => {
        stopGateway();
        startGateway();
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
  console.log("[Desktop] preload path:", preloadPath);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0b1118",
    title: APP_NAME,
    show: false,
    // Show after ready-to-show to avoid flash.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      webSecurity: false
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  const isDev = Boolean(devServerUrl);
  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(resolveRendererPath());
  }
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    console.log("[Desktop] ready-to-show");
    if (process.platform === "darwin") {
      try {
        app.dock.show();
      } catch {
      }
    }
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[Desktop] did-fail-load", { code, desc, url });
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[Desktop] render-process-gone", details);
  });
  mainWindow.webContents.on("console-message", (_e, level, msg, line, src) => {
    console.log(`[Desktop][console ${level}] ${msg} (${src}:${line})`);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}
function resolveRendererPath() {
  if (IS_PACKAGED) {
    const asarRenderer = join(app.getAppPath(), "dist/renderer/index.html");
    if (existsSync(asarRenderer)) return asarRenderer;
  }
  const outRenderer = join(__dirname$1, "../renderer/index.html");
  if (existsSync(outRenderer)) return outRenderer;
  const distRenderer = join(REPO_ROOT, "apps/desktop/dist/renderer/index.html");
  if (existsSync(distRenderer)) return distRenderer;
  return outRenderer;
}
async function setupAutoUpdates() {
  if (!IS_PACKAGED || isDevInstance) {
    console.log("[Desktop] auto-update disabled (not packaged)");
    return;
  }
  if (!autoUpdater) {
    try {
      const updater = await import("electron-updater");
      autoUpdater = updater.autoUpdater;
    } catch (error) {
      console.error("[Desktop] auto-update unavailable", error);
      return;
    }
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on("error", (error) => {
    console.error("[Desktop] auto-update error", error);
  });
  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox({
      type: "info",
      buttons: ["Install and Restart", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Ready",
      message: "A new version of MarketBot Desktop is ready to install.",
      detail: "Restart to apply the update."
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.checkForUpdatesAndNotify().catch((e) => {
    console.error("[Desktop] auto-update check failed", e);
  });
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((e) => {
      console.error("[Desktop] auto-update check failed", e);
    });
  }, 30 * 60 * 1e3);
}
app.whenReady().then(async () => {
  app.setName(APP_NAME);
  app.setAppUserModelId("ai.marketbot.desktop");
  app.setActivationPolicy("regular");
  console.log("[Desktop] ready", {
    platform: process.platform,
    packaged: IS_PACKAGED,
    resourcesPath: IS_PACKAGED ? process.resourcesPath : "N/A (dev)",
    gatewayBundle: GATEWAY_BUNDLE_DIR
  });
  if (isRunningFromDiskImage()) {
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["OK"],
      defaultId: 0,
      title: "Install MarketBot Desktop",
      message: "Please move MarketBot Desktop to Applications before opening it.",
      detail: "Do not run the app directly from the DMG volume."
    });
    try {
      await shell.openPath("/Applications");
    } catch {
    }
    app.quit();
    return;
  }
  gatewayToken = ensureConfig();
  const gatewayFilter = { urls: [`http://127.0.0.1:${GATEWAY_PORT}/*`, `http://localhost:${GATEWAY_PORT}/*`] };
  session.defaultSession.webRequest.onBeforeSendHeaders(gatewayFilter, (details, callback) => {
    const headers = { ...details.requestHeaders };
    delete headers["Origin"];
    callback({ cancel: false, requestHeaders: headers });
  });
  session.defaultSession.webRequest.onHeadersReceived(gatewayFilter, (details, callback) => {
    const headers = { ...details.responseHeaders };
    headers["access-control-allow-origin"] = ["*"];
    headers["access-control-allow-methods"] = ["GET, POST, PUT, DELETE, OPTIONS"];
    headers["access-control-allow-headers"] = ["Content-Type, Authorization"];
    callback({ cancel: false, responseHeaders: headers });
  });
  const webviewPreloadPath = resolveWebviewPreloadPath();
  ipcMain.handle("gateway:token", () => gatewayToken);
  ipcMain.handle("gateway:url", () => GATEWAY_URL);
  ipcMain.handle("webview:preload-path", () => `file://${webviewPreloadPath}`);
  ipcMain.handle("gateway:restart", () => {
    stopGateway();
    startGateway();
  });
  ipcMain.handle("shell:open", (_event, url) => {
    if (url?.startsWith("http")) shell.openExternal(url);
  });
  ipcMain.handle("config:read", () => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      if (existsSync(configPath)) {
        return JSON.parse(readFileSync(configPath, "utf8"));
      }
    } catch {
    }
    return {};
  });
  ipcMain.handle("config:write", (_event, patch) => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      let config = {};
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf8"));
        } catch {
        }
      }
      config = applyMergePatch(config, patch);
      mkdirSync(resolve(configPath, ".."), { recursive: true, mode: 448 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
        encoding: "utf-8",
        mode: 384
      });
      console.log("[Desktop] config updated via IPC");
      return { ok: true };
    } catch (err) {
      console.error("[Desktop] config:write failed", err);
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("config:check-onboarding", () => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      const authStorePath = join(STATE_DIR, "agents", "main", "agent", "auth-profiles.json");
      let hasAuthProfiles = false;
      if (existsSync(authStorePath)) {
        try {
          const store = JSON.parse(readFileSync(authStorePath, "utf8"));
          hasAuthProfiles = store?.profiles && Object.keys(store.profiles).length > 0;
        } catch {
        }
      }
      if (hasAuthProfiles) return { needsOnboarding: false };
      const envKeys = [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "DEEPSEEK_API_KEY",
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "OPENROUTER_API_KEY",
        "MISTRAL_API_KEY",
        "XAI_API_KEY"
      ];
      if (envKeys.some((k) => process.env[k])) {
        return { needsOnboarding: false };
      }
      if (!existsSync(configPath)) return { needsOnboarding: true };
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      const hasOnboardingDone = config._desktop?.onboardingComplete === true;
      if (hasOnboardingDone) return { needsOnboarding: false };
      const authProfiles = config.auth?.profiles;
      if (authProfiles && typeof authProfiles === "object" && Object.keys(authProfiles).length > 0) {
        return { needsOnboarding: false };
      }
      return { needsOnboarding: true };
    } catch {
      return { needsOnboarding: true };
    }
  });
  ipcMain.handle("config:mark-onboarding-done", () => {
    try {
      const envConfigPath = process.env.MARKETBOT_CONFIG_PATH?.trim();
      const configPath = envConfigPath ? resolve(REPO_ROOT, envConfigPath) : CONFIG_PATH;
      let config = {};
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf8"));
        } catch {
        }
      }
      config._desktop = { ...config._desktop ?? {}, onboardingComplete: true };
      mkdirSync(resolve(configPath, ".."), { recursive: true, mode: 448 });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
        encoding: "utf-8",
        mode: 384
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("credentials:write", (_event, args) => {
    try {
      const agentDir = join(STATE_DIR, "agents", "main", "agent");
      const authStorePath = join(agentDir, "auth-profiles.json");
      mkdirSync(agentDir, { recursive: true, mode: 448 });
      let store = {
        version: 1,
        profiles: {}
      };
      if (existsSync(authStorePath)) {
        try {
          const raw = JSON.parse(readFileSync(authStorePath, "utf8"));
          if (raw && typeof raw === "object" && raw.profiles) {
            store = raw;
          }
        } catch {
        }
      }
      store.profiles[args.profileId] = {
        type: "api_key",
        provider: args.provider,
        key: args.apiKey
      };
      writeFileSync(authStorePath, JSON.stringify(store, null, 2) + "\n", {
        encoding: "utf-8",
        mode: 384
      });
      console.log("[Desktop] credentials written for", args.profileId);
      return { ok: true };
    } catch (err) {
      console.error("[Desktop] credentials:write failed", err);
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("credentials:configured-providers", () => {
    const providers = /* @__PURE__ */ new Set();
    try {
      const authStorePath = join(STATE_DIR, "agents", "main", "agent", "auth-profiles.json");
      if (existsSync(authStorePath)) {
        try {
          const store = JSON.parse(readFileSync(authStorePath, "utf8"));
          if (store?.profiles && typeof store.profiles === "object") {
            for (const profile of Object.values(store.profiles)) {
              if (profile?.provider) providers.add(profile.provider);
            }
          }
        } catch {
        }
      }
      const envProviders = [
        ["anthropic", "ANTHROPIC_API_KEY"],
        ["openai", "OPENAI_API_KEY"],
        ["openai-codex", "OPENAI_API_KEY"],
        ["deepseek", "DEEPSEEK_API_KEY"],
        ["google", "GEMINI_API_KEY"],
        ["groq", "GROQ_API_KEY"],
        ["openrouter", "OPENROUTER_API_KEY"],
        ["mistral", "MISTRAL_API_KEY"],
        ["xai", "XAI_API_KEY"]
      ];
      for (const [id, envVar] of envProviders) {
        if (process.env[envVar]) providers.add(id);
      }
    } catch {
    }
    return { providers: [...providers] };
  });
  const OLLAMA_API = "http://127.0.0.1:11434";
  ipcMain.handle("ollama:check", async () => {
    try {
      const res = await fetch(`${OLLAMA_API}/api/tags`);
      if (!res.ok) return { available: false, models: [] };
      const data = await res.json();
      const models = (data.models || []).map((m) => m.name);
      return { available: true, models };
    } catch {
      return { available: false, models: [] };
    }
  });
  ipcMain.handle("ollama:pull", async (_event, modelId) => {
    try {
      const res = await fetch(`${OLLAMA_API}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId, stream: true })
      });
      if (!res.ok || !res.body) {
        return { ok: false, error: `Ollama returned ${res.status}` };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const progress = JSON.parse(line);
            const percent = progress.total && progress.completed ? Math.round(progress.completed / progress.total * 100) : void 0;
            mainWindow?.webContents.send("ollama:pull-progress", {
              model: modelId,
              status: progress.status,
              completed: progress.completed,
              total: progress.total,
              percent,
              done: progress.status === "success"
            });
          } catch {
          }
        }
      }
      if (buffer.trim()) {
        try {
          const progress = JSON.parse(buffer);
          mainWindow?.webContents.send("ollama:pull-progress", {
            model: modelId,
            status: progress.status,
            done: progress.status === "success"
          });
        } catch {
        }
      }
      const agentDir = join(STATE_DIR, "agents", "main", "agent");
      const authStorePath = join(agentDir, "auth-profiles.json");
      mkdirSync(agentDir, { recursive: true, mode: 448 });
      let store = {
        version: 1,
        profiles: {}
      };
      if (existsSync(authStorePath)) {
        try {
          const raw = JSON.parse(readFileSync(authStorePath, "utf8"));
          if (raw && typeof raw === "object" && raw.profiles) {
            store = raw;
          }
        } catch {
        }
      }
      if (!store.profiles["ollama:default"]) {
        store.profiles["ollama:default"] = {
          type: "api_key",
          provider: "ollama",
          key: "ollama-local"
        };
        writeFileSync(authStorePath, JSON.stringify(store, null, 2) + "\n", {
          encoding: "utf-8",
          mode: 384
        });
        console.log("[Desktop] ollama credentials auto-created");
      }
      console.log("[Desktop] ollama:pull completed for", modelId);
      return { ok: true };
    } catch (err) {
      const errorMsg = String(err);
      mainWindow?.webContents.send("ollama:pull-progress", {
        model: modelId,
        status: "error",
        done: true,
        error: errorMsg
      });
      console.error("[Desktop] ollama:pull failed", err);
      return { ok: false, error: errorMsg };
    }
  });
  ipcMain.handle("ollama:set-model", async (_event, modelId) => {
    try {
      let config = {};
      if (existsSync(CONFIG_PATH)) {
        try {
          config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
        } catch {
        }
      }
      const agents = config.agents || {};
      const defaults = agents.defaults || {};
      const model = defaults.model || {};
      model.primary = `ollama/${modelId}`;
      defaults.model = model;
      agents.defaults = defaults;
      config.agents = agents;
      mkdirSync(STATE_DIR, { recursive: true, mode: 448 });
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
        encoding: "utf-8",
        mode: 384
      });
      console.log("[Desktop] primary model set to ollama/" + modelId);
      return { ok: true };
    } catch (err) {
      console.error("[Desktop] ollama:set-model failed", err);
      return { ok: false, error: String(err) };
    }
  });
  if (process.platform === "darwin") {
    try {
      app.dock.show();
    } catch {
    }
  }
  ensureTray();
  createWindow();
  void setupAutoUpdates();
  startGateway();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  isQuitting = true;
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
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

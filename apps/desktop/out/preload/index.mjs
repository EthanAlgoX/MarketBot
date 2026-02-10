import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("marketbot", {
  getGatewayToken: () => ipcRenderer.invoke("gateway:token"),
  getGatewayUrl: () => ipcRenderer.invoke("gateway:url"),
  getWebviewPreloadPath: () => ipcRenderer.invoke("webview:preload-path"),
  restartGateway: () => ipcRenderer.invoke("gateway:restart"),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
  onGatewayStatus: (handler) => {
    ipcRenderer.on("gateway:status", (_event, status) => handler(status));
  },
  // Onboarding / config IPC.
  readConfig: () => ipcRenderer.invoke("config:read"),
  writeConfig: (patch) => ipcRenderer.invoke("config:write", patch),
  checkOnboarding: () => ipcRenderer.invoke("config:check-onboarding"),
  markOnboardingDone: () => ipcRenderer.invoke("config:mark-onboarding-done"),
  writeCredentials: (args) => ipcRenderer.invoke("credentials:write", args),
  getConfiguredProviders: () => ipcRenderer.invoke("credentials:configured-providers"),
  // Ollama local model management.
  checkOllama: () => ipcRenderer.invoke("ollama:check"),
  pullOllamaModel: (modelId) => ipcRenderer.invoke("ollama:pull", modelId),
  setOllamaModel: (modelId) => ipcRenderer.invoke("ollama:set-model", modelId),
  onOllamaPullProgress: (handler) => {
    const listener = (_event, progress) => handler(progress);
    ipcRenderer.on("ollama:pull-progress", listener);
    return () => {
      ipcRenderer.removeListener("ollama:pull-progress", listener);
    };
  }
});

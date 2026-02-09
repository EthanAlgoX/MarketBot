const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marketbot', {
  getGatewayToken: () => ipcRenderer.invoke('gateway:token'),
  getGatewayUrl: () => ipcRenderer.invoke('gateway:url'),
  getWebviewPreloadPath: () => ipcRenderer.invoke('webview:preload-path'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  onGatewayStatus: (handler) => {
    ipcRenderer.on('gateway:status', (_event, status) => handler(status));
  },
  // Onboarding / config IPC.
  readConfig: () => ipcRenderer.invoke('config:read'),
  writeConfig: (patch) => ipcRenderer.invoke('config:write', patch),
  checkOnboarding: () => ipcRenderer.invoke('config:check-onboarding'),
  markOnboardingDone: () => ipcRenderer.invoke('config:mark-onboarding-done'),
});

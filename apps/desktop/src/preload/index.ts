import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('marketbot', {
  getGatewayToken: () => ipcRenderer.invoke('gateway:token'),
  getGatewayUrl: () => ipcRenderer.invoke('gateway:url'),
  getWebviewPreloadPath: () => ipcRenderer.invoke('webview:preload-path'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  onGatewayStatus: (handler: (status: { running: boolean }) => void) => {
    ipcRenderer.on('gateway:status', (_event, status) => handler(status));
  },
});

export type MarketBotDesktopApi = {
  getGatewayToken: () => Promise<string>;
  getGatewayUrl: () => Promise<string>;
  getWebviewPreloadPath: () => Promise<string>;
  restartGateway: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
};

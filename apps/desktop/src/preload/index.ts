import { contextBridge, ipcRenderer } from 'electron';

  contextBridge.exposeInMainWorld('marketbot', {
    openControlUi: () => ipcRenderer.invoke('gateway:open'),
    getGatewayToken: () => ipcRenderer.invoke('gateway:token'),
    quickstart: () => ipcRenderer.invoke('gateway:quickstart'),
    openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
    onGatewayStatus: (handler: (status: { running: boolean }) => void) => {
      ipcRenderer.on('gateway:status', (_event, status) => handler(status));
    },
  });

export type MarketbotDesktopApi = typeof window & {
  marketbot: {
    openControlUi: () => Promise<void>;
    startGateway: () => Promise<void>;
    quickstart: () => Promise<void>;
    stopGateway: () => Promise<void>;
    onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
  };
};

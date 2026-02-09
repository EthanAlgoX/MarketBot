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
  // Onboarding / config IPC.
  readConfig: () => ipcRenderer.invoke('config:read'),
  writeConfig: (patch: Record<string, unknown>) => ipcRenderer.invoke('config:write', patch),
  checkOnboarding: () => ipcRenderer.invoke('config:check-onboarding'),
  markOnboardingDone: () => ipcRenderer.invoke('config:mark-onboarding-done'),
  writeCredentials: (args: { profileId: string; provider: string; apiKey: string }) =>
    ipcRenderer.invoke('credentials:write', args),
});

export type MarketBotDesktopApi = {
  getGatewayToken: () => Promise<string>;
  getGatewayUrl: () => Promise<string>;
  getWebviewPreloadPath: () => Promise<string>;
  restartGateway: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
  readConfig: () => Promise<Record<string, unknown>>;
  writeConfig: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  checkOnboarding: () => Promise<{ needsOnboarding: boolean }>;
  markOnboardingDone: () => Promise<{ ok: boolean; error?: string }>;
  writeCredentials: (args: { profileId: string; provider: string; apiKey: string }) =>
    Promise<{ ok: boolean; error?: string }>;
};

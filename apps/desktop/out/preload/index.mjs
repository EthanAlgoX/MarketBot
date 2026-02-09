import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("marketbot", {
  openControlUi: () => ipcRenderer.invoke("gateway:open"),
  getGatewayToken: () => ipcRenderer.invoke("gateway:token"),
  getWebviewPreloadPath: () => ipcRenderer.invoke("webview:preload-path"),
  quickstart: () => ipcRenderer.invoke("gateway:quickstart"),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
  onGatewayStatus: (handler) => {
    ipcRenderer.on("gateway:status", (_event, status) => handler(status));
  }
});

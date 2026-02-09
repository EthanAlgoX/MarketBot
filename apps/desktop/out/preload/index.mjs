import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("marketbot", {
  getGatewayToken: () => ipcRenderer.invoke("gateway:token"),
  getGatewayUrl: () => ipcRenderer.invoke("gateway:url"),
  getWebviewPreloadPath: () => ipcRenderer.invoke("webview:preload-path"),
  restartGateway: () => ipcRenderer.invoke("gateway:restart"),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
  onGatewayStatus: (handler) => {
    ipcRenderer.on("gateway:status", (_event, status) => handler(status));
  }
});

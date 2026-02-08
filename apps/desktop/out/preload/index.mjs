import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("marketbot", {
  openControlUi: () => ipcRenderer.invoke("gateway:open"),
  startGateway: () => ipcRenderer.invoke("gateway:start"),
  quickstart: () => ipcRenderer.invoke("gateway:quickstart"),
  stopGateway: () => ipcRenderer.invoke("gateway:stop"),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
  onGatewayStatus: (handler) => {
    ipcRenderer.on("gateway:status", (_event, status) => handler(status));
  }
});

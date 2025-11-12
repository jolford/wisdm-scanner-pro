const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('scanner', {
  getScanners: () => ipcRenderer.invoke('get-scanners'),
  scanDocument: (options) => ipcRenderer.invoke('scan-document', options),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config)
});

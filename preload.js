// preload.js - Bridge between main and renderer process
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getConfig: () => ipcRenderer.invoke('get-config'),
  logout: () => ipcRenderer.invoke('logout'),
  fetchTasks: () => ipcRenderer.invoke('fetch-tasks'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openExternal: (url) => shell.openExternal(url),
  onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', (event, config) => callback(config))
});
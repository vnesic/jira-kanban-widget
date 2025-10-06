// preload.js - Bridge between main and renderer process
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  fetchTasks: () => ipcRenderer.invoke('fetch-tasks'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openExternal: (url) => shell.openExternal(url)
});
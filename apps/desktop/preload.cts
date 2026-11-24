import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { DesktopBridge, UpdateStatus } from './bridge';

const bridge: DesktopBridge = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: listener => {
    const forward = (_event: IpcRendererEvent, status: UpdateStatus) => listener(status);
    ipcRenderer.on('update:status', forward);
    return () => { ipcRenderer.removeListener('update:status', forward); };
  },
};

contextBridge.exposeInMainWorld('siliconDesktop', bridge);

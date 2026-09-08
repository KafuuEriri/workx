import { contextBridge, ipcRenderer } from 'electron';

type ThemeSource = 'light' | 'dark' | 'system';

const api = {
  platform: process.platform,
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('workx:open-external', url),
  getTheme: (): Promise<ThemeSource> => ipcRenderer.invoke('workx:get-theme'),
  setTheme: (theme: ThemeSource): Promise<ThemeSource> =>
    ipcRenderer.invoke('workx:set-theme', theme),
};

contextBridge.exposeInMainWorld('workx', api);

export type WorkxBridge = typeof api;

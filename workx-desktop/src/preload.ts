import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import type { InitializeResponse } from '@protocol/InitializeResponse';

type ThemeSource = 'light' | 'dark' | 'system';

export interface AppServerNotification {
  method: string;
  params: unknown;
}

export interface AppServerServerRequest {
  id: string | number;
  method: string;
  params: unknown;
}

export type AppServerStatus =
  | { status: 'ready'; info: InitializeResponse }
  | { status: 'stopped'; exit?: unknown }
  | { status: 'error'; message: string };

export interface AppServerApi {
  start: () => Promise<{ ok: boolean; info?: InitializeResponse; message?: string }>;
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  respond: (
    id: string | number,
    result?: unknown,
    error?: { code: number; message: string },
  ) => Promise<void>;
  onNotification: (listener: (notification: AppServerNotification) => void) => () => void;
  onServerRequest: (listener: (request: AppServerServerRequest) => void) => () => void;
  onStatus: (listener: (status: AppServerStatus) => void) => () => void;
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const appServer: AppServerApi = {
  start: () => ipcRenderer.invoke('workx:app-server:start'),
  request: (method, params) =>
    ipcRenderer.invoke('workx:app-server:request', { method, params }),
  respond: (id, result, error) =>
    ipcRenderer.invoke('workx:app-server:respond', { id, result, error }),
  onNotification: (listener) => subscribe('workx:app-server:notification', listener),
  onServerRequest: (listener) => subscribe('workx:app-server:server-request', listener),
  onStatus: (listener) => subscribe('workx:app-server:status', listener),
};

const api = {
  platform: process.platform,
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('workx:open-external', url),
  openPath: (target: string): Promise<string> => ipcRenderer.invoke('workx:open-path', target),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('workx:pick-folder'),
  getTheme: (): Promise<ThemeSource> => ipcRenderer.invoke('workx:get-theme'),
  setTheme: (theme: ThemeSource): Promise<ThemeSource> =>
    ipcRenderer.invoke('workx:set-theme', theme),
  getCwd: (): Promise<string> => ipcRenderer.invoke('workx:get-cwd'),
  appServer,
};

contextBridge.exposeInMainWorld('workx', api);

export type WorkxBridge = typeof api;

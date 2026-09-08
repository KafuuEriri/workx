import { app, ipcMain, webContents } from 'electron';
import os from 'node:os';

import { AppServerClient, AppServerError, type JsonRpcId } from './client';

const CLIENT_INFO = {
  name: 'workx_desktop',
  title: 'Workx Desktop',
  version: '0.1.0',
};

let client: AppServerClient | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) {
      contents.send(channel, payload);
    }
  }
}

export function registerAppServerIpc(): void {
  ipcMain.handle('workx:app-server:start', async () => {
    if (client) {
      return { ok: true };
    }
    const next = new AppServerClient();
    next.on('notification', (notification) =>
      broadcast('workx:app-server:notification', notification),
    );
    next.on('serverRequest', (request) =>
      broadcast('workx:app-server:server-request', request),
    );
    next.on('log', (line) => broadcast('workx:app-server:log', line));
    next.on('exit', (exit) => {
      client = null;
      broadcast('workx:app-server:status', { status: 'stopped', exit });
    });

    try {
      next.start();
      const info = await next.initialize({
        ...CLIENT_INFO,
        version: app.getVersion(),
      });
      client = next;
      broadcast('workx:app-server:status', { status: 'ready', info });
      return { ok: true, info };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      next.stop();
      client = null;
      broadcast('workx:app-server:status', { status: 'error', message });
      return { ok: false, message };
    }
  });

  ipcMain.handle(
    'workx:app-server:request',
    async (_event, payload: { method: string; params?: unknown }) => {
      if (!client) {
        return { ok: false, error: { message: 'app-server is not running' } };
      }
      try {
        return { ok: true, result: await client.request(payload.method, payload.params) };
      } catch (error) {
        const code = error instanceof AppServerError ? error.code : undefined;
        return {
          ok: false,
          error: { message: error instanceof Error ? error.message : String(error), code },
        };
      }
    },
  );

  ipcMain.handle(
    'workx:app-server:respond',
    (
      _event,
      payload: {
        id: JsonRpcId;
        result?: unknown;
        error?: { code: number; message: string };
      },
    ) => {
      if (!client) {
        return;
      }
      if (payload.error) {
        client.respondError(payload.id, payload.error.code, payload.error.message);
      } else {
        client.respond(payload.id, payload.result ?? {});
      }
    },
  );

  ipcMain.handle('workx:get-cwd', () => process.env.WORKX_CWD ?? os.homedir());

  app.on('will-quit', () => {
    client?.stop();
    client = null;
  });
}

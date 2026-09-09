import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { registerAppServerIpc } from './main/appServer/ipc';

app.setName('Workx');
app.setAboutPanelOptions({ applicationName: 'Workx', applicationVersion: app.getVersion() });

if (started) {
  app.quit();
}

type ThemeSource = 'light' | 'dark' | 'system';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Workx',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1b1a' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', () => {
  registerAppServerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('workx:open-external', (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    return shell.openExternal(url);
  }
  return undefined;
});

ipcMain.handle('workx:open-path', (_event, target: string) => {
  if (typeof target === 'string' && target.length > 0) {
    return shell.openPath(target);
  }
  return undefined;
});

ipcMain.handle('workx:pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('workx:get-theme', () => nativeTheme.themeSource);

ipcMain.handle(
  'workx:save-markdown',
  async (_event, content: string, suggestedName: string): Promise<{ path: string } | null> => {
    if (typeof content !== 'string') {
      return null;
    }
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    await writeFile(result.filePath, content, 'utf8');
    return { path: result.filePath };
  },
);

ipcMain.handle(
  'workx:export-pdf',
  async (_event, html: string, suggestedName: string): Promise<{ path: string } | null> => {
    if (typeof html !== 'string') {
      return null;
    }
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    const tempPath = path.join(app.getPath('temp'), `workx-export-${Date.now()}.html`);
    await writeFile(tempPath, html, 'utf8');
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false },
    });
    try {
      await printWindow.loadFile(tempPath);
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await writeFile(result.filePath, pdf);
    } finally {
      printWindow.destroy();
      await rm(tempPath, { force: true });
    }
    return { path: result.filePath };
  },
);

ipcMain.handle('workx:set-theme', (_event, theme: ThemeSource) => {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    nativeTheme.themeSource = theme;
  }
  return nativeTheme.themeSource;
});

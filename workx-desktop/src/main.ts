import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

ipcMain.handle(
  'workx:save-pasted-image',
  async (_event, data: Uint8Array, extension: string): Promise<string | null> => {
    if (!(data instanceof Uint8Array) || data.byteLength === 0) {
      return null;
    }
    const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const directory = path.join(app.getPath('temp'), 'workx-desktop-images');
    await mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `pasted-${Date.now()}-${randomUUID()}.${ext}`);
    await writeFile(filePath, data);
    return filePath;
  },
);

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const DIRECTORY_ENTRY_LIMIT = 500;

ipcMain.handle(
  'workx:list-directory',
  async (_event, target: string): Promise<DirectoryEntry[]> => {
    if (typeof target !== 'string' || target.length === 0) {
      return [];
    }
    try {
      const dirents = await readdir(target, { withFileTypes: true });
      const entries = dirents
        .filter((entry) => entry.name !== '.DS_Store')
        .map((entry) => ({
          name: entry.name,
          path: path.join(target, entry.name),
          isDirectory: entry.isDirectory(),
        }))
        .sort((left, right) => {
          if (left.isDirectory !== right.isDirectory) {
            return left.isDirectory ? -1 : 1;
          }
          return left.name.localeCompare(right.name, undefined, { numeric: true });
        });
      return entries.slice(0, DIRECTORY_ENTRY_LIMIT);
    } catch {
      return [];
    }
  },
);

const SEARCH_SKIP_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'target',
  'dist',
  'build',
  '.venv',
  '__pycache__',
]);

const SEARCH_RESULT_LIMIT = 200;
const SEARCH_DEPTH_LIMIT = 12;

async function searchDirectory(
  root: string,
  query: string,
  results: DirectoryEntry[],
  depth: number,
): Promise<void> {
  if (depth > SEARCH_DEPTH_LIMIT || results.length >= SEARCH_RESULT_LIMIT) {
    return;
  }
  let dirents;
  try {
    dirents = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of dirents) {
    if (results.length >= SEARCH_RESULT_LIMIT) {
      return;
    }
    if (dirent.name === '.DS_Store') {
      continue;
    }
    const entryPath = path.join(root, dirent.name);
    const isDirectory = dirent.isDirectory();
    if (dirent.name.toLowerCase().includes(query)) {
      results.push({ name: dirent.name, path: entryPath, isDirectory });
    }
    if (isDirectory && !SEARCH_SKIP_DIRECTORIES.has(dirent.name)) {
      await searchDirectory(entryPath, query, results, depth + 1);
    }
  }
}

ipcMain.handle(
  'workx:search-directory',
  async (_event, roots: string[], query: string): Promise<DirectoryEntry[]> => {
    if (!Array.isArray(roots) || typeof query !== 'string') {
      return [];
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const results: DirectoryEntry[] = [];
    for (const root of roots) {
      if (typeof root !== 'string' || root.length === 0) {
        continue;
      }
      await searchDirectory(root, needle, results, 0);
    }
    return results;
  },
);

ipcMain.handle('workx:read-image', async (_event, target: string): Promise<string | null> => {
  if (typeof target !== 'string' || target.length === 0) {
    return null;
  }
  const mimeType = IMAGE_MIME_TYPES[path.extname(target).toLowerCase()];
  if (!mimeType) {
    return null;
  }
  try {
    const data = await readFile(target);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
});

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

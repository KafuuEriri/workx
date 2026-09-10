import { afterEach, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: {
    exit: vi.fn(() => { throw new Error('PROCESS_EXIT'); }),
    setName: vi.fn(), setAboutPanelOptions: vi.fn(), getVersion: vi.fn(), on: vi.fn(),
  },
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(), nativeTheme: {}, shell: {}, dialog: {}, webContents: {},
}));
vi.mock('electron', () => electron);
vi.mock('electron-squirrel-startup', () => ({ default: false }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('exits before creating windows or handlers when the desktop is invoked as app-server', async () => {
  vi.stubGlobal('process', { ...process, argv: ['C:\\Workx.exe', 'app-server', '--stdio'] });
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(import('../main')).rejects.toThrow('PROCESS_EXIT');
  expect(electron.app.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(electron.app.on).not.toHaveBeenCalled();
  expect(electron.ipcMain.handle).not.toHaveBeenCalled();
  expect(electron.BrowserWindow).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringContaining('WORKX_BIN'));
});

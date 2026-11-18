import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

/** Opens the one 1280 by 800 window that loads the renderer. */
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), sandbox: true },
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl !== undefined) void window.loadURL(devUrl);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return window;
}

void app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

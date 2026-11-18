import { join } from 'node:path';
import { app, BrowserWindow, utilityProcess } from 'electron';

const SERVICES = ['pty-host', 'workspace-service', 'link-service'];

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

/** Starts one service in a utility process and forwards its output to the main log (card 002). */
function startService(name: string): void {
  const child = utilityProcess.fork(join(import.meta.dirname, `${name}.js`), [], { serviceName: name, stdio: 'pipe' });
  child.stdout?.on('data', (data: Buffer) => process.stdout.write(data));
  child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  child.on('exit', (code) => console.log(`${name} exited ${code}`));
}

void app.whenReady().then(() => {
  createWindow();
  for (const name of SERVICES) startService(name);
});
app.on('window-all-closed', () => app.quit());

import { join } from 'node:path';
import { app, BrowserWindow, MessageChannelMain, utilityProcess } from 'electron';
import type { UtilityProcess } from 'electron';

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
function startService(name: string): UtilityProcess {
  const child = utilityProcess.fork(join(import.meta.dirname, `${name}.js`), [], { serviceName: name, stdio: 'pipe' });
  child.stdout?.on('data', (data: Buffer) => process.stdout.write(data));
  child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  child.on('exit', (code) => console.log(`${name} exited ${code}`));
  return child;
}

/** Gives the renderer and a service the two ends of one message channel (card 005, §2.2). */
function connect(window: BrowserWindow, service: UtilityProcess): void {
  const { port1, port2 } = new MessageChannelMain();
  service.postMessage({ type: 'port' }, [port1]);
  window.webContents.postMessage('hsos-port', null, [port2]);
}

void app.whenReady().then(() => {
  const window = createWindow();
  const ptyHost = startService('pty-host');
  startService('workspace-service');
  startService('link-service');
  window.webContents.once('did-finish-load', () => connect(window, ptyHost));
});
app.on('window-all-closed', () => app.quit());

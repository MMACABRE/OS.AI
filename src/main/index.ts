import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, MessageChannelMain, utilityProcess } from 'electron';
import type { UtilityProcess } from 'electron';
import type { ServiceId } from '@hsos/contracts/ids';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { createBus } from '../modules/shell/bus/create-bus';
import { isEnvelope } from '../modules/shell/bus/port-transport';
import { systemClock } from '../modules/shell/system-clock';
import { buildOwnerIndex, createBroker } from './bus/broker';

type ServiceName = Exclude<ServiceId, 'main'>;
const SERVICES: readonly ServiceName[] = ['pty-host', 'workspace-service', 'link-service'];

const log = {
  log: (level: string, event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level, event, process: 'main', ...data })),
};
const broker = createBroker(buildOwnerIndex());
const bus = createBus({ process: 'main', transport: broker.mainTransport, clock: systemClock, log });
const services = new Map<ServiceName, UtilityProcess>();

/** Opens the one 1280 by 800 window that loads the renderer. */
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      additionalArguments: [
        `--hsos-version=${app.getVersion()}`,
        `--hsos-packaged=${app.isPackaged ? '1' : '0'}`,
      ],
    },
  });
  const search = process.env['HSOS_E2E'] === '1' ? '?e2e=1' : '';
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl !== undefined) void window.loadURL(`${devUrl}${search}`);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), { search });
  return window;
}

/** Starts one service in a utility process and links it to the broker (cards 002, 010). */
function startService(name: ServiceName): UtilityProcess {
  const child = utilityProcess.fork(join(import.meta.dirname, `${name}.js`), [], {
    serviceName: name,
    stdio: 'pipe',
  });
  child.stdout?.on('data', (data: Buffer) => process.stdout.write(data));
  child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  child.on('message', (message: unknown) => {
    if (isEnvelope(message)) broker.receive(message, name);
  });
  child.on('exit', (code) => {
    broker.disconnect(name);
    bus.failPending(name);
    console.log(`${name} exited ${code}`);
  });
  broker.connect(name, { send: (envelope) => child.postMessage(envelope) });
  services.set(name, child);
  return child;
}

/** Gives the renderer and a service the two ends of a fresh message channel (§2.2, SHELL-11). */
function sendServicePort(window: BrowserWindow, name: ServiceName, child: UtilityProcess): void {
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ type: 'port' }, [port1]);
  window.webContents.postMessage('hsos-service-port', name, [port2]);
  bus.emit(shellChannels.servicePort, { service: name });
}

void app.whenReady().then(() => {
  const window = createWindow();
  ipcMain.on('hsos-bus', (event, message: unknown) => {
    if (event.sender === window.webContents && isEnvelope(message)) broker.receive(message, 'ui');
  });
  broker.connect('ui', { send: (envelope) => window.webContents.send('hsos-bus', envelope) });
  for (const name of SERVICES) startService(name);
  window.webContents.on('did-finish-load', () => {
    for (const [name, child] of services) sendServicePort(window, name, child);
  });
});
app.on('window-all-closed', () => app.quit());

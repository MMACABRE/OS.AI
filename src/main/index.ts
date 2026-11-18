import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain } from 'electron';
import type { EpochMs } from '@hsos/contracts/ids';
import type { Unsubscribe } from '@hsos/contracts/bus';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { createBus } from '../modules/shell/bus/create-bus';
import { isEnvelope } from '../modules/shell/bus/port-transport';
import { systemClock } from '../modules/shell/system-clock';
import { buildOwnerIndex, createBroker } from './bus/broker';
import { utilityProcessLauncher } from './supervisor/service-process';
import type { ServiceName, ServiceProcess } from './supervisor/service-process';
import { createSupervisor } from './supervisor/supervisor';

const SERVICES: readonly ServiceName[] = ['pty-host', 'workspace-service', 'link-service'];
const RENDERER_LOSS_WINDOW_MS = 60_000;
const RENDERER_LOSSES_BEFORE_DIALOG = 3;
const UNRESPONSIVE_RELOAD_MS = 10_000;

const log = {
  log: (level: string, event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level, event, process: 'main', ...data })),
};
const broker = createBroker(buildOwnerIndex());
const bus = createBus({ process: 'main', transport: broker.mainTransport, clock: systemClock, log });
let window: BrowserWindow | null = null;
let rendererLoaded = false;

/** Opens the one 1280 by 800 window that loads the renderer. */
function createWindow(): BrowserWindow {
  const created = new BrowserWindow({
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
  if (devUrl !== undefined) void created.loadURL(`${devUrl}${search}`);
  else void created.loadFile(join(import.meta.dirname, '../renderer/index.html'), { search });
  return created;
}

/** Gives the renderer and a service the two ends of a fresh message channel (§2.2, SHELL-11). */
function sendServicePort(target: BrowserWindow, name: ServiceName, child: ServiceProcess): void {
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ type: 'port' }, [port1]);
  target.webContents.postMessage('hsos-service-port', name, [port2]);
  bus.emit(shellChannels.servicePort, { service: name });
}

const running = new Map<ServiceName, ServiceProcess>();
const supervisor = createSupervisor({
  services: SERVICES,
  launch: utilityProcessLauncher,
  clock: systemClock,
  bus,
  log,
  hooks: {
    attach: (name, child) => broker.connect(name, { send: (envelope) => child.postMessage(envelope) }),
    detach: (name) => {
      broker.disconnect(name);
      running.delete(name);
    },
    onMessage: (name, message) => {
      if (isEnvelope(message)) broker.receive(message, name);
    },
    onReady: (name, child) => {
      running.set(name, child);
      if (window !== null && rendererLoaded) sendServicePort(window, name, child);
    },
    // Card 013 turns this into a crash report (DIAG-7).
    reportDeath: (name, exitCode) => log.log('error', 'service_death', { service: name, exitCode }),
  },
});

/** Reloads a lost renderer; a third loss within 60 seconds asks the owner (SHELL-14, SHELL-15). */
function watchRenderer(target: BrowserWindow): void {
  let losses: EpochMs[] = [];
  let crashingOnPurpose = false;
  let cancelUnresponsive: Unsubscribe = () => undefined;
  const contents = target.webContents;

  contents.on('did-start-loading', () => {
    rendererLoaded = false;
  });
  contents.on('did-finish-load', () => {
    rendererLoaded = true;
    for (const [name, child] of running) sendServicePort(target, name, child);
  });
  contents.on('render-process-gone', (_event, details) => {
    rendererLoaded = false;
    log.log('error', 'renderer_gone', { reason: details.reason, exitCode: details.exitCode });
    if (crashingOnPurpose) {
      crashingOnPurpose = false;
      return;
    }
    const now = systemClock.now();
    losses = [...losses.filter((time) => time > now - RENDERER_LOSS_WINDOW_MS), now];
    if (losses.length < RENDERER_LOSSES_BEFORE_DIALOG) return contents.reload();
    void dialog
      .showMessageBox(target, {
        type: 'error',
        title: 'HSOS',
        message: 'The HSOS window stopped three times in a minute.',
        buttons: ['Reload', 'Quit'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 1) return app.quit();
        losses = [];
        contents.reload();
      });
  });
  contents.on('unresponsive', () => {
    cancelUnresponsive();
    cancelUnresponsive = systemClock.after(UNRESPONSIVE_RELOAD_MS, () => {
      log.log('warn', 'renderer_unresponsive_reload');
      crashingOnPurpose = true;
      contents.forcefullyCrashRenderer();
      contents.reload();
    });
  });
  contents.on('responsive', () => cancelUnresponsive());
}

void app.whenReady().then(() => {
  const created = createWindow();
  window = created;
  ipcMain.on('hsos-bus', (event, message: unknown) => {
    if (event.sender === created.webContents && isEnvelope(message)) broker.receive(message, 'ui');
  });
  broker.connect('ui', { send: (envelope) => created.webContents.send('hsos-bus', envelope) });
  watchRenderer(created);
  supervisor.start();
});

// Stop the services before quitting (SHELL-7, architecture §7 step 4).
let stopped = false;
let stopping = false;
app.on('before-quit', (event) => {
  if (stopped) return;
  event.preventDefault();
  if (stopping) return;
  stopping = true;
  void supervisor.stop().then(() => {
    stopped = true;
    app.quit();
  });
});
app.on('window-all-closed', () => app.quit());

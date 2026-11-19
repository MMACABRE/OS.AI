import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { app, clipboard, dialog, ipcMain, MessageChannelMain, Notification, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import type { EpochMs } from '@hsos/contracts/ids';
import type { Unsubscribe } from '@hsos/contracts/bus';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { err, ok } from '@hsos/contracts/result';
import { createBus } from '../modules/shell/bus/create-bus';
import { isEnvelope } from '../modules/shell/bus/port-transport';
import { loadModules } from '../modules/shell/loader/load-modules';
import {
  createContributionStore,
  createServiceContext,
  environmentDataPaths,
} from '../modules/shell/loader/service-context';
import { systemClock } from '../modules/shell/system-clock';
import { buildOwnerIndex, createBroker } from './bus/broker';
import {
  appearanceSection,
  createMainSettings,
  createMainThemes,
  createProcessLogger,
  mainModules,
  processDeathReporters,
  processMetricsSources,
  settingsStorePoint,
  themeStorePoint,
} from './module-list';
import type { ProcessMetric } from './module-list';
import { utilityProcessLauncher } from './supervisor/service-process';
import type { ServiceName, ServiceProcess } from './supervisor/service-process';
import { createSupervisor } from './supervisor/supervisor';
import { registerSystemChannels } from './system/system-channels';
import { createMainWindow, loadRenderer } from './window/main-window';

const SERVICES: readonly ServiceName[] = ['pty-host', 'workspace-service', 'link-service'];
/** `npm run demo` (card 026): `HSOS_DEMO=1` or the `--hsos-demo` flag. */
const DEMO = process.env['HSOS_DEMO'] === '1' || process.argv.includes('--hsos-demo');
const RENDERER_LOSS_WINDOW_MS = 60_000;
const RENDERER_LOSSES_BEFORE_DIALOG = 3;
const UNRESPONSIVE_RELOAD_MS = 10_000;

const paths = environmentDataPaths();
const log = createProcessLogger(paths);
const broker = createBroker(buildOwnerIndex());
const bus = createBus({ process: 'main', transport: broker.mainTransport, clock: systemClock, log });
const store = createContributionStore();
const stopHandlers: (() => Promise<void>)[] = [];
let window: BrowserWindow | null = null;
let rendererLoaded = false;

/** Live processes for `diagnostics.getHealth`, from Electron's metrics (DIAG-9). */
function processMetrics(): ProcessMetric[] {
  const uiPid = window?.webContents.getOSProcessId();
  return app.getAppMetrics().flatMap((metric): ProcessMetric[] => {
    const service = SERVICES.find((name) => name === metric.serviceName);
    const process =
      metric.type === 'Browser'
        ? 'main'
        : metric.type === 'Utility' && service !== undefined
          ? service
          : metric.type === 'Tab' && metric.pid === uiPid
            ? 'ui'
            : null;
    if (process === null) return [];
    return [
      {
        process,
        pid: metric.pid,
        workingSetKb: metric.memory.workingSetSize,
        createdAt: toEpoch(metric.creationTime),
      },
    ];
  });
}

function toEpoch(ms: number): EpochMs {
  return ms as EpochMs;
}

/**
 * main's own modules (SHELL-20) and the extension points main fills or reads (cards 013, 014, 016).
 * Settings load before any module registers (architecture §6 step 2); a bad file falls back to defaults (P-32).
 */
async function loadMainModules(): Promise<MainLook> {
  const settings = createMainSettings(paths, systemClock, log.forModule('settings'));
  await settings.load();
  const themes = createMainThemes(paths, builtInThemesDir(), log.forModule('settings'));
  await themes.load();
  store.contribute(settingsStorePoint, settings);
  store.contribute(themeStorePoint, themes);
  store.contribute(processMetricsSources, processMetrics);
  loadModules(
    mainModules,
    (id) =>
      createServiceContext(id, {
        bus,
        clock: systemClock,
        paths,
        store,
        logFor: (module) => log.forModule(module),
        onStop: (handler) => void stopHandlers.push(handler),
        registerSettings: (section) => settings.register(section),
      }),
    log,
  );
  bus.handle(diagnosticsChannels.openLogFolder, async () => {
    await mkdir(paths.logsDir, { recursive: true });
    const failure = await shell.openPath(paths.logsDir);
    return failure === '' ? ok({}) : err('INTERNAL', 'The log folder could not be opened.', failure);
  });
  const appearance = settings.register(appearanceSection);
  return {
    background: () => themes.active(appearance.get().theme).tokens['color.bg.app'],
    uiScale: () => appearance.get().uiScale,
    onAppearanceChange: (listener) => appearance.onChange(listener),
  };
}

/** What the window needs from settings: the theme background (SET-17) and the zoom factor (SET-15). */
type MainLook = {
  background(): string;
  uiScale(): number;
  onAppearanceChange(listener: () => void): void;
};

/** `resources/themes` next to the app in development, under the resources folder when packaged. */
function builtInThemesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'themes')
    : join(app.getAppPath(), 'resources', 'themes');
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
    reportDeath: (name, exitCode) => {
      for (const report of store.contributions(processDeathReporters))
        report({ process: name, exitCode, appVersion: app.getVersion() });
    },
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

/** Electron's pieces for the system channels (card 015). */
function registerSystem(): void {
  registerSystemChannels({
    bus,
    log,
    shell,
    window: () => window,
    pickFolder: async (title) => {
      const options = { title, properties: ['openDirectory' as const, 'createDirectory' as const] };
      const result =
        window === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(window, options);
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    writeClipboard: (text) => clipboard.writeText(text),
    showNotification: (title, body, onClick) => {
      const notification = new Notification({ title, body });
      notification.on('click', onClick);
      notification.show();
    },
  });
}

// SHELL-1: one instance; a second launch focuses the first window and exits.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => {
  if (window === null) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

// Start order of architecture §6: diagnostics and main's modules, the services, then the window.
void app.whenReady().then(async () => {
  const look = await loadMainModules();
  registerSystem();
  // Demo mode (card 026): no service process; the renderer answers every channel from fixtures.
  if (!DEMO) supervisor.start();
  const created = await createMainWindow({
    appStateFile: paths.appStateFile,
    bus,
    clock: systemClock,
    log,
    background: look.background(),
  });
  window = created;
  // SET-15: uiScale is the renderer's zoom factor; SET-17: the window colour follows the theme.
  const applyLook = () => {
    if (created.isDestroyed()) return;
    created.webContents.setZoomFactor(look.uiScale());
    created.setBackgroundColor(look.background());
  };
  created.webContents.on('did-finish-load', applyLook);
  look.onAppearanceChange(applyLook);
  ipcMain.on('hsos-bus', (event, message: unknown) => {
    if (event.sender === created.webContents && isEnvelope(message)) broker.receive(message, 'ui');
  });
  broker.connect('ui', { send: (envelope) => created.webContents.send('hsos-bus', envelope) });
  watchRenderer(created);
  // In demo mode `uiReady` goes to the demo transport, so the window shows as soon as it can paint.
  if (DEMO) created.once('ready-to-show', () => created.show());
  loadRenderer(created, { demo: DEMO });
});

// Stop the services before quitting (SHELL-7, architecture §7 step 4).
let stopped = false;
let stopping = false;
app.on('before-quit', (event) => {
  if (stopped) return;
  event.preventDefault();
  if (stopping) return;
  stopping = true;
  void supervisor
    .stop()
    .then(() => Promise.allSettled(stopHandlers.map((handler) => handler())))
    .then(() => log.close())
    .then(() => {
      stopped = true;
      app.quit();
    });
});
app.on('window-all-closed', () => app.quit());

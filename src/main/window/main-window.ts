import { join } from 'node:path';
import { app, BrowserWindow, screen } from 'electron';
import type { Bus } from '@hsos/contracts/bus';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { Unsubscribe } from '@hsos/contracts/bus';
import type { Clock, Logger } from '@hsos/contracts/module';
import { readPlacement, restorePlacement, writePlacement } from './bounds';
import type { Rect, WindowPlacement } from './bounds';

/** The window colour before a theme exists (card 015); card 018 passes the theme's background. */
export const DEFAULT_BACKGROUND = '#100F0E';
/** `size.titlebar` (design/layout.md, Title bar). */
export const TITLE_BAR_HEIGHT = 56;
/** SHELL-5: the window shows on `shell.uiReady`, or this long after it was created. */
export const SHOW_FALLBACK_MS = 3_000;
const SAVE_DEBOUNCE_MS = 500;

export type MainWindowOptions = {
  readonly appStateFile: string;
  readonly bus: Bus;
  readonly clock: Clock;
  readonly log: Logger;
  readonly background?: string;
  readonly symbolColor?: string;
};

function toRect(rect: Electron.Rectangle): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Where the window opens: the saved placement on a connected display, or a centred default (SHELL-6). */
async function initialPlacement(appStateFile: string): Promise<WindowPlacement> {
  const displays = screen.getAllDisplays().map((display) => toRect(display.workArea));
  return restorePlacement(
    await readPlacement(appStateFile),
    displays,
    toRect(screen.getPrimaryDisplay().workArea),
  );
}

/**
 * Creates the one frameless window (SHELL-25) with native controls in the title bar overlay, refuses
 * all navigation and new windows (SHELL-24, SEC-2), shows it on `uiReady` or after 3 000 ms (SHELL-5),
 * saves its placement on move, resize (debounced 500 ms) and close (SHELL-6), and emits `windowState`.
 */
export async function createMainWindow(options: MainWindowOptions): Promise<BrowserWindow> {
  const { bus, clock, log } = options;
  const placement = await initialPlacement(options.appStateFile);
  const background = options.background ?? DEFAULT_BACKGROUND;
  const window = new BrowserWindow({
    ...placement.bounds,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: background,
      symbolColor: options.symbolColor ?? '#F2EDE4',
      height: TITLE_BAR_HEIGHT,
    },
    backgroundColor: background,
    // The strawberry logo. A packaged build takes its icon from the exe (electron-builder.yml).
    ...(app.isPackaged ? {} : { icon: join(app.getAppPath(), 'resources', 'icon.ico') }),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        `--hsos-version=${app.getVersion()}`,
        `--hsos-packaged=${app.isPackaged ? '1' : '0'}`,
      ],
    },
  });
  if (placement.isMaximized) window.maximize();

  // SEC-2, SHELL-24: no navigation, no new windows.
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // SHELL-5: show on uiReady or after 3 000 ms, whichever is first.
  let shown = false;
  const show = () => {
    if (shown || window.isDestroyed()) return;
    shown = true;
    window.show();
  };
  const cancelFallback = clock.after(SHOW_FALLBACK_MS, show);
  bus.handle(shellChannels.uiReady, () => {
    cancelFallback();
    show();
    return { ok: true, value: {} };
  });

  // SHELL-6: save placement on move and resize (debounced) and on close.
  let cancelSave: Unsubscribe = () => undefined;
  const save = () => {
    if (window.isDestroyed()) return;
    const next = { bounds: toRect(window.getNormalBounds()), isMaximized: window.isMaximized() };
    void writePlacement(options.appStateFile, next).then((saved) => {
      if (!saved) log.log('warn', 'shell.window_bounds_not_saved');
    });
  };
  const saveSoon = () => {
    cancelSave();
    cancelSave = clock.after(SAVE_DEBOUNCE_MS, save);
  };
  window.on('move', saveSoon);
  window.on('resize', saveSoon);
  window.on('close', () => {
    cancelSave();
    save();
  });

  const emitState = () => {
    if (window.isDestroyed()) return;
    bus.emit(shellChannels.windowState, { isMaximized: window.isMaximized(), isFocused: window.isFocused() });
  };
  window.on('maximize', emitState);
  window.on('unmaximize', emitState);
  window.on('focus', emitState);
  window.on('blur', emitState);
  window.on('restore', emitState);
  window.on('maximize', saveSoon);
  window.on('unmaximize', saveSoon);

  return window;
}

/** Loads the renderer: the dev server in development, the built page otherwise. */
export function loadRenderer(window: BrowserWindow, options: { readonly demo?: boolean; readonly gallery?: boolean } = {}): void {
  const search =
    options.demo === true
      ? options.gallery === true
        ? '?demo=1&gallery=1'
        : '?demo=1'
      : process.env['HSOS_E2E'] === '1'
        ? '?e2e=1'
        : '';
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl !== undefined) void window.loadURL(`${devUrl}${search}`);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), { search });
}

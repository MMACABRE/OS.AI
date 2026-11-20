import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

/** A throwaway %APPDATA% and %LOCALAPPDATA%, so the owner's real settings are never touched. */
export type Profile = {
  /** The temp folder that holds both roots; removed after the test. */
  readonly root: string;
  readonly appData: string;
  readonly localAppData: string;
  /** `%APPDATA%\HSOS`: settings, themes, dashboard, window state. */
  readonly config: string;
  /** `%LOCALAPPDATA%\HSOS`: logs, crash reports, sessions. */
  readonly local: string;
};

export type LaunchOptions = {
  /** `--hsos-demo`: no services, the renderer answers from fixtures. */
  readonly demo?: boolean;
  /** `HSOS_E2E=1`: the renderer pings all three services and shows the answer in the status bar. */
  readonly e2e?: boolean;
  /** Extra environment for this launch. */
  readonly env?: Record<string, string>;
};

/** The status bar line the ping check shows when all three services answer (card 010). */
export const PONG_ALL = 'pong pty-host, pong workspace-service, pong link-service';

export function createProfile(): Profile {
  const root = mkdtempSync(join(tmpdir(), 'hsos-e2e-'));
  const appData = join(root, 'AppData-Roaming');
  const localAppData = join(root, 'AppData-Local');
  mkdirSync(appData, { recursive: true });
  mkdirSync(localAppData, { recursive: true });
  return { root, appData, localAppData, config: join(appData, 'HSOS'), local: join(localAppData, 'HSOS') };
}

export function removeProfile(profile: Profile): void {
  rmSync(profile.root, { recursive: true, force: true });
}

/** The environment of one launch: the parent's, with the profile's roots and the e2e switches. */
export function appEnv(profile: Profile, options: LaunchOptions = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  delete env['HSOS_DEMO'];
  delete env['HSOS_E2E'];
  env['APPDATA'] = profile.appData;
  env['LOCALAPPDATA'] = profile.localAppData;
  if (options.e2e === true) env['HSOS_E2E'] = '1';
  Object.assign(env, options.env ?? {});
  return env;
}

/** Launches the built app (run `npm run build` first) with the profile's roots. */
export async function launch(
  profile: Profile,
  options: LaunchOptions = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const args = ['.', ...(options.demo === true ? ['--hsos-demo'] : [])];
  const app = await electron.launch({ args, env: appEnv(profile, options), timeout: 60_000 });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (app === null) return;
  await app.close().catch(() => undefined);
}

/** Moves the keyboard focus to the body, so app keys are not taken by the terminal (UI-21). */
export async function focusBody(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
  );
}

/** The pid of the running utility process for a service, from Electron's app metrics. */
export async function servicePid(app: ElectronApplication, service: string): Promise<number | null> {
  // Electron names a utility process in `name`; `serviceName` is the Chromium service name.
  return app.evaluate(({ app: electronApp }, name) => {
    const metric = electronApp.getAppMetrics().find((item) => item.type === 'Utility' && item.name === name);
    return metric?.pid ?? null;
  }, service);
}

/**
 * Counts the frames of the background worker (MOT-7, UI-32). Call it before the first page load: it wraps
 * `Worker` so the test can ask the backdrop worker for its stats message, as the app's own client does.
 * Adds `window.__backdropStats()`. Reloads the page so the wrapper is in place when the app starts.
 */
export async function installBackdropProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const workers: { name: string; worker: Worker }[] = [];
    Reflect.set(window, '__hsosWorkers', workers);
    window.Worker = class ProbedWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        workers.push({ name: options?.name ?? '', worker: this });
      }
    };
    Reflect.set(
      window,
      '__backdropStats',
      () =>
        new Promise((resolve, reject) => {
          const entry = workers.find((item) => item.name === 'hsos-backdrop');
          if (entry === undefined) {
            reject(new Error('no backdrop worker'));
            return;
          }
          const timer = setTimeout(() => reject(new Error('no stats reply from the backdrop worker')), 3000);
          const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'stats') return;
            clearTimeout(timer);
            entry.worker.removeEventListener('message', onMessage);
            resolve(event.data);
          };
          entry.worker.addEventListener('message', onMessage);
          entry.worker.postMessage({ type: 'stats' });
        }),
    );
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

export type BackdropStats = { readonly type: 'stats'; readonly frames: number; readonly scene: string };

export async function backdropStats(page: Page): Promise<BackdropStats> {
  return (await page.evaluate(() => Reflect.get(window, '__backdropStats')())) as BackdropStats;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The crash reports in `%LOCALAPPDATA%\HSOS\crash`, by file name (DIAG-7). */
export function crashFiles(profile: Profile): string[] {
  return existsSync(join(profile.local, 'crash')) ? readdirSync(join(profile.local, 'crash')) : [];
}

/** The parsed `%APPDATA%\HSOS\settings\settings.json`, or null when it is missing. */
export function readSettingsFile(
  profile: Profile,
): { version: number; values: Record<string, Record<string, unknown>> } | null {
  const file = join(profile.config, 'settings', 'settings.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as never) : null;
}

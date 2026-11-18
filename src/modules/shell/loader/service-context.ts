import { join } from 'node:path';
import type { Bus } from '@hsos/contracts/bus';
import { toAbsPath } from '@hsos/contracts/ids';
import type { AbsPath, ModuleId } from '@hsos/contracts/ids';
import type {
  Clock,
  ExtensionPoint,
  Logger,
  ServiceContext,
  SettingsReader,
  SettingsSection,
} from '@hsos/contracts/module';
import type { DataPaths } from '@hsos/contracts/paths';

/** Contributions of one process, by extension point id, in registration order. */
export type ContributionStore = {
  contribute<T>(point: ExtensionPoint<T>, contribution: T): void;
  contributions<T>(point: ExtensionPoint<T>): readonly T[];
};

export function createContributionStore(): ContributionStore {
  const byPoint = new Map<string, unknown[]>();
  return {
    contribute(point, contribution) {
      const list = byPoint.get(point.id) ?? [];
      list.push(contribution);
      byPoint.set(point.id, list);
    },
    contributions<T>(point: ExtensionPoint<T>): readonly T[] {
      // The point's type parameter is what every contributor was checked against.
      return (byPoint.get(point.id) ?? []) as T[];
    },
  };
}

/** A reader that always gives the section's defaults. Card 016 replaces it with the settings files. */
export function defaultSettingsReader<T>(section: SettingsSection<T>): SettingsReader<T> {
  return { get: () => section.defaults, onChange: () => () => undefined };
}

/** Every HSOS data location under the two roots (architecture §5). */
export function createDataPaths(configRootInput: string, localRootInput: string): DataPaths {
  const configRoot = toAbsPath(configRootInput);
  const localRoot = toAbsPath(localRootInput);
  const config = (...parts: string[]): AbsPath => toAbsPath(join(configRoot, ...parts));
  const local = (...parts: string[]): AbsPath => toAbsPath(join(localRoot, ...parts));
  return {
    configRoot,
    localRoot,
    settingsFile: config('settings', 'settings.json'),
    keybindingsFile: config('settings', 'keybindings.json'),
    themesDir: config('themes'),
    appStateFile: config('state', 'app.json'),
    skillFavouritesFile: config('skills', 'favourites.json'),
    dashboardFile: config('dashboard.json'),
    logsDir: local('logs'),
    crashDir: local('crash'),
    browserProfileDir: local('browser'),
    linkDir: local('link'),
    sessionsDir: local('sessions'),
    claudeSettingsBackupDir: local('claude-settings-backups'),
    linkUsageFile: local('link-usage.json'),
    terminalInitFile: local('terminal', 'terminal-init.ps1'),
    workspaceFile: (project) => config('workspaces', `${project}.json`),
    historyDir: (project) => local('history', project),
    noteIndexFile: (project) => local('index', `${project}.sqlite`),
    terminalRestoreFile: (project, terminal) => local('terminals', project, `${terminal}.json`),
    hotExitDir: (project) => local('hot-exit', project),
    artifactsFile: (project) => local('activity', `${project}-artifacts.json`),
    reviewCommentsFile: (project) => local('review', `${project}-comments.json`),
  };
}

/** `%APPDATA%\HSOS` and `%LOCALAPPDATA%\HSOS` from the environment; works in main and in utility processes. */
export function environmentDataPaths(env: NodeJS.ProcessEnv = process.env): DataPaths {
  const home = env['USERPROFILE'] ?? '.';
  const appData = env['APPDATA'] ?? join(home, 'AppData', 'Roaming');
  const localAppData = env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local');
  return createDataPaths(join(appData, 'HSOS'), join(localAppData, 'HSOS'));
}

/** What every service context of one process shares. */
export type ServiceContextDeps = {
  readonly bus: Bus;
  readonly clock: Clock;
  readonly paths: DataPaths;
  readonly store: ContributionStore;
  /** The process logger for one module. */
  logFor(moduleId: ModuleId): Logger;
  onStop(handler: () => Promise<void>): void;
  /** Where sections are read: main's settings store (card 016) or the bus in a service (card 017). Defaults otherwise. */
  registerSettings?<T>(section: SettingsSection<T>): SettingsReader<T>;
};

/** The `ServiceContext` one module registers with (architecture §4, card 014). */
export function createServiceContext(moduleId: ModuleId, deps: ServiceContextDeps): ServiceContext {
  return {
    moduleId,
    bus: deps.bus,
    log: deps.logFor(moduleId),
    clock: deps.clock,
    paths: deps.paths,
    registerSettings: (section) => deps.registerSettings?.(section) ?? defaultSettingsReader(section),
    contribute: (point, contribution) => deps.store.contribute(point, contribution),
    contributions: (point) => deps.store.contributions(point),
    onStop: (handler) => deps.onStop(handler),
  };
}

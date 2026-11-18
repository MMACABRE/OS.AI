import type { Clock, Logger, ServiceContext } from '@hsos/contracts/module';
import type { DataPaths } from '@hsos/contracts/paths';
import * as diagnostics from '../modules/diagnostics/register.service';
import { createFileLogger } from '../modules/diagnostics/service/file-logger';
import * as settings from '../modules/settings/register.service';
import { createSettingsStore } from '../modules/settings/service/settings-store';
import type { ModuleEntry } from '../modules/shell/loader/load-modules';
import { systemClock } from '../modules/shell/system-clock';

/** Modules loaded in main, in order (architecture §4, §6 step 2, SHELL-20). */
export const mainModules: readonly ModuleEntry<ServiceContext>[] = [
  { id: 'diagnostics', module: diagnostics },
  { id: 'settings', module: settings },
];

/** main's log file, `logsDir\main.log` (DIAG-1). */
export const createProcessLogger = (paths: DataPaths) =>
  createFileLogger({ process: 'main', logsDir: paths.logsDir, clock: systemClock });

/** The settings store, created and loaded before any module registers (card 016). */
export const createMainSettings = (paths: DataPaths, clock: Clock, log: Logger) =>
  createSettingsStore({ file: paths.settingsFile, clock, log });

/** Extension points main itself reads or fills (cards 013, 014, 016). */
export { processDeathReporters, processMetricsSources } from '../modules/diagnostics/register.service';
export type { ProcessMetric } from '../modules/diagnostics/service/health';
export { settingsStorePoint } from '../modules/settings/register.service';

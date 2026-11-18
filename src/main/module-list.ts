import type { ServiceContext } from '@hsos/contracts/module';
import type { DataPaths } from '@hsos/contracts/paths';
import * as diagnostics from '../modules/diagnostics/register.service';
import { createFileLogger } from '../modules/diagnostics/service/file-logger';
import type { ModuleEntry } from '../modules/shell/loader/load-modules';
import { systemClock } from '../modules/shell/system-clock';

/** Modules loaded in main, in order (architecture §4, SHELL-20). */
export const mainModules: readonly ModuleEntry<ServiceContext>[] = [
  { id: 'diagnostics', module: diagnostics },
];

/** main's log file, `logsDir\main.log` (DIAG-1). */
export const createProcessLogger = (paths: DataPaths) =>
  createFileLogger({ process: 'main', logsDir: paths.logsDir, clock: systemClock });

/** Extension points main itself reads or fills (cards 013 and 014). */
export { processDeathReporters, processMetricsSources } from '../modules/diagnostics/register.service';
export type { ProcessMetric } from '../modules/diagnostics/service/health';

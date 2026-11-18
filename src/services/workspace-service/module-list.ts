import type { DataPaths } from '@hsos/contracts/paths';
import type { ServiceContext } from '@hsos/contracts/module';
import { createFileLogger } from '../../modules/diagnostics/service/file-logger';
import type { ModuleEntry } from '../../modules/shell/loader/load-modules';
import { systemClock } from '../../modules/shell/system-clock';

/** Modules loaded in workspace-service, in order (architecture §4, SHELL-20). Later cards add theirs. */
export const serviceModules: readonly ModuleEntry<ServiceContext>[] = [];

/** This process's log file, `logsDir\workspace-service.log` (DIAG-1). */
export const createProcessLogger = (paths: DataPaths) =>
  createFileLogger({ process: 'workspace-service', logsDir: paths.logsDir, clock: systemClock });

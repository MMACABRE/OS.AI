import type { Bus } from '@hsos/contracts/bus';
import type { Clock, UiContext } from '@hsos/contracts/module';
import { createBusLogger } from '../modules/diagnostics/panel/bus-logger';
import * as diagnostics from '../modules/diagnostics/register.ui';
import * as files from '../modules/files/register.ui';
import * as history from '../modules/history/register.ui';
import * as settings from '../modules/settings/register.ui';
import * as workspace from '../modules/workspace/register.ui';
import type { ModuleEntry } from '../modules/shell/loader/load-modules';

/** Modules loaded in the renderer, in order (architecture §4, SHELL-20). */
export const uiModules: readonly ModuleEntry<UiContext>[] = [
  { id: 'settings', module: settings },
  { id: 'diagnostics', module: diagnostics },
  { id: 'workspace', module: workspace },
  { id: 'files', module: files },
  { id: 'history', module: history },
];

/** The renderer's logger for one module: records go to main with `diagnostics.write` (DIAG-1). */
export const createModuleLogger = (bus: Bus, clock: Clock, module: string) =>
  createBusLogger(bus, clock, module);

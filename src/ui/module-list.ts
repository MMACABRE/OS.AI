import type { Bus } from '@hsos/contracts/bus';
import type { Clock, UiContext } from '@hsos/contracts/module';
import { createBusLogger } from '../modules/diagnostics/panel/bus-logger';
import * as diagnostics from '../modules/diagnostics/register.ui';
import * as activity from '../modules/activity/register.ui';
import * as files from '../modules/files/register.ui';
import * as git from '../modules/git/register.ui';
import * as history from '../modules/history/register.ui';
import * as review from '../modules/review/register.ui';
import * as sessions from '../modules/sessions/register.ui';
import * as settings from '../modules/settings/register.ui';
import * as hud from '../modules/hud/register.ui';
import * as graph from '../modules/graph/register.ui';
import * as browser from '../modules/browser/register.ui';
import * as dashboard from '../modules/dashboard/register.ui';
import * as terminal from '../modules/terminal/register.ui';
import * as workspace from '../modules/workspace/register.ui';
import type { ModuleEntry } from '../modules/shell/loader/load-modules';

/** Modules loaded in the renderer, in order (architecture `4, SHELL-20). */
export const uiModules: readonly ModuleEntry<UiContext>[] = [
  { id: 'settings', module: settings },
  { id: 'diagnostics', module: diagnostics },
  { id: 'workspace', module: workspace },
  { id: 'terminal', module: terminal },
  { id: 'files', module: files },
  { id: 'history', module: history },
  { id: 'hud', module: hud },
  { id: 'sessions', module: sessions },
  { id: 'git', module: git },
  { id: 'review', module: review },
  { id: 'activity', module: activity },
  { id: 'graph', module: graph },
  { id: 'browser', module: browser },
  { id: 'dashboard', module: dashboard },
];

/** The renderer's logger for one module: records go to main with `diagnostics.write` (DIAG-1). */
export const createModuleLogger = (bus: Bus, clock: Clock, module: string) =>
  createBusLogger(bus, clock, module);

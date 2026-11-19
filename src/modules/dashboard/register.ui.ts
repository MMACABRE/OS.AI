import { z } from 'zod';
import { dashboardSection } from '@hsos/contracts/channels/dashboard';
import type { UiContext } from '@hsos/contracts/module';
import { createDashboardPage } from './panel/DashboardPage';
import { loadDashboard, useDashboard } from './panel/dashboard-store';

/** The dashboard's state is its file (DASH-20); the panel keeps none of its own. */
const DashboardScreensState = z.object({});

/**
 * Renderer side of the dashboard (dashboard.md): loads the layout, keeps the grid in step with its settings
 * (DASH-23), draws the `dashboard.screens` panel that the Dashboard page shows, and the commands.
 * Widgets come from the `dashboardWidgets` extension point, contributed by each module's register.
 */
export function register(ctx: UiContext): void {
  const settings = ctx.settings(dashboardSection);
  const grid = () => ({ columns: settings.get().columns, rows: settings.get().rows });
  void loadDashboard(ctx.bus, ctx.log, grid());
  settings.onChange((value) => useDashboard.getState().setGrid({ columns: value.columns, rows: value.rows }));

  ctx.registerPanel({
    type: 'dashboard.screens',
    kind: 'dock',
    title: 'Dashboard',
    icon: 'hud',
    stateSchema: DashboardScreensState,
    initialState: {},
    component: createDashboardPage({ log: ctx.log, openSettings: () => ctx.openPanel('settings.screen') }),
    allowMultiple: false,
  });

  ctx.registerCommand({
    id: 'dashboard.edit',
    title: 'Edit Dashboard',
    defaultKey: null,
    global: false,
    run: () => useDashboard.getState().setEditing(true),
  });
  ctx.registerCommand({
    id: 'dashboard.addWidget',
    title: 'Add Widget',
    defaultKey: null,
    global: false,
    run: () => useDashboard.getState().setEditing(true),
  });
  ctx.registerCommand({
    id: 'dashboard.nextScreen',
    title: 'Next Screen',
    defaultKey: 'Ctrl+PageDown',
    global: false,
    run: () => useDashboard.getState().setScreen(useDashboard.getState().screen + 1),
  });
  ctx.registerCommand({
    id: 'dashboard.previousScreen',
    title: 'Previous Screen',
    defaultKey: 'Ctrl+PageUp',
    global: false,
    run: () => useDashboard.getState().setScreen(useDashboard.getState().screen - 1),
  });
}

/** The dashboard's layout as the page reads it, and saved to the file 500 ms after each change (DASH-20, DASH-21). */
import { create } from 'zustand';
import type { Bus } from '@hsos/contracts/bus';
import { dashboardChannels, dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import type { DashboardFile, WidgetInstance, WidgetType } from '@hsos/contracts/channels/dashboard';
import type { Logger } from '@hsos/contracts/module';
import { uiContributions } from '@hsos/ui-kit';
import { DEFAULT_LAYOUT, MAX_SCREENS, canPlace, reflow, validateFile } from './placement';
import type { Cell, Grid, Size } from './placement';

/** Save delay after the last change (DASH-21). */
export const SAVE_DELAY_MS = 500;

export type Removed = { readonly widget: WidgetInstance; readonly index: number };

type DashboardState = {
  readonly loaded: boolean;
  readonly error: string | null;
  readonly screens: number;
  readonly widgets: readonly WidgetInstance[];
  readonly grid: Grid;
  readonly screen: number;
  readonly editing: boolean;
  readonly removed: Removed | null;
  setScreen(screen: number): void;
  setEditing(editing: boolean): void;
  /** Changes a widget's cell; false when the cell is not free (DASH-6). */
  moveOrResize(id: string, cell: Cell): boolean;
  add(widget: WidgetInstance): void;
  remove(id: string): void;
  undoRemove(): void;
  addScreen(): boolean;
  removeScreen(screen: number): void;
  setGrid(grid: Grid): void;
};

/** The contributed size of a widget type, or a 1 by 1 for an unknown type (its size is kept as stored). */
export function sizeOfType(type: string): Size {
  const found = uiContributions(dashboardWidgets).find((entry: WidgetType) => entry.id === type);
  return found?.defaultSize ?? { w: 1, h: 1 };
}

let bus: Bus | null = null;
let log: Logger | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const cellsOn = (widgets: readonly WidgetInstance[], screen: number, except: string | null): Cell[] =>
  widgets.filter((widget) => widget.screen === screen && widget.id !== except);

function scheduleSave(file: DashboardFile): void {
  if (bus === null) return;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const handle = bus;
    if (handle === null) return;
    void handle.call(dashboardChannels.save, { file }).then((result) => {
      if (!result.ok) log?.log('error', 'dashboard.save_failed', { message: result.error.message });
    });
  }, SAVE_DELAY_MS);
}

export const useDashboard = create<DashboardState>((set, get) => {
  const commit = (patch: Partial<DashboardState>) => {
    set(patch);
    const state = get();
    if (state.loaded) scheduleSave({ version: 1, screens: state.screens, widgets: [...state.widgets] });
  };
  return {
    loaded: false,
    error: null,
    screens: DEFAULT_LAYOUT.screens,
    widgets: [],
    grid: { columns: 8, rows: 6 },
    screen: 0,
    editing: false,
    removed: null,
    setScreen: (screen) => set({ screen: Math.min(Math.max(0, screen), get().screens - 1) }),
    setEditing: (editing) => set({ editing }),
    moveOrResize: (id, cell) => {
      const state = get();
      const current = state.widgets.find((widget) => widget.id === id);
      if (current === undefined || !canPlace(cell, cellsOn(state.widgets, current.screen, id), state.grid))
        return false;
      commit({
        widgets: state.widgets.map((widget) => (widget.id === id ? { ...widget, ...cell } : widget)),
      });
      return true;
    },
    add: (widget) => commit({ widgets: [...get().widgets, widget] }),
    remove: (id) => {
      const state = get();
      const index = state.widgets.findIndex((widget) => widget.id === id);
      const widget = state.widgets[index];
      if (widget === undefined) return;
      commit({ widgets: state.widgets.filter((entry) => entry.id !== id), removed: { widget, index } });
    },
    undoRemove: () => {
      const state = get();
      if (state.removed === null) return;
      const widgets = [...state.widgets];
      widgets.splice(Math.min(state.removed.index, widgets.length), 0, state.removed.widget);
      commit({ widgets, removed: null });
    },
    addScreen: () => {
      const state = get();
      if (state.screens >= MAX_SCREENS) return false;
      commit({ screens: state.screens + 1 });
      return true;
    },
    removeScreen: (screen) => {
      const state = get();
      const widgets = state.widgets
        .filter((widget) => widget.screen !== screen)
        .map((widget) => (widget.screen > screen ? { ...widget, screen: widget.screen - 1 } : widget));
      const screens = Math.max(1, state.screens - 1);
      commit({ widgets, screens, screen: Math.min(state.screen, screens - 1) });
    },
    setGrid: (grid) => {
      const state = get();
      const next = reflow(state.widgets, state.screens, grid, sizeOfType);
      commit({ grid, widgets: next.widgets, screens: next.screens });
    },
  };
});

/** Loads the saved layout, or the default one (DASH-21), and makes saves go to the bus. */
export async function loadDashboard(handle: Bus, logger: Logger, grid: Grid): Promise<void> {
  bus = handle;
  log = logger;
  const result = await handle.call(dashboardChannels.load, {});
  if (!result.ok) {
    useDashboard.setState({ loaded: true, error: result.error.message, grid });
    return;
  }
  const source = result.value ?? DEFAULT_LAYOUT;
  const checked = validateFile(source, grid);
  if (checked.dropped.length > 0) logger.log('warn', 'dashboard.dropped', { count: checked.dropped.length });
  const fitted = reflow(checked.file.widgets, checked.file.screens, grid, sizeOfType);
  useDashboard.setState({
    loaded: true,
    error: null,
    grid,
    screens: fitted.screens,
    widgets: fitted.widgets,
  });
  // The corrected layout is saved at once, so a dropped instance does not come back (DASH-21).
  if (checked.dropped.length > 0)
    scheduleSave({ version: 1, screens: fitted.screens, widgets: fitted.widgets });
}

/** The default layout as a fresh start (the page's "Reset to default"). */
export function resetDashboard(grid: Grid): void {
  const fitted = reflow(DEFAULT_LAYOUT.widgets, DEFAULT_LAYOUT.screens, grid, sizeOfType);
  useDashboard.setState({ error: null, screens: fitted.screens, widgets: fitted.widgets, grid, screen: 0 });
  scheduleSave({ version: 1, screens: fitted.screens, widgets: fitted.widgets });
}

/** A fresh twelve-character id for a new widget. */
export function newWidgetId(): string {
  return Math.random().toString(36).slice(2, 14).padEnd(12, '0');
}

/** Pure placement rules of the dashboard (dashboard.md DASH-1 to DASH-4, DASH-21 to DASH-23). */
import type { DashboardFile, WidgetInstance } from '@hsos/contracts/channels/dashboard';

/** The screens a dashboard may hold (DASH-1). */
export const MAX_SCREENS = 8;
/** Widgets a dashboard file may hold (contract limit). */
export const MAX_WIDGETS = 200;

export type Cell = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type Size = { readonly w: number; readonly h: number };
export type Grid = { readonly columns: number; readonly rows: number };

/** Each widget type's sizes in cells (catalog of dashboard.md). */
export type TypeSizes = { readonly min: Size; readonly max: Size; readonly defaultSize: Size };

/** Whether the cell lies inside the grid (DASH-3). */
export function insideGrid(cell: Cell, grid: Grid): boolean {
  return (
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.w >= 1 &&
    cell.h >= 1 &&
    cell.x + cell.w <= grid.columns &&
    cell.y + cell.h <= grid.rows
  );
}

/** Two cells share at least one grid cell. */
export function overlaps(a: Cell, b: Cell): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** A cell can take a place: it is inside the grid and touches no other cell of the screen (DASH-3). */
export function canPlace(cell: Cell, others: readonly Cell[], grid: Grid): boolean {
  return insideGrid(cell, grid) && others.every((other) => !overlaps(cell, other));
}

/** The first place of the given size, scanning rows top to bottom, left to right (DASH-8), or null. */
export function firstFit(size: Size, others: readonly Cell[], grid: Grid): Cell | null {
  for (let y = 0; y < grid.rows; y += 1)
    for (let x = 0; x < grid.columns; x += 1) {
      const cell = { x, y, w: size.w, h: size.h };
      if (canPlace(cell, others, grid)) return cell;
    }
  return null;
}

/** The size a resize may reach: within the type's range, and up to the next widget or the grid edge (DASH-7). */
export function resizeTarget(
  cell: Cell,
  want: Size,
  sizes: TypeSizes,
  others: readonly Cell[],
  grid: Grid,
): Size {
  const w = Math.min(Math.max(want.w, sizes.min.w), sizes.max.w);
  const h = Math.min(Math.max(want.h, sizes.min.h), sizes.max.h);
  // Shrink along each axis until it fits; the first valid step is the largest one toward the want.
  for (let height = h; height >= sizes.min.h; height -= 1)
    for (let width = w; width >= sizes.min.w; width -= 1)
      if (canPlace({ x: cell.x, y: cell.y, w: width, h: height }, others, grid))
        return { w: width, h: height };
  return { w: cell.w, h: cell.h };
}

/**
 * Validates a loaded file (DASH-21): an instance with a bad geometry or one that overlaps an earlier instance
 * is dropped and reported; an instance of an unknown type is kept (the caller does not draw it).
 */
export function validateFile(
  file: DashboardFile,
  grid: Grid,
): { readonly file: DashboardFile; readonly dropped: readonly string[] } {
  const kept: WidgetInstance[] = [];
  const dropped: string[] = [];
  for (const widget of file.widgets) {
    const cell = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const sameScreen = kept.filter((entry) => entry.screen === widget.screen);
    if (widget.screen >= file.screens || !insideGrid(cell, grid) || !canPlace(cell, sameScreen, grid))
      dropped.push(widget.id);
    else kept.push(widget);
  }
  return { file: { ...file, widgets: kept }, dropped };
}

/**
 * Brings widgets into a changed grid (DASH-23): each widget that no longer fits keeps its place if it can, else moves
 * to the first free place of its screen, else of a new screen. Nothing is dropped; the count is unchanged.
 */
export function reflow(
  widgets: readonly WidgetInstance[],
  screens: number,
  grid: Grid,
  sizeOf: (type: string) => Size,
): { readonly widgets: WidgetInstance[]; readonly screens: number } {
  const placed: WidgetInstance[] = [];
  let screenCount = screens;
  for (const widget of widgets) {
    const cell = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const sameScreen = placed.filter((entry) => entry.screen === widget.screen);
    if (canPlace(cell, sameScreen, grid)) {
      placed.push(widget);
      continue;
    }
    const size = { w: Math.min(widget.w, grid.columns), h: Math.min(widget.h, grid.rows) };
    const fitted = firstFit(size, sameScreen, grid) ?? firstFit(sizeOf(widget.type), sameScreen, grid);
    if (fitted !== null) {
      placed.push({ ...widget, x: fitted.x, y: fitted.y, w: fitted.w, h: fitted.h });
      continue;
    }
    // A new screen when the current one is full; the widget takes the first screen that has room.
    let target = widget.screen;
    let spot = firstFit(
      size,
      placed.filter((entry) => entry.screen === target),
      grid,
    );
    while (spot === null && target + 1 < MAX_SCREENS) {
      target += 1;
      screenCount = Math.max(screenCount, target + 1);
      spot = firstFit(
        size,
        placed.filter((entry) => entry.screen === target),
        grid,
      );
    }
    if (spot !== null) placed.push({ ...widget, screen: target, x: spot.x, y: spot.y, w: spot.w, h: spot.h });
  }
  return { widgets: placed, screens: screenCount };
}

/** The default layout of an 8 by 6 grid (DASH-22). Ids are twelve characters, as the contract requires. */
export const DEFAULT_LAYOUT: DashboardFile = {
  version: 1,
  screens: 2,
  widgets: [
    { id: 'dash00000001', type: 'hud.ribbon', screen: 0, x: 0, y: 0, w: 4, h: 2, config: null },
    { id: 'dash00000002', type: 'hud.usage', screen: 0, x: 4, y: 0, w: 2, h: 2, config: null },
    { id: 'dash00000003', type: 'hud.mascot', screen: 0, x: 6, y: 0, w: 2, h: 2, config: null },
    { id: 'dash00000004', type: 'hud.sessions', screen: 0, x: 0, y: 2, w: 4, h: 3, config: null },
    { id: 'dash00000005', type: 'hud.context', screen: 0, x: 4, y: 2, w: 2, h: 3, config: null },
    { id: 'dash00000006', type: 'graph.mini', screen: 0, x: 6, y: 2, w: 2, h: 3, config: null },
    { id: 'dash00000007', type: 'hud.quickBar', screen: 0, x: 0, y: 5, w: 8, h: 1, config: null },
    { id: 'dash00000008', type: 'hud.skills', screen: 1, x: 0, y: 0, w: 4, h: 4, config: null },
    { id: 'dash00000009', type: 'sessions.recent', screen: 1, x: 4, y: 0, w: 4, h: 4, config: null },
    { id: 'dash00000010', type: 'git.status', screen: 1, x: 0, y: 4, w: 4, h: 2, config: null },
    { id: 'dash00000011', type: 'activity.recent', screen: 1, x: 4, y: 4, w: 4, h: 2, config: null },
  ],
};

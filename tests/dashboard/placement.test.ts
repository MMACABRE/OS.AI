import { describe, expect, it } from 'vitest';
import type { DashboardFile, WidgetInstance } from '@hsos/contracts/channels/dashboard';
import {
  canPlace,
  DEFAULT_LAYOUT,
  firstFit,
  insideGrid,
  overlaps,
  reflow,
  resizeTarget,
  validateFile,
} from '../../src/modules/dashboard/panel/placement';

const GRID = { columns: 8, rows: 6 };

function widget(id: string, input: Partial<WidgetInstance>): WidgetInstance {
  return {
    id,
    type: 'hud.usage',
    screen: 0,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    config: null,
    ...input,
  } as WidgetInstance;
}

describe('dashboard placement (card 035)', () => {
  it('DASH-3 two instances sharing a cell are both refused, and one past the right edge is refused', () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    const b = { x: 1, y: 1, w: 2, h: 2 };
    expect(overlaps(a, b)).toBe(true);
    expect(canPlace(b, [a], GRID)).toBe(false);
    expect(canPlace(a, [b], GRID)).toBe(false);
    expect(insideGrid({ x: 7, y: 0, w: 2, h: 1 }, GRID)).toBe(false);
  });

  it('DASH-21 validateFile drops the overlapping instance and keeps the one of an unknown type', () => {
    const file: DashboardFile = {
      version: 1,
      screens: 1,
      widgets: [
        widget('aaaaaaaaaaa1', { type: 'hud.usage', x: 0, y: 0, w: 2, h: 2 }),
        widget('aaaaaaaaaaa2', { type: 'hud.usage', x: 1, y: 1, w: 2, h: 2 }),
        widget('aaaaaaaaaaa3', { type: 'not.a.type', x: 4, y: 0, w: 1, h: 1 }),
      ],
    } as DashboardFile;
    const result = validateFile(file, GRID);
    expect(result.dropped).toEqual(['aaaaaaaaaaa2']);
    expect(result.file.widgets.map((item) => item.id)).toEqual(['aaaaaaaaaaa1', 'aaaaaaaaaaa3']);
  });

  it('DASH-22 the default layout fits an 8 by 6 grid with no overlap and nothing outside', () => {
    const result = validateFile(DEFAULT_LAYOUT, GRID);
    expect(result.dropped).toEqual([]);
    const byScreen = new Map<number, WidgetInstance[]>();
    for (const item of DEFAULT_LAYOUT.widgets) {
      expect(insideGrid(item, GRID)).toBe(true);
      byScreen.set(item.screen, [...(byScreen.get(item.screen) ?? []), item]);
    }
    for (const group of byScreen.values())
      group.forEach((item, index) => {
        expect(group.slice(index + 1).some((other) => overlaps(item, other))).toBe(false);
      });
  });

  it('DASH-23 the default layout reflowed to 6 columns keeps every widget, with none overlapping or outside', () => {
    const grid = { columns: 6, rows: 6 };
    const result = reflow(DEFAULT_LAYOUT.widgets, DEFAULT_LAYOUT.screens, grid, () => ({ w: 2, h: 2 }));
    expect(result.widgets).toHaveLength(DEFAULT_LAYOUT.widgets.length);
    for (const item of result.widgets) expect(insideGrid(item, grid)).toBe(true);
    result.widgets.forEach((item, index) => {
      const others = result.widgets.slice(index + 1).filter((other) => other.screen === item.screen);
      expect(others.some((other) => overlaps(item, other))).toBe(false);
    });
  });

  it('DASH-7 a resize to 6 wide stops at 3 when a widget sits at column 3', () => {
    const size = resizeTarget(
      { x: 0, y: 0, w: 2, h: 2 },
      { w: 6, h: 2 },
      { min: { w: 1, h: 1 }, max: { w: 4, h: 3 }, defaultSize: { w: 2, h: 2 } },
      [{ x: 3, y: 0, w: 1, h: 1 }],
      GRID,
    );
    expect(size.w).toBe(3);
  });

  it('DASH-8 on a full screen no free place of the default size is found', () => {
    const full: { x: number; y: number; w: number; h: number }[] = [];
    for (let y = 0; y < GRID.rows; y += 1)
      for (let x = 0; x < GRID.columns; x += 1) full.push({ x, y, w: 1, h: 1 });
    expect(firstFit({ w: 2, h: 2 }, full, GRID)).toBeNull();
  });
});

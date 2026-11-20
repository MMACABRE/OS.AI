import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { dashboardChannels, dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import type { WidgetInstance, WidgetType } from '@hsos/contracts/channels/dashboard';
import type { Logger } from '@hsos/contracts/module';
import { ok } from '@hsos/contracts/result';
import { contributeUi, ToastProvider } from '@hsos/ui-kit';
import { createDashboardPage } from '../../src/modules/dashboard/panel/DashboardPage';
import { useDashboard } from '../../src/modules/dashboard/panel/dashboard-store';
import { register } from '../../src/modules/dashboard/register.ui';
import { hudWidgetTypes } from '../../src/modules/hud/panel/widgets/hud-widgets';
import { createFakeUiContext } from '../fakes/fake-ui-context';
import { makeDeps, ms, seedHud } from '../fakes/hud-fixtures';
import { createStubBus } from '../fakes/stub-bus';

beforeAll(() => {
  // jsdom has neither matchMedia nor ResizeObserver; the page and its widgets use both (as the gallery test does).
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

/** Contributions made by a test; removed after it so later tests see only their own types. */
const undos: (() => void)[] = [];
const keep = (undo: () => void) => {
  undos.push(undo);
};

afterEach(() => {
  cleanup();
  for (const undo of undos.splice(0)) undo();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-motion');
});

beforeEach(() => {
  useDashboard.setState({
    loaded: true,
    error: null,
    screens: 1,
    screen: 0,
    editing: false,
    grid: { columns: 8, rows: 6 },
    widgets: [],
    removed: null,
  });
});

/** Returns the value, or throws a readable error when a test expected it to exist. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error('Expected ' + what);
  return value;
}

/** A widget id of twelve characters, as the contract requires. */
const idOf = (name: string) => name.padEnd(12, '_');

function cell(
  name: string,
  type: string,
  x: number,
  y: number,
  w = 2,
  h = 2,
  screenIndex = 0,
): WidgetInstance {
  return { id: idOf(name), type, screen: screenIndex, x, y, w, h, config: null };
}

type TypeOptions = {
  readonly frame?: 'box' | 'free';
  readonly size?: { readonly w: number; readonly h: number };
  readonly title?: string;
  readonly component?: WidgetType['component'];
};

/** Contributes a widget type to `dashboardWidgets` for the test (removed afterwards). */
function contributeType(id: string, options: TypeOptions = {}): void {
  const title = options.title ?? id;
  const type: WidgetType = {
    id,
    title,
    moduleId: 'test',
    minSize: { w: 1, h: 1 },
    maxSize: { w: 4, h: 4 },
    defaultSize: options.size ?? { w: 2, h: 2 },
    frame: options.frame ?? 'box',
    configSchema: z.unknown(),
    defaultConfig: null,
    component: options.component ?? (() => createElement('p', null, title + ' body')),
  };
  keep(contributeUi(dashboardWidgets, type));
}

function setDashboard(patch: {
  readonly widgets?: readonly WidgetInstance[];
  readonly screens?: number;
  readonly screen?: number;
  readonly editing?: boolean;
}): void {
  useDashboard.setState({ loaded: true, error: null, ...patch });
}

function renderPage(log: Logger = { log: vi.fn() }) {
  const Page = createDashboardPage({ log, openSettings: () => undefined });
  return render(createElement(ToastProvider, null, createElement(Page)));
}

function widgetEl(name: string): HTMLElement {
  return must(document.querySelector<HTMLElement>('[data-widget="' + idOf(name) + '"]'), 'widget ' + name);
}

/** The grid of screen n (1 based): the first child of the screen box. */
function gridOf(screenNumber: number): HTMLElement {
  const screenEl = must(
    document.querySelector<HTMLElement>('[aria-label="Screen ' + screenNumber + '"]'),
    'screen ' + screenNumber,
  );
  return must(screenEl.firstElementChild as HTMLElement | null, 'grid of screen ' + screenNumber);
}

/** Each dot's pressed state, in screen order. */
function dotStates(): boolean[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="group"][aria-label="Screens"] button'),
  ).map((dot) => dot.getAttribute('aria-pressed') === 'true');
}

function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
}

/** Makes every element report the same box, so one pixel of pointer travel is a known number of cells. */
function stubLayout(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

/** Holds the pointer still on an element for `ms` milliseconds, with fake timers, then lets go. */
function holdFor(target: HTMLElement, millis: number): void {
  fireEvent(target, pointer('pointerdown', 10, 10));
  act(() => {
    vi.advanceTimersByTime(millis);
  });
  fireEvent(target, pointer('pointerup', 10, 10));
}

function editing(): boolean {
  return screen.queryByRole('toolbar', { name: 'Edit dashboard' }) !== null;
}

function geometryOf(names: readonly string[]) {
  return names.map((name) => {
    const el = widgetEl(name);
    return { name, column: el.style.gridColumn, row: el.style.gridRow };
  });
}

describe('dashboard (card 035 UI rows)', () => {
  it('DASH-1 three screens: the first shows; Ctrl+PageDown twice shows the third with its dot filled; one more press does nothing', async () => {
    const bus = createStubBus();
    bus.answer(dashboardChannels.load, () => ok({ version: 1, screens: 3, widgets: [] }));
    const ctx = createFakeUiContext('dashboard', bus);
    useDashboard.setState({ loaded: false });
    register(ctx);
    await waitFor(() => expect(useDashboard.getState().screens).toBe(3));
    const next = ctx.command('dashboard.nextScreen');
    expect(next.defaultKey).toBe('Ctrl+PageDown');
    const Panel = ctx.panel('dashboard.screens').component as unknown as ComponentType;
    render(createElement(ToastProvider, null, createElement(Panel)));
    const track = must(
      document.querySelector<HTMLElement>('[aria-label="Screen 1"]')?.parentElement,
      'track',
    );
    expect(dotStates()).toEqual([true, false, false]);
    act(() => {
      next.run();
    });
    act(() => {
      next.run();
    });
    expect(dotStates()).toEqual([false, false, true]);
    expect(track.style.transform).toContain('translateX(-66.6');
    act(() => {
      next.run();
    });
    expect(dotStates()).toEqual([false, false, true]);
    expect(track.style.transform).toContain('translateX(-66.6');
    expect(useDashboard.getState().screen).toBe(2);
  });

  it('DASH-2 an 8 by 6 grid keeps every widget at its x, y, w, h when the window goes from 1600 by 900 to 1200 by 700', () => {
    contributeType('test.plain');
    setDashboard({ widgets: [cell('a', 'test.plain', 0, 0), cell('b', 'test.plain', 6, 4)] });
    const setWindow = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
      window.dispatchEvent(new Event('resize'));
    };
    setWindow(1600, 900);
    renderPage();
    const before = geometryOf(['a', 'b']);
    expect(before[0]?.column).toBe('1 / span 2');
    expect(before[1]?.row).toBe('5 / span 2');
    expect(gridOf(1).style.gridTemplateColumns).toContain('repeat(8,');
    setWindow(1200, 700);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(geometryOf(['a', 'b'])).toEqual(before);
    expect(useDashboard.getState().widgets.map((widget) => [widget.x, widget.y, widget.w, widget.h])).toEqual(
      [
        [0, 0, 2, 2],
        [6, 4, 2, 2],
      ],
    );
  });

  it('DASH-4 a widget whose component throws shows its error state in its frame, beside a healthy one that renders', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    contributeType('test.broken', {
      title: 'Broken thing',
      component: () => {
        throw new Error('boom');
      },
    });
    contributeType('test.healthy', { title: 'Healthy thing' });
    setDashboard({ widgets: [cell('broken', 'test.broken', 0, 0), cell('healthy', 'test.healthy', 2, 0)] });
    const log = { log: vi.fn() };
    renderPage(log);
    const broken = widgetEl('broken');
    expect(within(broken).getByText('Broken thing stopped working.')).toBeTruthy();
    expect(within(widgetEl('healthy')).getByText('Healthy thing body')).toBeTruthy();
    expect(log.log).toHaveBeenCalledWith(
      'error',
      'dashboard.widget_failed',
      expect.objectContaining({ widget: 'Broken thing' }),
    );
  });

  it('DASH-4 a free widget has no widget surface or frame; a box widget has both', () => {
    contributeType('test.free', { frame: 'free', title: 'Free thing' });
    contributeType('test.box', { frame: 'box', title: 'Box thing' });
    setDashboard({ widgets: [cell('free', 'test.free', 0, 0), cell('box', 'test.box', 3, 0)] });
    renderPage();
    const surfaces = document.querySelectorAll('[data-surface="widget"]');
    expect(surfaces).toHaveLength(1);
    expect(widgetEl('box').contains(surfaces[0] ?? null)).toBe(true);
    expect(widgetEl('free').querySelector('[data-surface]')).toBeNull();
    expect(widgetEl('free').querySelector('header')).toBeNull();
    expect(widgetEl('box').querySelector('header')?.textContent).toBe('Box thing');
  });

  it('DASH-5 a pointer held still on an empty cell starts edit mode at 500 ms, not at 499 ms (fake timers)', () => {
    vi.useFakeTimers();
    setDashboard({ widgets: [] });
    renderPage();
    const empty = gridOf(1);
    holdFor(empty, 499);
    expect(editing()).toBe(false);
    holdFor(empty, 500);
    expect(editing()).toBe(true);
  });

  it('DASH-5 with data-motion reduced, edit mode starts and no widget sways', () => {
    vi.useFakeTimers();
    setDashboard({ widgets: [cell('a', 'test.plain', 0, 0)] });
    contributeType('test.plain');
    renderPage();
    holdFor(widgetEl('a'), 500);
    expect(editing()).toBe(true);
    expect(document.querySelectorAll('[class*="sway"]').length).toBeGreaterThan(0);
    cleanup();
    setDashboard({ widgets: [cell('a', 'test.plain', 0, 0)], editing: false });
    document.documentElement.setAttribute('data-motion', 'reduced');
    renderPage();
    holdFor(widgetEl('a'), 500);
    expect(editing()).toBe(true);
    expect(document.querySelectorAll('[class*="sway"]')).toHaveLength(0);
  });

  it('DASH-6 a 2 by 2 widget dragged over a free area shows the accent outline; over an occupied one, danger, and dropping there leaves it in place', () => {
    stubLayout(800, 600);
    contributeType('test.box');
    setDashboard({
      editing: true,
      widgets: [cell('mover', 'test.box', 0, 0), cell('blocker', 'test.box', 4, 0)],
    });
    renderPage();
    const outline = () => document.querySelector<HTMLElement>('[class*="outlineOk"], [class*="outlineBad"]');
    const mover = widgetEl('mover');
    // Over the occupied cells (x 4 and 5): four cells of 100 px to the right.
    fireEvent(mover, pointer('pointerdown', 50, 50));
    fireEvent(window, pointer('pointermove', 450, 50));
    expect(must(outline(), 'outline').className).toContain('outlineBad');
    fireEvent(window, pointer('pointerup', 450, 50));
    expect(useDashboard.getState().widgets.find((entry) => entry.id === idOf('mover'))?.x).toBe(0);
    // Over the free cells (x 2 and 3): two cells to the right.
    fireEvent(widgetEl('mover'), pointer('pointerdown', 50, 50));
    fireEvent(window, pointer('pointermove', 250, 50));
    expect(must(outline(), 'outline').className).toContain('outlineOk');
    expect(must(outline(), 'outline').style.gridColumn).toBe('3 / span 2');
    fireEvent(window, pointer('pointerup', 250, 50));
    expect(useDashboard.getState().widgets.find((entry) => entry.id === idOf('mover'))?.x).toBe(2);
  });

  it('DASH-8 with a full screen, "Add widget" then a type shows the "No room" toast and adds nothing', async () => {
    contributeType('test.full', { size: { w: 8, h: 6 }, frame: 'free', title: 'Full thing' });
    contributeType('test.box', { title: 'Box thing' });
    setDashboard({ editing: true, widgets: [cell('full', 'test.full', 0, 0, 8, 6)] });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Box thing (2 by 2)' }));
    expect(await screen.findByText('No room on this screen. Make space or add a screen.')).toBeTruthy();
    expect(useDashboard.getState().widgets).toHaveLength(1);
  });

  it('DASH-9 a removed widget comes back in the same place when "Undo" is pressed', async () => {
    contributeType('test.box', { title: 'Box thing' });
    setDashboard({
      editing: true,
      widgets: [cell('other', 'test.box', 0, 0), cell('gone', 'test.box', 3, 1)],
    });
    renderPage();
    const before = geometryOf(['gone']);
    fireEvent.click(within(widgetEl('gone')).getByRole('button', { name: 'Remove widget' }));
    expect(document.querySelector('[data-widget="' + idOf('gone') + '"]')).toBeNull();
    expect(await screen.findByText('Widget removed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(geometryOf(['gone'])).toEqual(before);
    const restored = useDashboard.getState().widgets.find((entry) => entry.id === idOf('gone'));
    expect([restored?.x, restored?.y]).toEqual([3, 1]);
  });

  it('DASH-10 removing a screen that holds 2 widgets asks "Remove this screen and its 2 widgets?"', () => {
    contributeType('test.box', { title: 'Box thing' });
    setDashboard({
      editing: true,
      screens: 2,
      widgets: [cell('a', 'test.box', 0, 0), cell('b', 'test.box', 4, 0)],
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Screens' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove screen 1' }));
    expect(screen.getByText('Remove this screen and its 2 widgets?')).toBeTruthy();
  });

  it('DASH-11 in edit mode, Right then Shift+Down on a focused 2 by 2 at 0,0 leaves it at 1,0 and 2 by 3', () => {
    contributeType('test.box', { title: 'Box thing' });
    setDashboard({ editing: true, widgets: [cell('focus', 'test.box', 0, 0)] });
    renderPage();
    widgetEl('focus').focus();
    fireEvent.keyDown(widgetEl('focus'), { key: 'ArrowRight' });
    fireEvent.keyDown(widgetEl('focus'), { key: 'ArrowDown', shiftKey: true });
    const moved = must(
      useDashboard.getState().widgets.find((entry) => entry.id === idOf('focus')),
      'focused widget',
    );
    expect([moved.x, moved.y, moved.w, moved.h]).toEqual([1, 0, 2, 3]);
    expect(widgetEl('focus').style.gridColumn).toBe('2 / span 2');
    expect(widgetEl('focus').style.gridRow).toBe('1 / span 3');
  });

  it('DASH-12 a hud.usage widget resized from 1 by 1 to 2 by 2 shows one number, then both bars', () => {
    seedHud({
      usage: {
        kind: 'ready',
        value: {
          fiveHour: { usedPercentage: 58, resetsAt: ms(2_000_000) },
          sevenDay: { usedPercentage: 21, resetsAt: ms(3_000_000) },
          updatedAt: ms(1_000),
        },
      },
    });
    const usage = must(
      hudWidgetTypes(makeDeps(createStubBus())).find((entry) => entry.id === 'hud.usage'),
      'hud.usage type',
    );
    keep(contributeUi(dashboardWidgets, usage));
    setDashboard({ widgets: [cell('usage', 'hud.usage', 0, 0, 1, 1)] });
    renderPage();
    expect(widgetEl('usage').textContent).toContain('58%');
    expect(screen.queryByText('5 hours')).toBeNull();
    act(() => {
      useDashboard.getState().moveOrResize(idOf('usage'), { x: 0, y: 0, w: 2, h: 2 });
    });
    expect(screen.getByText('5 hours')).toBeTruthy();
    expect(screen.getByText('7 days')).toBeTruthy();
  });
});

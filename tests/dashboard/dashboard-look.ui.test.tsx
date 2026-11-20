import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import type { WidgetType } from '@hsos/contracts/channels/dashboard';
import { contributeUi, ToastProvider } from '@hsos/ui-kit';
import { createDashboardPage } from '../../src/modules/dashboard/panel/DashboardPage';
import { useDashboard } from '../../src/modules/dashboard/panel/dashboard-store';
import { hudWidgetTypes } from '../../src/modules/hud/panel/widgets/hud-widgets';
import { makeDeps, seedHud, session, T1 } from '../fakes/hud-fixtures';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const widgetType = (id: string, title: string, frame: 'box' | 'free'): WidgetType => ({
  id,
  title,
  moduleId: 'test',
  minSize: { w: 1, h: 1 },
  maxSize: { w: 4, h: 4 },
  defaultSize: { w: 2, h: 2 },
  frame,
  configSchema: z.unknown(),
  defaultConfig: null,
  component: () => createElement('p', null, `${title} body`),
});

const idOf = (id: string) => id.padEnd(12, '_');
const instance = (id: string, type: string, x: number) => ({
  id: idOf(id),
  type,
  screen: 0,
  x,
  y: 0,
  w: 2,
  h: 2,
  config: null,
});

describe('dashboard widget frames (card 035 look pass)', () => {
  it('DASH-4 a box widget has the frame, four corners and a title row; a free widget has none', () => {
    contributeUi(dashboardWidgets, widgetType('look.box', 'Box thing', 'box'));
    contributeUi(dashboardWidgets, widgetType('look.free', 'Free thing', 'free'));
    useDashboard.setState({
      loaded: true,
      error: null,
      screens: 1,
      screen: 0,
      editing: false,
      grid: { columns: 8, rows: 6 },
      widgets: [instance('w1', 'look.box', 0), instance('w2', 'look.free', 3)],
    });
    const Page = createDashboardPage({ log: { log: () => undefined }, openSettings: () => undefined });
    const { container } = render(
      <ToastProvider>
        <Page />
      </ToastProvider>,
    );
    const box = container.querySelector<HTMLElement>(`[data-widget="${idOf('w1')}"]`);
    const free = container.querySelector<HTMLElement>(`[data-widget="${idOf('w2')}"]`);
    expect(box).not.toBeNull();
    expect(free).not.toBeNull();
    if (box === null || free === null) return;
    expect(box.querySelectorAll('span[class*="corner"]')).toHaveLength(4);
    expect(box.querySelector('header')?.textContent).toBe('Box thing');
    expect(box.querySelector('[class*="box"]')).not.toBeNull();
    expect(free.querySelectorAll('span[class*="corner"]')).toHaveLength(0);
    expect(free.querySelector('header')).toBeNull();
    expect(free.textContent).toContain('Free thing body');
  });
});

describe('hud dashboard widgets (card 035 look pass)', () => {
  const widget = (id: string) => {
    const found = hudWidgetTypes(makeDeps(createStubBus())).find((type) => type.id === id);
    if (found === undefined) throw new Error(`No widget type ${id}`);
    return found;
  };
  const props = (width: number, height: number, cells = { w: 2, h: 2 }) => ({
    config: null,
    cells,
    pixels: { width, height },
    setConfig: () => undefined,
  });

  it('DASH-12 the mascot at 2 by 2 cells of 360 by 320 px scales its sprite by 4, never above 4 or below 1', () => {
    seedHud({});
    const Mascot = widget('hud.mascot').component;
    const scaleOf = (width: number, height: number) => {
      const view = render(createElement(Mascot as never, props(width, height)));
      const wrapper = view.container.querySelector<HTMLElement>('span[style*="scale("]');
      const scale = wrapper?.getAttribute('style') ?? '';
      view.unmount();
      return scale;
    };
    expect(scaleOf(360, 320)).toContain('scale(4)');
    expect(scaleOf(2000, 2000)).toContain('scale(4)');
    expect(scaleOf(40, 40)).toContain('scale(1)');
    expect(scaleOf(100, 100)).toContain('scale(2)');
  });

  it('DASH-12b the context widget at 22 percent reads 22% with 4 of 20 segments on', () => {
    seedHud({
      sessions: [
        session('t', {
          terminalId: T1,
          contextUsedPercentage: 22,
          contextTokens: 44_000,
          contextWindowSize: 200_000,
        }),
      ],
      focusOrder: [T1],
    });
    const Context = widget('hud.context').component;
    const { container } = render(createElement(Context as never, props(200, 200)));
    expect(container.textContent).toContain('22%');
    const segments = container.querySelectorAll('i');
    expect(segments).toHaveLength(20);
    expect([...segments].filter((segment) => segment.hasAttribute('data-on'))).toHaveLength(4);
  });
});

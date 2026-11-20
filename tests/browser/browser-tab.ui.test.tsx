import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { BrowserTabId } from '@hsos/contracts/ids';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  BrowserSettings,
  BrowserTab as BrowserTabSchema,
  browserChannels,
} from '@hsos/contracts/channels/browser';
import { ok } from '@hsos/contracts/result';
import { PageVisibleContext, useOverlayOpen } from '@hsos/ui-kit';
import { createBrowserTab } from '../../src/modules/browser/panel/BrowserTab';
import type { BrowserTabState } from '../../src/modules/browser/panel/BrowserTab';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PANEL = 'p'.repeat(12) as never;
const TAB = 'btab00000001';
const HOME = 'https://home.example/';

let pageRect = { width: 800, height: 600 };

function tab(agent: boolean) {
  return BrowserTabSchema.parse({
    id: TAB,
    panelId: null,
    url: 'http://localhost:5173/',
    title: 'Dev server',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isAgentControlled: agent,
    error: null,
  });
}

function boundsCalls(bus: StubBus) {
  return bus.payloadsOf(browserChannels.setBounds);
}

function lastBounds(bus: StubBus) {
  const calls = boundsCalls(bus);
  const last = calls[calls.length - 1];
  if (last === undefined) throw new Error('setBounds was not sent');
  return last;
}

function pageArea(): HTMLElement {
  const area = document.querySelector<HTMLElement>('[data-page-area]');
  if (area === null) throw new Error('no page area');
  return area;
}

function renderTab(
  bus: StubBus,
  state: BrowserTabState,
  setState: (next: BrowserTabState) => void,
  options: { readonly visible?: boolean; readonly extra?: ReactNode } = {},
) {
  const Tab = createBrowserTab({
    bus,
    log: { log: () => undefined },
    settings: () => BrowserSettings.parse({ homeUrl: HOME }),
  });
  return render(
    <PageVisibleContext.Provider value={options.visible ?? true}>
      <Tab panelId={PANEL} state={state} setState={setState} isFocused />
      {options.extra}
    </PageVisibleContext.Provider>,
  );
}

function Overlay({ open }: { readonly open: boolean }) {
  useOverlayOpen(open);
  return null;
}

beforeEach(() => {
  pageRect = { width: 800, height: 600 };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const size = this.hasAttribute('data-page-area') ? pageRect : { width: 0, height: 0 };
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: size.width,
      bottom: size.height,
      width: size.width,
      height: size.height,
      toJSON: () => ({}),
    } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('browser tab (card 034)', () => {
  it('BROW-1 a panel with no tab and no URL opens the home page from settings and saves the tab id', async () => {
    const bus = createStubBus();
    bus.answer(browserChannels.openTab, () => ok(tab(false)));
    const setState = vi.fn();
    renderTab(bus, { tabId: null, url: '' }, setState);
    await waitFor(() =>
      expect(setState).toHaveBeenCalledWith({ tabId: TAB as BrowserTabId, url: 'http://localhost:5173/' }),
    );
    expect(bus.payloadsOf(browserChannels.openTab)).toEqual([{ panelId: PANEL, url: HOME }]);
  });

  it('BROW-2 the page area reports its 800 by 600 rectangle on mount, and 16 ms after a resize', async () => {
    const bus = createStubBus();
    bus.answer(browserChannels.listTabs, () => ok([tab(false)]));
    renderTab(bus, { tabId: TAB as BrowserTabId, url: '' }, vi.fn());
    await waitFor(() => expect(boundsCalls(bus).length).toBeGreaterThan(0));
    expect(lastBounds(bus)).toEqual({
      tabId: TAB as BrowserTabId,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });
    pageRect = { width: 1000, height: 600 };
    const before = boundsCalls(bus).length;
    window.dispatchEvent(new Event('resize'));
    expect(boundsCalls(bus).length).toBe(before);
    await waitFor(() => expect(lastBounds(bus).bounds.width).toBe(1000));
  });

  it('BROW-2 the page area reports width 0 while the page is hidden, and while an overlay is open (BROW-3)', async () => {
    const hiddenBus = createStubBus();
    hiddenBus.answer(browserChannels.listTabs, () => ok([tab(false)]));
    const hidden = renderTab(hiddenBus, { tabId: TAB as BrowserTabId, url: '' }, vi.fn(), { visible: false });
    await waitFor(() => expect(boundsCalls(hiddenBus).length).toBeGreaterThan(0));
    expect(lastBounds(hiddenBus).bounds.width).toBe(0);
    hidden.unmount();

    const bus = createStubBus();
    bus.answer(browserChannels.listTabs, () => ok([tab(false)]));
    const Tab = createBrowserTab({
      bus,
      log: { log: () => undefined },
      settings: () => BrowserSettings.parse({ homeUrl: HOME }),
    });
    const setState = vi.fn();
    const ui = (overlay: boolean) => (
      <PageVisibleContext.Provider value={true}>
        <Tab panelId={PANEL} state={{ tabId: TAB as BrowserTabId, url: '' }} setState={setState} isFocused />
        <Overlay open={overlay} />
      </PageVisibleContext.Provider>
    );
    const shown = render(ui(false));
    await waitFor(() => expect(lastBounds(bus).bounds.width).toBe(800));
    shown.rerender(ui(true));
    await waitFor(() => expect(lastBounds(bus).bounds.width).toBe(0));
    shown.rerender(ui(false));
    await waitFor(() => expect(lastBounds(bus).bounds.width).toBe(800));
  });

  it('BROW-41 a tab Claude controls shows the "Claude is using this tab" indicator, a Stop button and the 2 px accent frame', async () => {
    const bus = createStubBus();
    bus.answer(browserChannels.listTabs, () => ok([tab(true)]));
    renderTab(bus, { tabId: TAB as BrowserTabId, url: '' }, vi.fn());
    expect(await screen.findByText('Claude is using this tab')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(pageArea().className).toContain('pageControlled');
    expect(document.querySelector('[data-controlled]')).not.toBeNull();
    const pageCss = readFileSync(
      resolve(import.meta.dirname, '../../src/modules/browser/panel/Browser.module.css'),
      'utf8',
    );
    expect(pageCss).toMatch(/\.pageControlled\s*\{\s*border:\s*2px solid var\(--color-accent\);?\s*\}/);
  });
});

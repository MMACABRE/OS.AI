import { browserChannels, browserSection } from '@hsos/contracts/channels/browser';
import type { UiContext } from '@hsos/contracts/module';
import {
  createBrowserTab,
  focusAddressBar,
  focusedBrowserTab,
  BrowserTabState,
  INITIAL_BROWSER_TAB_STATE,
} from './panel/BrowserTab';

/**
 * Renderer side of the browser (browser.md): the `browser.tab` dock panel and its commands. The page views
 * themselves belong to main; this side draws the frame and sends the page area's bounds (BROW-2).
 */
export function register(ctx: UiContext): void {
  const settings = ctx.settings(browserSection);
  ctx.registerPanel<BrowserTabState>({
    type: 'browser.tab',
    kind: 'dock',
    title: 'Browser',
    icon: 'browser',
    stateSchema: BrowserTabState,
    initialState: INITIAL_BROWSER_TAB_STATE,
    component: createBrowserTab({
      bus: ctx.bus,
      log: ctx.log,
      settings: () => settings.get(),
    }),
    allowMultiple: true,
  });

  const withTab = (run: (tabId: NonNullable<ReturnType<typeof focusedBrowserTab>>) => void) => () => {
    const tabId = focusedBrowserTab();
    if (tabId !== null) run(tabId);
  };
  ctx.registerCommand({
    id: 'browser.newTab',
    title: 'New Browser Tab',
    defaultKey: 'Ctrl+Shift+B',
    global: true,
    run: () => ctx.openPanel('browser.tab', INITIAL_BROWSER_TAB_STATE),
  });
  ctx.registerCommand({
    id: 'browser.focusAddress',
    title: 'Focus Address Bar',
    defaultKey: 'Ctrl+L',
    global: false,
    run: focusAddressBar,
  });
  ctx.registerCommand({
    id: 'browser.captureElement',
    title: 'Capture Element',
    defaultKey: 'Ctrl+Shift+X',
    global: false,
    run: withTab((tabId) => void ctx.bus.call(browserChannels.startCapture, { tabId })),
  });
  ctx.registerCommand({
    id: 'browser.reload',
    title: 'Reload Page',
    defaultKey: 'F5',
    global: false,
    run: withTab((tabId) => void ctx.bus.call(browserChannels.reload, { tabId })),
  });
  ctx.registerCommand({
    id: 'browser.devTools',
    title: 'Page Developer Tools',
    defaultKey: 'F12',
    global: false,
    run: withTab((tabId) => void ctx.bus.call(browserChannels.openDevTools, { tabId })),
  });
}

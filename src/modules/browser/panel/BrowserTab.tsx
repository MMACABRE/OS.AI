import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { browserChannels } from '@hsos/contracts/channels/browser';
import type { BrowserSettings, BrowserTab as BrowserTabInfo } from '@hsos/contracts/channels/browser';
import type { BrowserTabId, PanelId } from '@hsos/contracts/ids';
import type { Logger, PanelProps } from '@hsos/contracts/module';
import { zBrowserTabId } from '@hsos/contracts/schemas';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  TextField,
  useAnyOverlayOpen,
  usePageVisible,
} from '@hsos/ui-kit';
import { normalizeAddress } from './address';
import styles from './Browser.module.css';

/** The saved state of a browser panel (browser.md "Tabs and the panel", BROW-1). */
export const BrowserTabState = z.object({
  tabId: zBrowserTabId.nullable(),
  url: z.string().max(8000),
});
export type BrowserTabState = z.infer<typeof BrowserTabState>;

export const INITIAL_BROWSER_TAB_STATE: BrowserTabState = { tabId: null, url: '' };

/** Delay before the page area reports its bounds again (BROW-2). */
export const BOUNDS_DEBOUNCE_MS = 16;

/** The tab the owner last used, so the commands know which page to act on. */
let focused: { readonly id: BrowserTabId; readonly focusAddress: () => void } | null = null;

/** Focuses the address field of the browser the owner last used (browser.focusAddress). */
export function focusAddressBar(): void {
  focused?.focusAddress();
}

/** The tab the owner last used, or null (browser commands). */
export function focusedBrowserTab(): BrowserTabId | null {
  return focused?.id ?? null;
}

export type BrowserTabDeps = {
  readonly bus: Bus;
  readonly log: Logger;
  readonly settings: () => BrowserSettings;
};

/**
 * The browser panel (`browser.tab`): a toolbar (back, forward, reload or stop, address, capture, developer tools
 * and the agent indicator) above the page area, whose bounds go to main so the page view sits over it (BROW-2).
 * The page view is drawn by main; in demo mode the area shows the page's address only.
 */
export function createBrowserTab(deps: BrowserTabDeps) {
  return function BrowserTab({ panelId, state, setState, isFocused }: PanelProps<BrowserTabState>) {
    const { bus } = deps;
    const [tab, setTab] = useState<BrowserTabInfo | null>(null);
    const [address, setAddress] = useState(state.url);
    const [failure, setFailure] = useState<string | null>(null);
    const area = useRef<HTMLDivElement>(null);
    const addressBox = useRef<HTMLDivElement>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const visible = usePageVisible();
    const overlayOpen = useAnyOverlayOpen();
    const tabId = tab?.id ?? null;

    // BROW-1, BROW-10: reopen the saved tab, or open a new one at the saved URL or the home page.
    useEffect(() => {
      let alive = true;
      const open = async (url: string) => {
        const result = await bus.call(browserChannels.openTab, { panelId: panelId as PanelId, url });
        if (!alive) return;
        if (!result.ok) {
          setFailure(result.error.message);
          return;
        }
        setTab(result.value);
        setAddress(result.value.url);
        setState({ ...stateRef.current, tabId: result.value.id, url: result.value.url });
      };
      const saved = stateRef.current.tabId;
      if (saved === null)
        void open(stateRef.current.url !== '' ? stateRef.current.url : deps.settings().homeUrl);
      else
        void bus.call(browserChannels.listTabs, {}).then((result) => {
          if (!alive) return;
          const found = result.ok ? result.value.find((entry) => entry.id === saved) : undefined;
          if (found === undefined)
            void open(stateRef.current.url !== '' ? stateRef.current.url : deps.settings().homeUrl);
          else {
            setTab(found);
            setAddress(found.url);
          }
        });
      const offChanged = bus.on(browserChannels.tabChanged, (next) => {
        if (!alive || next.id !== stateRef.current.tabId) return;
        setTab(next);
        setAddress(next.url);
      });
      const offClosed = bus.on(browserChannels.tabClosed, (closed) => {
        if (closed.tabId === stateRef.current.tabId) setTab(null);
      });
      return () => {
        alive = false;
        offChanged();
        offClosed();
      };
    }, [bus, panelId]);

    // BROW-2: the page area reports its rectangle; hidden, under an overlay (BROW-3) or without a width, it reports 0.
    useEffect(() => {
      const element = area.current;
      if (element === null || tabId === null) return undefined;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const send = () => {
        const rect = element.getBoundingClientRect();
        const hidden = !visible || overlayOpen || rect.width === 0;
        void bus.call(browserChannels.setBounds, {
          tabId,
          bounds: hidden
            ? { x: 0, y: 0, width: 0, height: 0 }
            : {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
        });
      };
      const schedule = () => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(send, BOUNDS_DEBOUNCE_MS);
      };
      const observer = new ResizeObserver(schedule);
      observer.observe(element);
      window.addEventListener('resize', schedule);
      send();
      return () => {
        if (timer !== null) clearTimeout(timer);
        observer.disconnect();
        window.removeEventListener('resize', schedule);
      };
    }, [bus, tabId, visible, overlayOpen]);

    // The page view leaves with the panel.
    useEffect(() => {
      const last = tabId;
      return () => {
        if (last !== null)
          void bus.call(browserChannels.setBounds, {
            tabId: last,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
          });
      };
    }, [bus, tabId]);

    useEffect(() => {
      if (!isFocused || tabId === null) return;
      focused = { id: tabId, focusAddress: () => addressBox.current?.querySelector('input')?.focus() };
    }, [isFocused, tabId]);

    const act = (
      call: () => Promise<{ readonly ok: boolean; readonly error?: { readonly message: string } }>,
    ) => {
      void call().then((result) => {
        if (!result.ok && result.error !== undefined)
          deps.log.log('warn', 'browser.action_failed', { message: result.error.message });
      });
    };
    const navigate = () => {
      if (tabId === null) return;
      const url = normalizeAddress(address);
      setFailure(null);
      act(() => bus.call(browserChannels.navigate, { tabId, url }));
    };
    const onAddressKey = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') navigate();
    };

    const controlled = tab?.isAgentControlled === true;
    const error = failure ?? tab?.error ?? null;

    return (
      <div className={styles.panel} data-controlled={controlled ? '' : undefined}>
        <div className={styles.toolbar} role="toolbar" aria-label="Browser tools">
          <IconButton
            icon={
              <span className={styles.flip}>
                <Icon name="chevron-right" />
              </span>
            }
            label="Back"
            disabled={tab?.canGoBack !== true}
            onPress={() => tabId !== null && act(() => bus.call(browserChannels.back, { tabId }))}
          />
          <IconButton
            icon={<Icon name="chevron-right" />}
            label="Forward"
            disabled={tab?.canGoForward !== true}
            onPress={() => tabId !== null && act(() => bus.call(browserChannels.forward, { tabId }))}
          />
          {tab?.isLoading === true ? (
            <IconButton
              icon={<Icon name="stop" />}
              label="Stop"
              onPress={() => tabId !== null && act(() => bus.call(browserChannels.stop, { tabId }))}
            />
          ) : (
            <IconButton
              icon={<Icon name="refresh" />}
              label="Reload"
              disabled={tabId === null}
              onPress={() => tabId !== null && act(() => bus.call(browserChannels.reload, { tabId }))}
            />
          )}
          <div ref={addressBox} className={styles.address} onKeyDown={onAddressKey}>
            <TextField
              label="Address"
              value={address}
              onChange={setAddress}
              placeholder="Search or enter an address"
              mono
            />
          </div>
          <IconButton
            icon={<Icon name="target" />}
            label="Capture element"
            disabled={tabId === null}
            onPress={() => tabId !== null && act(() => bus.call(browserChannels.startCapture, { tabId }))}
          />
          <IconButton
            icon={<Icon name="terminal" />}
            label="Developer tools"
            disabled={tabId === null}
            onPress={() => tabId !== null && act(() => bus.call(browserChannels.openDevTools, { tabId }))}
          />
        </div>
        {controlled ? (
          <div className={styles.agent} role="status">
            <i className={styles.light} aria-hidden="true" />
            <span>Claude is using this tab</span>
            <Button
              size="small"
              onPress={() =>
                tabId !== null && act(() => bus.call(browserChannels.revokeAgentControl, { tabId }))
              }
            >
              Stop
            </Button>
          </div>
        ) : null}
        {tab?.isLoading === true ? <div className={styles.loading} aria-hidden="true" /> : null}
        <div
          ref={area}
          className={controlled ? `${styles.page} ${styles.pageControlled}` : styles.page}
          data-page-area=""
        >
          {error !== null ? (
            <EmptyState
              title="This page could not be loaded."
              message={error}
              action={{
                label: 'Retry',
                onPress: () => tabId !== null && act(() => bus.call(browserChannels.reload, { tabId })),
              }}
            />
          ) : tab === null ? (
            <EmptyState title="Browser" message="Opening the page…" />
          ) : (
            <div className={styles.placeholder}>
              <p className={styles.placeholderTitle}>{tab.title === '' ? 'New tab' : tab.title}</p>
              <p className={styles.placeholderUrl}>{tab.url}</p>
            </div>
          )}
        </div>
      </div>
    );
  };
}

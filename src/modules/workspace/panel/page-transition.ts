import { flushSync } from 'react-dom';
import { PAGES, usePageStore } from './page-store';
import type { PageId } from './page-store';

/** The `view-transition-name` of the page area; the background, title bar and status bar carry none (MOT-7). */
export const PAGE_TRANSITION_NAME = 'hsos-page';

type ViewTransitionLike = {
  readonly finished: Promise<void>;
  skipTransition(): void;
};

type StartViewTransition = (update: () => void) => ViewTransitionLike;

let running: ViewTransitionLike | null = null;
const shared = new Set<HTMLElement>();

/**
 * Gives `element` the `view-transition-name` `name` for the next page transition only (MOT-6), so an
 * element that exists on both pages moves between its two places instead of fading.
 */
export function shareForTransition(element: HTMLElement, name: string): void {
  element.style.setProperty('view-transition-name', name);
  shared.add(element);
}

const clearShared = () => {
  for (const element of shared) element.style.removeProperty('view-transition-name');
  shared.clear();
};

/** Which way the pages slide: toward the side of the switcher the old page is leaving to (MOT-5). */
function direction(from: PageId, to: PageId): 'left' | 'right' {
  return PAGES.indexOf(to) > PAGES.indexOf(from) ? 'left' : 'right';
}

/**
 * Switches the page (WS-40, WS-42) through `document.startViewTransition` (MOT-5). The update runs at
 * once, so a key pressed during the transition reaches its target (MOT-11); a second switch while one
 * runs skips the first to its end. Without the API, or under reduced motion's own CSS, the page simply
 * changes. Focus moves with the page (WS-45).
 */
export function goToPage(to: PageId): void {
  const store = usePageStore.getState();
  const from = store.page;
  if (from === to) {
    clearShared();
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) store.rememberFocus(from, active);
  const update = () => {
    flushSync(() => usePageStore.getState().show(to));
    restoreFocus(to);
  };
  running?.skipTransition();
  const start = Reflect.get(document, 'startViewTransition') as StartViewTransition | undefined;
  if (typeof start !== 'function') {
    update();
    clearShared();
    return;
  }
  document.documentElement.dataset.pageDirection = direction(from, to);
  const transition = start.call(document, update);
  running = transition;
  void transition.finished.finally(() => {
    if (running === transition) running = null;
    clearShared();
  });
}

/** Gives focus to what last had it on `page`, else the page's first focusable panel content (WS-45). */
function restoreFocus(page: PageId): void {
  const remembered = usePageStore.getState().lastFocus[page];
  if (remembered?.isConnected === true) {
    remembered.focus({ preventScroll: true });
    return;
  }
  const host = document.querySelector<HTMLElement>(`[data-page="${page}"]`);
  const first =
    host?.querySelector<HTMLElement>('[data-hsos-terminal] textarea, [data-hsos-terminal]') ??
    host?.querySelector<HTMLElement>('[tabindex="0"], button, input');
  first?.focus({ preventScroll: true });
}

import { create } from 'zustand';

/** The three pages of the window (WS-40), in switcher order. */
export const PAGES = ['dashboard', 'code', 'notes'] as const;
export type PageId = (typeof PAGES)[number];

export const PAGE_TITLES: Readonly<Record<PageId, string>> = {
  dashboard: 'Dashboard',
  code: 'Code',
  notes: 'Notes',
};

type PageState = {
  readonly page: PageId;
  /** Pages shown at least once: they stay mounted from then on (WS-41). */
  readonly shown: ReadonlySet<PageId>;
  /** The element that last had focus on each page, to give it back after a switch (WS-45). */
  readonly lastFocus: Readonly<Partial<Record<PageId, HTMLElement>>>;
  show(page: PageId): void;
  rememberFocus(page: PageId, element: HTMLElement): void;
};

/** The active page and what each page remembers. A project opened for the first time starts on `code` (WS-44). */
export const usePageStore = create<PageState>((set) => ({
  page: 'code',
  shown: new Set<PageId>(['code']),
  lastFocus: {},
  show: (page) =>
    set((state) => (state.page === page ? state : { page, shown: new Set([...state.shown, page]) })),
  rememberFocus: (page, element) => set((state) => ({ lastFocus: { ...state.lastFocus, [page]: element } })),
}));

/** The page beside `from` in switcher order, wrapping around (WS-40, Ctrl+Alt+Left and Right). */
export function pageBeside(from: PageId, step: -1 | 1): PageId {
  const index = PAGES.indexOf(from);
  return PAGES[(index + step + PAGES.length) % PAGES.length] ?? from;
}

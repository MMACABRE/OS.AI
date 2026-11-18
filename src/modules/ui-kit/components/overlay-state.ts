import { useEffect, useSyncExternalStore } from 'react';

let openCount = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Overlays announce themselves while open (BROW-3): a page view drawn above the window would hide them,
 * so the browser panel hides its views while any overlay is open. Every menu, dialog and the palette calls this.
 */
export function useOverlayOpen(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    openCount += 1;
    notify();
    return () => {
      openCount -= 1;
      notify();
    };
  }, [open]);
}

/** True while at least one overlay is open. */
export function useAnyOverlayOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => openCount > 0,
  );
}

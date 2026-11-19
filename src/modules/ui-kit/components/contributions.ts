import { useSyncExternalStore } from 'react';
import type { ExtensionPoint } from '@hsos/contracts/module';

/*
 * Extension points in the renderer, such as `terminalHeader` (TERM-75). `UiContext` has no
 * `contribute`, so modules contribute here: the ui-kit is the one module every panel may import.
 */
const points = new Map<string, readonly unknown[]>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** Adds a contribution to `point` until the returned function is called. */
export function contributeUi<T>(point: ExtensionPoint<T>, contribution: T): () => void {
  points.set(point.id, [...(points.get(point.id) ?? []), contribution]);
  notify();
  return () => {
    points.set(
      point.id,
      (points.get(point.id) ?? []).filter((entry) => entry !== contribution),
    );
    notify();
  };
}

const EMPTY: readonly never[] = [];

/** Everything contributed to `point`, in registration order. */
export function uiContributions<T>(point: ExtensionPoint<T>): readonly T[] {
  return (points.get(point.id) ?? EMPTY) as readonly T[];
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The contributions to `point`, re-rendering when one is added or removed. */
export function useUiContributions<T>(point: ExtensionPoint<T>): readonly T[] {
  return useSyncExternalStore(
    subscribe,
    () => uiContributions(point),
    () => uiContributions(point),
  );
}

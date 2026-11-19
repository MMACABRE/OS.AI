import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { TokenName } from '@hsos/contracts/theme';
import type { Rgb, SceneSource } from './scenes/types';

type SourceEntry = {
  readonly element: HTMLElement;
  readonly colourToken: TokenName;
  readonly strength: number;
};

const entries = new Set<SourceEntry>();

/** Adds an element as a steam source until the returned function is called (UI-35). */
export function addBackdropSource(element: HTMLElement, colourToken: TokenName, strength: number): () => void {
  const entry: SourceEntry = { element, colourToken, strength };
  entries.add(entry);
  return () => {
    entries.delete(entry);
  };
}

/**
 * Makes the element behind `ref` a source of the scene in the colour of `colourToken` (UI-35), for
 * example a graph node, a live session ribbon or the focused terminal. It leaves when the component
 * unmounts; while its page is hidden it is skipped (WS-41).
 */
export function useBackdropSource(
  ref: RefObject<HTMLElement | null>,
  colourToken: TokenName,
  strength: number,
): void {
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    return addBackdropSource(element, colourToken, strength);
  }, [ref, colourToken, strength]);
}

const isShown = (element: HTMLElement): boolean => {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  return typeof element.checkVisibility === 'function' ? element.checkVisibility({ visibilityProperty: true }) : true;
};

/** The sources on the visible page, as centres in window fractions with their colours (UI-35). */
export function visibleBackdropSources(
  colourOf: (token: TokenName) => Rgb,
  viewport: { readonly width: number; readonly height: number },
): SceneSource[] {
  if (viewport.width <= 0 || viewport.height <= 0) return [];
  const sources: SceneSource[] = [];
  for (const entry of entries) {
    if (!isShown(entry.element)) continue;
    const box = entry.element.getBoundingClientRect();
    sources.push({
      x: (box.left + box.width / 2) / viewport.width,
      y: (box.top + box.height / 2) / viewport.height,
      colour: colourOf(entry.colourToken),
      strength: entry.strength,
    });
  }
  return sources;
}

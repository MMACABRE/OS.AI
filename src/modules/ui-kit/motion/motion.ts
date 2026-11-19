import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

/** MOT-3: lists enter with a stagger of 20 ms per item, at most 8 items staggered. */
export const STAGGER_STEP_MS = 20;
export const STAGGER_MAX_ITEMS = 8;

/** The entry delay of the item at `index`: 0, 20, ... 140 ms, and 140 ms for every later item (MOT-3). */
export function staggerDelayMs(index: number): number {
  return Math.min(Math.max(0, Math.floor(index)), STAGGER_MAX_ITEMS - 1) * STAGGER_STEP_MS;
}

/** Inline style that gives an entering item its stagger delay; used with the `enter` motion class. */
export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${staggerDelayMs(index)}ms` };
}

/** True while the root carries `data-motion="reduced"` (SET-15, MOT-12). */
export function isReducedMotion(root: HTMLElement = document.documentElement): boolean {
  return root.getAttribute('data-motion') === 'reduced';
}

const subscribeMotion = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => observer.disconnect();
};

/** Follows `data-motion` on the root element; components use it for motion CSS cannot express (MOT-12). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, () => isReducedMotion(), () => false);
}

/** Rows wider than this tilt by half (MOT-2). */
export const WIDE_ROW_PX = 200;

/** Reads a theme token from the root element's CSS variables, for example `button.tilt` as degrees. */
function tokenNumber(variable: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The tilt of MOT-2 for a pointer at (`x`, `y`) inside a box: toward the pointer by at most `maxDeg`,
 * half that for boxes wider than 200 px. Returns rotateX and rotateY in degrees.
 */
export function tiltToward(
  box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  x: number,
  y: number,
  maxDeg: number,
): { readonly rx: number; readonly ry: number } {
  if (box.width <= 0 || box.height <= 0) return { rx: 0, ry: 0 };
  const limit = box.width > WIDE_ROW_PX ? maxDeg / 2 : maxDeg;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const nx = clamp(((x - box.left) / box.width) * 2 - 1);
  const ny = clamp(((y - box.top) / box.height) * 2 - 1);
  return { rx: -ny * limit, ry: nx * limit };
}

type LiftHandlers = {
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * Pointer handlers for an element with the `lift` class (MOT-2): they set `--hsos-rx` and `--hsos-ry`
 * so it tilts toward the pointer, and mark the release with `data-released` so it springs back over
 * `motion.quick`. Writes go straight to the element's style, never through React state.
 */
export function useLift(): LiftHandlers {
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || isReducedMotion()) return;
    const element = event.currentTarget;
    const { rx, ry } = tiltToward(
      element.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      tokenNumber('--button-tilt', 0),
    );
    element.style.setProperty('--hsos-rx', `${rx.toFixed(2)}deg`);
    element.style.setProperty('--hsos-ry', `${ry.toFixed(2)}deg`);
  }, []);
  const onPointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const element = event.currentTarget;
    element.style.removeProperty('--hsos-rx');
    element.style.removeProperty('--hsos-ry');
  }, []);
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.removeAttribute('data-released');
  }, []);
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const element = event.currentTarget;
    element.setAttribute('data-released', '');
    const done = (end: TransitionEvent) => {
      if (end.propertyName !== 'transform') return;
      element.removeAttribute('data-released');
      element.removeEventListener('transitionend', done);
    };
    element.addEventListener('transitionend', done);
  }, []);
  return { onPointerMove, onPointerLeave, onPointerDown, onPointerUp };
}

/** How long a list counts as entering: the last stagger delay plus `motion.normal` (180 ms), rounded up. */
export const LIST_ENTER_MS = 360;

/** True during the first moments after mount, so a list's rows stagger in once, not on every scroll (MOT-3). */
export function useEntering(): boolean {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), LIST_ENTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return entering;
}

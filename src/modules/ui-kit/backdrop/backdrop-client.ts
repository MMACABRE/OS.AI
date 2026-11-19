import { tokenToCssVariable } from '@hsos/contracts/theme';
import type { TokenName } from '@hsos/contracts/theme';
import { MAX_BACKDROP_FPS } from './protocol';
import type { BackdropSettings, FromBackdropWorker, ToBackdropWorker } from './protocol';
import { parseHex } from './scenes/types';
import type { Rgb } from './scenes/types';
import { visibleBackdropSources } from './sources';

/** UI-35: source positions reach the worker at most 10 times a second. */
export const SOURCE_INTERVAL_MS = 100;
/** A pointer that moved further than this between down and click was a drag, not a puff (UI-33). */
export const PUFF_DRAG_PX = 4;

/** Clicks on these, or inside them, are not puffs: they land on a control or a surface (UI-33). */
const NOT_EMPTY_SPACE = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'summary',
  'textarea',
  '[contenteditable]',
  '[role]',
  '[tabindex]',
  '[data-hsos-terminal]',
  '[data-surface]:not([data-surface="app"])',
].join(', ');

const PALETTE_TOKENS: readonly TokenName[] = [
  'color.structure',
  'color.brand',
  'color.memory',
  'color.knowledge',
  'color.live',
];

const FALLBACK: Rgb = [11, 10, 9];

export type BackdropHandle = {
  /** Frames the worker has drawn since it started (MOT-7, UI-32). */
  stats(): Promise<FromBackdropWorker>;
  stop(): void;
};

export type BackdropOptions = {
  readonly createWorker?: () => Worker;
  readonly root?: HTMLElement;
};

const defaultWorker = (): Worker =>
  new Worker(new URL('./backdrop.worker.ts', import.meta.url), { type: 'module', name: 'hsos-backdrop' });

/** Reads the backdrop's tokens from the root element's CSS variables (set by `applyTheme`). */
export function readBackdropSettings(root: HTMLElement, viewportWidth: number): BackdropSettings {
  const style = getComputedStyle(root);
  const raw = (token: TokenName) =>
    style
      .getPropertyValue(tokenToCssVariable(token))
      .trim()
      .replace(/^['"]|['"]$/g, '');
  const number = (token: TokenName, fallback: number) => {
    const value = Number.parseFloat(raw(token));
    return Number.isFinite(value) ? value : fallback;
  };
  const colour = (token: TokenName) => parseHex(raw(token), FALLBACK);
  return {
    scene: raw('backdrop.scene') || 'still',
    fps: Math.max(1, Math.min(MAX_BACKDROP_FPS, number('backdrop.fps', MAX_BACKDROP_FPS))),
    reduced: root.getAttribute('data-motion') === 'reduced',
    barrel: number('crt.barrel', 0),
    viewportWidth,
    config: {
      background: colour('color.bg.app'),
      accent: colour('color.accent'),
      palette: PALETTE_TOKENS.map(colour),
      dust: colour('color.text.secondary'),
    },
  };
}

/**
 * Runs the background in a worker on `canvas` (UI-30): hands it the canvas as an `OffscreenCanvas`,
 * follows theme, motion and visibility changes, and forwards pointer moves (at most once a frame),
 * puffs (UI-33) and steam sources (UI-35). Every listener is on `window` or `document` and passive;
 * none is on the canvas.
 */
export function startBackdrop(canvas: HTMLCanvasElement, options: BackdropOptions = {}): BackdropHandle {
  const root = options.root ?? document.documentElement;
  const idle: BackdropHandle = {
    stats: () => Promise.resolve({ type: 'stats', frames: 0, scene: 'none' }),
    stop: () => undefined,
  };
  if (typeof canvas.transferControlToOffscreen !== 'function') return idle;
  let worker: Worker;
  try {
    worker = (options.createWorker ?? defaultWorker)();
  } catch {
    return idle;
  }
  const post = (message: ToBackdropWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer);

  let settings = readBackdropSettings(root, window.innerWidth);
  const offscreen = canvas.transferControlToOffscreen();
  post({ type: 'start', canvas: offscreen, settings }, [offscreen]);
  post({ type: 'visibility', hidden: document.hidden });

  const refreshSettings = () => {
    const next = readBackdropSettings(root, window.innerWidth);
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    settings = next;
    post({ type: 'settings', settings });
  };
  const themeObserver = new MutationObserver(refreshSettings);
  themeObserver.observe(root, { attributes: true, attributeFilter: ['style', 'data-motion'] });

  const onVisibility = () => post({ type: 'visibility', hidden: document.hidden });

  let pendingPointer: { x: number; y: number } | null = null;
  let pointerFrame: number | null = null;
  const onPointerMove = (event: PointerEvent) => {
    pendingPointer = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
    if (pointerFrame !== null) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = null;
      if (pendingPointer !== null) post({ type: 'pointer', ...pendingPointer });
    });
  };

  let down: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const onClick = (event: MouseEvent) => {
    const start = down;
    down = null;
    if (start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) > PUFF_DRAG_PX) return;
    const target = event.target;
    if (target instanceof Element && target.closest(NOT_EMPTY_SPACE) !== null) return;
    post({ type: 'puff', x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight });
  };

  const colourOf = (token: TokenName) =>
    parseHex(getComputedStyle(root).getPropertyValue(tokenToCssVariable(token)).trim(), FALLBACK);
  let hadSources = false;
  const sourceTimer = setInterval(() => {
    if (document.hidden) return;
    const sources = visibleBackdropSources(colourOf, { width: window.innerWidth, height: window.innerHeight });
    if (sources.length === 0 && !hadSources) return;
    hadSources = sources.length > 0;
    post({ type: 'sources', sources });
  }, SOURCE_INTERVAL_MS);

  const passive = { passive: true } as const;
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointermove', onPointerMove, passive);
  window.addEventListener('pointerdown', onPointerDown, passive);
  window.addEventListener('click', onClick, passive);
  window.addEventListener('resize', refreshSettings, passive);

  return {
    stats: () =>
      new Promise((resolve) => {
        const onMessage = (event: MessageEvent<FromBackdropWorker>) => {
          if (event.data.type !== 'stats') return;
          worker.removeEventListener('message', onMessage);
          resolve(event.data);
        };
        worker.addEventListener('message', onMessage);
        post({ type: 'stats' });
      }),
    stop: () => {
      themeObserver.disconnect();
      clearInterval(sourceTimer);
      if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', refreshSettings);
      worker.terminate();
    },
  };
}

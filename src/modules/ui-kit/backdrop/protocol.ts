import type { SceneConfig, SceneSource } from './scenes/types';

/** What the renderer tells the background worker (UI-30 to UI-35). Positions are window fractions. */
export type BackdropSettings = {
  /** `backdrop.scene`. */
  readonly scene: string;
  /** `backdrop.fps`, at most 30 (UI-32). */
  readonly fps: number;
  /** `data-motion="reduced"`: draw one frame and stop (MOT-12). */
  readonly reduced: boolean;
  /** `crt.barrel`: the bend at the corners in window pixels; the worker scales it to the canvas. */
  readonly barrel: number;
  /** The window's width in CSS pixels, to scale `barrel`. */
  readonly viewportWidth: number;
  readonly config: Omit<SceneConfig, 'barrelPx'>;
};

export type ToBackdropWorker =
  | { readonly type: 'start'; readonly canvas: OffscreenCanvas; readonly settings: BackdropSettings }
  | { readonly type: 'settings'; readonly settings: BackdropSettings }
  | { readonly type: 'pointer'; readonly x: number; readonly y: number }
  | { readonly type: 'puff'; readonly x: number; readonly y: number }
  | { readonly type: 'sources'; readonly sources: readonly SceneSource[] }
  | { readonly type: 'visibility'; readonly hidden: boolean }
  | { readonly type: 'stats' };

export type FromBackdropWorker = {
  readonly type: 'stats';
  /** Frames drawn since the worker started; it never resets while the window lives (MOT-7). */
  readonly frames: number;
  readonly scene: string;
};

/** UI-32: the scene never runs faster than this. */
export const MAX_BACKDROP_FPS = 30;
/** MOT-12: frames stepped before the one still frame, so the steam has already risen. */
export const STILL_WARMUP_STEPS = 60;

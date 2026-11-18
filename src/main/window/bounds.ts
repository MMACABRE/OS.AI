import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type WindowPlacement = { readonly bounds: Rect; readonly isMaximized: boolean };

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 800;
/** Smallest window HSOS restores; anything smaller is treated as broken. */
const MIN_SIZE = 200;

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** A 1280 by 800 window centred in the primary display's work area (clipped to it when the display is smaller). */
export function centredDefault(primary: Rect): Rect {
  const width = Math.min(DEFAULT_WIDTH, primary.width);
  const height = Math.min(DEFAULT_HEIGHT, primary.height);
  return {
    x: Math.round(primary.x + (primary.width - width) / 2),
    y: Math.round(primary.y + (primary.height - height) / 2),
    width,
    height,
  };
}

/**
 * The placement to open the window with (SHELL-6): the saved one when it overlaps a connected display,
 * otherwise a centred 1280 by 800 window on the primary display. `displays` are work areas.
 */
export function restorePlacement(
  saved: WindowPlacement | null,
  displays: readonly Rect[],
  primary: Rect,
): WindowPlacement {
  const fallback = { bounds: centredDefault(primary), isMaximized: saved?.isMaximized ?? false };
  if (saved === null) return fallback;
  const { bounds } = saved;
  const usable =
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    bounds.width >= MIN_SIZE &&
    bounds.height >= MIN_SIZE &&
    displays.some((display) => intersects(bounds, display));
  return usable ? saved : fallback;
}

/** App state files this build understands; a higher `version` is neither read nor overwritten (architecture §5). */
export const APP_STATE_VERSION = 1;

function isTooNew(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false;
  const version: unknown = Reflect.get(state, 'version');
  return typeof version === 'number' && version > APP_STATE_VERSION;
}

function isRect(value: unknown): value is Rect {
  if (typeof value !== 'object' || value === null) return false;
  return ['x', 'y', 'width', 'height'].every((key) => typeof Reflect.get(value, key) === 'number');
}

/** The saved placement in `appStateFile` under `window`, or null when missing or unreadable. */
export async function readPlacement(appStateFile: string): Promise<WindowPlacement | null> {
  try {
    const state: unknown = JSON.parse(await readFile(appStateFile, 'utf8'));
    if (isTooNew(state)) return null;
    const window: unknown = typeof state === 'object' && state !== null ? Reflect.get(state, 'window') : null;
    if (typeof window !== 'object' || window === null) return null;
    const bounds: unknown = Reflect.get(window, 'bounds');
    const isMaximized: unknown = Reflect.get(window, 'isMaximized');
    return isRect(bounds) ? { bounds, isMaximized: isMaximized === true } : null;
  } catch {
    return null;
  }
}

/**
 * Saves the placement into `appStateFile`, keeping its other keys, the previous content as `.bak`
 * (architecture §5), and a top-level `version`. A failure is reported to the caller, never thrown.
 */
export async function writePlacement(appStateFile: string, placement: WindowPlacement): Promise<boolean> {
  try {
    let previous: string | null = null;
    let state: Record<string, unknown> = {};
    try {
      previous = await readFile(appStateFile, 'utf8');
      const parsed: unknown = JSON.parse(previous);
      if (isTooNew(parsed)) return false;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) state = { ...parsed };
    } catch {
      // No readable file yet: start from an empty state.
    }
    await mkdir(dirname(appStateFile), { recursive: true });
    if (previous !== null) await writeFile(`${appStateFile}.bak`, previous, 'utf8');
    const next = { ...state, version: APP_STATE_VERSION, window: placement };
    const temp = `${appStateFile}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(temp, appStateFile);
    return true;
  } catch {
    return false;
  }
}

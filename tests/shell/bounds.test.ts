import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPlacement, restorePlacement, writePlacement } from '../../src/main/window/bounds';
import type { Rect, WindowPlacement } from '../../src/main/window/bounds';

const primary: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const second: Rect = { x: 1920, y: 0, width: 1920, height: 1040 };

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hsos-bounds-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('window bounds', () => {
  it('SHELL-6 saved bounds outside all displays give 1280 by 800 centred on the primary work area', () => {
    const saved: WindowPlacement = {
      bounds: { x: 9_000, y: 9_000, width: 900, height: 600 },
      isMaximized: false,
    };

    const placement = restorePlacement(saved, [primary], primary);

    expect(placement.bounds).toEqual({ x: 320, y: 120, width: 1280, height: 800 });
  });

  it('SHELL-6 with no saved bounds the window is 1280 by 800 centred on a primary display with an offset', () => {
    const offset: Rect = { x: 100, y: 50, width: 2000, height: 1200 };
    expect(restorePlacement(null, [offset], offset).bounds).toEqual({
      x: 460,
      y: 250,
      width: 1280,
      height: 800,
    });
  });

  it('SHELL-6 saved bounds on a second display are kept', () => {
    const saved: WindowPlacement = {
      bounds: { x: 2_000, y: 100, width: 1000, height: 700 },
      isMaximized: true,
    };
    expect(restorePlacement(saved, [primary, second], primary)).toEqual(saved);
  });

  it('SHELL-6 bounds on a display that is no longer connected fall back to the primary one', () => {
    const saved: WindowPlacement = {
      bounds: { x: 2_000, y: 100, width: 1000, height: 700 },
      isMaximized: false,
    };
    expect(restorePlacement(saved, [primary], primary).bounds).toEqual({
      x: 320,
      y: 120,
      width: 1280,
      height: 800,
    });
  });

  it('SHELL-6 a work area smaller than 1280 by 800 clips the default to it', () => {
    const small: Rect = { x: 0, y: 0, width: 1024, height: 700 };
    expect(restorePlacement(null, [small], small).bounds).toEqual({ x: 0, y: 0, width: 1024, height: 700 });
  });

  it('SHELL-6 writePlacement then readPlacement round-trips the placement', async () => {
    const file = join(dir, 'state', 'app.json');
    const placement: WindowPlacement = {
      bounds: { x: 10, y: 20, width: 1100, height: 700 },
      isMaximized: true,
    };
    expect(await writePlacement(file, placement)).toBe(true);
    expect(await readPlacement(file)).toEqual(placement);
  });

  it('SHELL-6 writePlacement keeps other keys of app.json and writes app.json.bak with the old content', async () => {
    const file = join(dir, 'app.json');
    const old = JSON.stringify({ version: 1, lastProject: 'abc', window: { stale: true } });
    await writeFile(file, old, 'utf8');
    const placement: WindowPlacement = {
      bounds: { x: 1, y: 2, width: 300, height: 400 },
      isMaximized: false,
    };

    expect(await writePlacement(file, placement)).toBe(true);

    const state: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(state).toEqual({ version: 1, lastProject: 'abc', window: placement });
    expect(await readFile(`${file}.bak`, 'utf8')).toBe(old);
  });

  it('SHELL-6 writePlacement refuses a file whose version is higher than 1 and leaves it unchanged', async () => {
    const file = join(dir, 'app.json');
    const future = JSON.stringify({ version: 2, window: { keep: 'me' } });
    await writeFile(file, future, 'utf8');

    const written = await writePlacement(file, {
      bounds: { x: 1, y: 2, width: 300, height: 400 },
      isMaximized: false,
    });

    expect(written).toBe(false);
    expect(await readFile(file, 'utf8')).toBe(future);
    expect(await readPlacement(file)).toBeNull();
  });

  it('SHELL-6 readPlacement of a missing or broken file is null', async () => {
    expect(await readPlacement(join(dir, 'missing.json'))).toBeNull();
    await writeFile(join(dir, 'broken.json'), '{ not json', 'utf8');
    expect(await readPlacement(join(dir, 'broken.json'))).toBeNull();
  });
});

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mascot } from '../../src/modules/hud/panel/mascot/Mascot';
import { frameAt, mascotStateFor } from '../../src/modules/hud/panel/mascot/mascot-sheet';
import type { StateRow } from '../../src/modules/hud/panel/mascot/mascot-sheet';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-motion');
});

/** The strip's offset in cells: translate(Xrem, Yrem) at 2 rem a cell is X / 2 across and Y / 2 down. */
function offset(container: HTMLElement): { frame: number; row: number } {
  const image = container.querySelector('img');
  const numbers = /translate\((-?[\d.]+)rem,\s*(-?[\d.]+)rem\)/.exec(image?.style.transform ?? '');
  if (numbers === null) throw new Error(`no transform on the strip: ${image?.getAttribute('style') ?? ''}`);
  return { frame: Math.abs(Number(numbers[1])) / 2, row: Math.abs(Number(numbers[2])) / 2 };
}

describe('HUD-90 the mascot follows the activity', () => {
  it('HUD-90 mascotStateFor: working and background give working, reading, dancing on code, notes and other', () => {
    for (const activity of ['working', 'background'] as const) {
      expect(mascotStateFor(activity, 'code')).toBe('working');
      expect(mascotStateFor(activity, 'notes')).toBe('reading');
      expect(mascotStateFor(activity, 'other')).toBe('dancing');
    }
  });

  it('HUD-90 mascotStateFor: needs-you waves, done cheers, idle rests, ended and null sleep, on every page', () => {
    for (const page of ['code', 'notes', 'other'] as const) {
      expect(mascotStateFor('needs-you', page)).toBe('waving');
      expect(mascotStateFor('done', page)).toBe('cheering');
      expect(mascotStateFor('idle', page)).toBe('resting');
      expect(mascotStateFor('ended', page)).toBe('sleeping');
      expect(mascotStateFor(null, page)).toBe('sleeping');
    }
  });

  it('HUD-90 one working session shows dancing on the Dashboard, working in the Code ribbon and reading on Notes', () => {
    const states = (['other', 'code', 'notes'] as const).map((page) => {
      const { container, unmount } = render(<Mascot activity="working" page={page} scale={2} />);
      const state = container.querySelector('[data-mascot]')?.getAttribute('data-mascot');
      unmount();
      return state;
    });
    expect(states).toEqual(['dancing', 'working', 'reading']);
  });

  it('HUD-90 working, needs-you, done and idle render dancing, waving, cheering and resting frames', () => {
    const rows = (['working', 'needs-you', 'done', 'idle'] as const).map((activity) => {
      const { container, unmount } = render(<Mascot activity={activity} page="other" scale={2} />);
      const result = {
        state: container.querySelector('[data-mascot]')?.getAttribute('data-mascot'),
        row: offset(container).row,
      };
      unmount();
      return result;
    });
    // The rows come from resources/art/mascot.json: dancing 0, waving 1, cheering 2, resting 3.
    expect(rows).toEqual([
      { state: 'dancing', row: 0 },
      { state: 'waving', row: 1 },
      { state: 'cheering', row: 2 },
      { state: 'resting', row: 3 },
    ]);
  });
});

describe('HUD-91 a change of state plays the turn first', () => {
  it('HUD-91 working to needs-you shows row 5 (turn) for 3 frames at 12 fps, then row 1', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Mascot activity="working" page="code" scale={2} />);
    // Code page, working: row 7 of the sheet.
    expect(offset(container)).toEqual({ frame: 0, row: 7 });

    rerender(<Mascot activity="needs-you" page="code" scale={2} />);
    expect(offset(container)).toEqual({ frame: 0, row: 5 });
    act(() => {
      vi.advanceTimersByTime(84);
    });
    expect(offset(container)).toEqual({ frame: 1, row: 5 });
    act(() => {
      vi.advanceTimersByTime(83);
    });
    expect(offset(container)).toEqual({ frame: 2, row: 5 });
    act(() => {
      vi.advanceTimersByTime(84);
    });
    expect(offset(container).row).toBe(1);
    expect(offset(container).frame).toBe(0);
  });

  it('HUD-91 the first render plays the loop at once, with no turn', () => {
    vi.useFakeTimers();
    const { container } = render(<Mascot activity="needs-you" page="code" scale={2} />);
    expect(offset(container)).toEqual({ frame: 0, row: 1 });
    // Waving runs at 6 fps over 4 frames: frame 1 shows after about 167 ms.
    act(() => {
      vi.advanceTimersByTime(168);
    });
    expect(offset(container)).toEqual({ frame: 1, row: 1 });
  });
});

describe('HUD-93 reduced motion', () => {
  it('HUD-93 under data-motion reduced a dancing mascot stays at frame 0 of its row after 2 s, and is aria-hidden', () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-motion', 'reduced');
    const { container } = render(<Mascot activity="working" page="other" scale={2} state="dancing" />);
    expect(offset(container)).toEqual({ frame: 0, row: 0 });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(offset(container)).toEqual({ frame: 0, row: 0 });
    expect(container.querySelector('[data-mascot]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('HUD-93 with full motion the same mascot moves on after its frame time', () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-motion', 'full');
    const { container } = render(<Mascot activity="working" page="other" scale={2} state="dancing" />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    const { frame, row } = offset(container);
    expect(row).toBe(0);
    expect(frame).toBeGreaterThanOrEqual(0);
    // Dancing runs at 8 fps over 6 frames, so after 2 s the strip has moved through several frames.
    act(() => {
      vi.advanceTimersByTime(125);
    });
    expect(offset(container).frame).not.toBe(frame);
  });
});

describe('frameAt', () => {
  const dancing: StateRow = { row: 0, frames: 6, fps: 8, loop: 'loop' };
  const cheering: StateRow = { row: 2, frames: 6, fps: 6, loop: 'from 4' };
  const resting: StateRow = { row: 3, frames: 4, fps: 4, loop: 'loop, hold frame 0' };

  it('HUD-91 a plain loop wraps', () => {
    expect([0, 1, 5, 6, 7, 12].map((step) => frameAt(dancing, step))).toEqual([0, 1, 5, 0, 1, 0]);
  });

  it('HUD-90 "from 4" plays 0 to 5, then 4, 5, 4', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((step) => frameAt(cheering, step))).toEqual([
      0, 1, 2, 3, 4, 5, 4, 5, 4,
    ]);
  });

  it('HUD-90 "loop, hold frame 0" holds frame 0 for fps * 3 steps, then 1, 2, 3, then holds again', () => {
    const hold = resting.fps * 3;
    const frames = Array.from({ length: hold + 3 + 2 }, (_, step) => frameAt(resting, step));
    expect(frames.slice(0, hold)).toEqual(Array.from({ length: hold }, () => 0));
    expect(frames.slice(hold, hold + 3)).toEqual([1, 2, 3]);
    expect(frames.slice(hold + 3)).toEqual([0, 0]);
  });

  it('HUD-91 "once" stops on the last frame', () => {
    const turn: StateRow = { row: 5, frames: 3, fps: 12, loop: 'once' };
    expect([0, 1, 2, 3, 9].map((step) => frameAt(turn, step))).toEqual([0, 1, 2, 2, 2]);
  });
});

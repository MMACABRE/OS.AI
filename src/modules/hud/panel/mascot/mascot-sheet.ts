import { z } from 'zod';
import type { SessionActivity } from '@hsos/contracts/channels/claude-link';
import sheetUrl from '../../../../../resources/art/mascot.png?url';
import mapText from '../../../../../resources/art/mascot.json?raw';

/** The mascot's loops (HUD-90) plus the 3-frame turn played between them (HUD-91). */
export const MascotState = z.enum(['dancing', 'waving', 'cheering', 'resting', 'sleeping', 'turn', 'reading', 'working']);
export type MascotState = z.infer<typeof MascotState>;

const StateRow = z.object({
  row: z.number().int().nonnegative(),
  frames: z.number().int().positive(),
  fps: z.number().positive(),
  /** `loop`, `once`, `from <n>` (play once, then loop from frame n), or `loop, hold frame 0` (blink now and then). */
  loop: z.string(),
});
export type StateRow = z.infer<typeof StateRow>;

/** `resources/art/mascot.json`: the frame map of the sprite sheet (HUD-91). */
export const FrameMap = z.object({
  cell: z.number().int().positive(),
  columns: z.number().int().positive(),
  states: z.record(MascotState, StateRow),
});
export type FrameMap = z.infer<typeof FrameMap>;

export type MascotSheet =
  | { readonly kind: 'sheet'; readonly url: string; readonly map: FrameMap; readonly rows: number }
  | { readonly kind: 'placeholder'; readonly problem: string };

/** Reads the bundled frame map; an unreadable one gives the placeholder and the reason (HUD-91). */
export function loadMascotSheet(text: string = mapText, url: string = sheetUrl): MascotSheet {
  try {
    const parsed = FrameMap.safeParse(JSON.parse(text));
    if (!parsed.success) return { kind: 'placeholder', problem: `mascot.json is invalid: ${parsed.error.message}` };
    const rows = Math.max(...Object.values(parsed.data.states).map((state) => state.row)) + 1;
    return { kind: 'sheet', url, map: parsed.data, rows };
  } catch (error) {
    return { kind: 'placeholder', problem: `mascot.json could not be read: ${String(error)}` };
  }
}

/** The page a mascot is drawn on: working loops read on Notes and type on Code (HUD-90). */
export type MascotPage = 'code' | 'notes' | 'other';

/** The loop for a session's activity on a page (HUD-90). `null` means no session. */
export function mascotStateFor(activity: SessionActivity | null, page: MascotPage): MascotState {
  switch (activity) {
    case 'working':
    case 'background':
      return page === 'notes' ? 'reading' : page === 'code' ? 'working' : 'dancing';
    case 'needs-you':
      return 'waving';
    case 'done':
      return 'cheering';
    case 'idle':
      return 'resting';
    default:
      return 'sleeping';
  }
}

/** The frame to show at step `step` of a loop, following its loop rule (HUD-90, HUD-91). */
export function frameAt(row: StateRow, step: number): number {
  const from = /^from (\d+)$/.exec(row.loop);
  if (row.loop === 'once') return Math.min(step, row.frames - 1);
  if (from !== null) {
    const start = Math.min(Number(from[1]), row.frames - 1);
    if (step < row.frames) return step;
    return start + ((step - row.frames) % (row.frames - start));
  }
  if (row.loop.includes('hold frame 0')) {
    // Rest on frame 0 for about three seconds, then blink through the other frames once.
    const hold = Math.round(row.fps * 3);
    const cycle = hold + row.frames - 1;
    const at = step % cycle;
    return at < hold ? 0 : at - hold + 1;
  }
  return step % row.frames;
}

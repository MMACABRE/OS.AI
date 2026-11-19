import { useEffect, useRef, useState } from 'react';
import type { SessionActivity } from '@hsos/contracts/channels/claude-link';
import { useReducedMotion } from '@hsos/ui-kit';
import { frameAt, loadMascotSheet, mascotStateFor } from './mascot-sheet';
import type { MascotPage, MascotState } from './mascot-sheet';
import styles from './Mascot.module.css';

const SHEET = loadMascotSheet();
let reportProblem: (problem: string) => void = () => undefined;
let reported = false;

/** Where a missing or unreadable sprite sheet is recorded (HUD-91); the HUD sets it at register. */
export function setMascotProblemReporter(report: (problem: string) => void): void {
  reportProblem = report;
}

const report = (problem: string) => {
  if (reported) return;
  reported = true;
  reportProblem(problem);
};

export type MascotProps = {
  /** The session's activity, or null when there is no session (sleeping). */
  readonly activity: SessionActivity | null;
  readonly page: MascotPage;
  /** 2 draws the 16 px cell at 32 px (the ribbon); 1 at 16 px (a subagent, HUD-92). */
  readonly scale: 1 | 2;
  /** Forces a loop, for a subagent that dances while it runs (HUD-92). */
  readonly state?: MascotState;
};

/**
 * The strawberry mascot (HUD-90): a 16 by 16 cell of the sprite sheet at a whole-number scale with
 * pixelated scaling. A change of state plays the 3-frame turn first (HUD-91). Under reduced motion each
 * state shows its first frame and nothing loops (HUD-93). It is decorative and has no accessible name.
 */
export function Mascot({ activity, page, scale, state }: MascotProps) {
  const target = state ?? mascotStateFor(activity, page);
  const reduced = useReducedMotion();
  const strip = useRef<HTMLImageElement>(null);
  const shown = useRef<MascotState | null>(null);
  const [broken, setBroken] = useState(SHEET.kind === 'placeholder');

  useEffect(() => {
    if (SHEET.kind === 'placeholder') report(SHEET.problem);
  }, []);

  useEffect(() => {
    if (SHEET.kind !== 'sheet' || broken) return undefined;
    const { map } = SHEET;
    const draw = (name: MascotState, frame: number) => {
      const row = map.states[name];
      const image = strip.current;
      if (image === null) return;
      // One cell is 16 px, 1rem; rem keeps the frame aligned when the ui scale changes the root size.
      const cell = (map.cell / 16) * scale;
      image.style.transform = `translate(${-frame * cell}rem, ${-row.row * cell}rem)`;
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    const play = (name: MascotState, step: number, then: (() => void) | null) => {
      const row = map.states[name];
      if (then !== null && step >= row.frames) {
        then();
        return;
      }
      draw(name, frameAt(row, step));
      timer = setTimeout(() => play(name, step + 1, then), 1000 / row.fps);
    };
    if (reduced) draw(target, 0);
    else if (shown.current !== null && shown.current !== target) play('turn', 0, () => play(target, 0, null));
    else play(target, 0, null);
    shown.current = target;
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [target, reduced, scale, broken]);

  const size = scale === 2 ? styles.large : styles.small;
  if (SHEET.kind === 'placeholder' || broken)
    return (
      <span className={`${styles.mascot} ${size} ${styles.placeholder}`} aria-hidden="true" data-mascot={target}>
        <span className={styles.blockA} />
        <span className={styles.blockB} />
      </span>
    );
  return (
    <span className={`${styles.mascot} ${size}`} aria-hidden="true" data-mascot={target}>
      <img
        ref={strip}
        className={scale === 2 ? styles.strip2 : styles.strip1}
        src={SHEET.url}
        alt=""
        draggable={false}
        onError={() => {
          report('resources/art/mascot.png could not be loaded');
          setBroken(true);
        }}
      />
    </span>
  );
}

import type { Clock } from '@hsos/contracts/module';
import type { EpochMs } from '@hsos/contracts/ids';

export type FakeClock = Clock & {
  /** Moves time forward, running every timer that falls due, in order. */
  advance(ms: number): void;
};

type Timer = { at: number; callback: () => void; every: number | null; id: number };

/** A `Clock` that only moves when told to. */
export function createFakeClock(start = 0): FakeClock {
  let now = start;
  let nextId = 0;
  let timers: Timer[] = [];
  const add = (ms: number, callback: () => void, every: number | null) => {
    const timer = { at: now + ms, callback, every, id: nextId++ };
    timers.push(timer);
    return () => {
      timers = timers.filter((item) => item.id !== timer.id);
    };
  };
  return {
    now: () => brandEpoch(now),
    after: (ms, callback) => add(ms, callback, null),
    every: (ms, callback) => add(ms, callback, ms),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (due === undefined) break;
        now = due.at;
        if (due.every === null) timers = timers.filter((timer) => timer.id !== due.id);
        else due.at += due.every;
        due.callback();
      }
      now = end;
    },
  };
}

function brandEpoch(value: number): EpochMs {
  const parsed: unknown = value;
  return isEpoch(parsed) ? parsed : brandEpoch(0);
}

function isEpoch(value: unknown): value is EpochMs {
  return typeof value === 'number';
}

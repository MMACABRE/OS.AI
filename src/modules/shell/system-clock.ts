import type { EpochMs } from '@hsos/contracts/ids';
import type { Clock } from '@hsos/contracts/module';

function epoch(value: number): EpochMs {
  const branded: unknown = value;
  return isEpoch(branded) ? branded : epoch(0);
}

function isEpoch(value: unknown): value is EpochMs {
  return typeof value === 'number';
}

/** The real clock, for production code. Tests use tests/fakes/fake-clock.ts. */
export const systemClock: Clock = {
  now: () => epoch(Date.now()),
  after(ms, callback) {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
  every(ms, callback) {
    const timer = setInterval(callback, ms);
    return () => clearInterval(timer);
  },
};

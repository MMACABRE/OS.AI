import type { ProcessHealth, ProcessName } from '@hsos/contracts/channels/diagnostics';
import type { EpochMs } from '@hsos/contracts/ids';

/**
 * One live process as main sees it, in the shape of Electron's `app.getAppMetrics()` rows:
 * `workingSetKb` is `memory.workingSetSize` (kilobytes), `createdAt` is `creationTime`.
 */
export type ProcessMetric = {
  readonly process: ProcessName;
  readonly pid: number;
  readonly workingSetKb: number;
  readonly createdAt: EpochMs;
};

/** The `getHealth` rows: pid, resident memory in MB and uptime of each live process (DIAG-9). */
export function toHealth(metrics: readonly ProcessMetric[], now: EpochMs): ProcessHealth[] {
  return metrics.map((metric) => ({
    process: metric.process,
    pid: metric.pid,
    memoryMb: Math.round((metric.workingSetKb / 1024) * 10) / 10,
    uptimeMs: Math.max(0, now - metric.createdAt),
  }));
}

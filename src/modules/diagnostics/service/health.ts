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

/** The fields of Electron's `app.getAppMetrics()` rows that main reads (DIAG-9). */
export type AppMetricRow = {
  readonly type: string;
  /** Electron's name for the process: a utility process is named after its service ("workspace-service"). */
  readonly name?: string | undefined;
  /** Chromium's service name (for a utility process, the mojom interface); not the service's name. */
  readonly serviceName?: string | undefined;
  readonly pid: number;
  readonly memory: { readonly workingSetSize: number };
  readonly creationTime: number;
};

/**
 * Maps the app's metrics to the processes `getHealth` reports: the browser process is `main`, a utility
 * process is the service of its name, and the window's page process is `ui` (DIAG-9). Other processes are left out.
 */
export function processMetricsFrom(
  rows: readonly AppMetricRow[],
  uiPid: number | undefined,
  services: readonly string[],
): ProcessMetric[] {
  return rows.flatMap((row): ProcessMetric[] => {
    const service = services.find((name) => name === row.name);
    const process: ProcessName | null =
      row.type === 'Browser'
        ? 'main'
        : row.type === 'Utility' && service !== undefined
          ? (service as ProcessName)
          : row.type === 'Tab' && row.pid === uiPid
            ? 'ui'
            : null;
    if (process === null) return [];
    return [
      {
        process,
        pid: row.pid,
        workingSetKb: row.memory.workingSetSize,
        createdAt: row.creationTime as EpochMs,
      },
    ];
  });
}

/** The `getHealth` rows: pid, resident memory in MB and uptime of each live process (DIAG-9). */
export function toHealth(metrics: readonly ProcessMetric[], now: EpochMs): ProcessHealth[] {
  return metrics.map((metric) => ({
    process: metric.process,
    pid: metric.pid,
    memoryMb: Math.round((metric.workingSetKb / 1024) * 10) / 10,
    uptimeMs: Math.max(0, now - metric.createdAt),
  }));
}

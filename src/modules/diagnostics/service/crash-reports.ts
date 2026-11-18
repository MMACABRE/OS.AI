import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogRecord, ProcessName } from '@hsos/contracts/channels/diagnostics';
import type { EpochMs } from '@hsos/contracts/ids';
import { readRecent } from './file-logger';

/** Records of the dead process kept in its crash file (DIAG-7, architecture §8). */
export const CRASH_RECORDS = 200;
export const CRASH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const CRASH_MAX_FILES = 50;

export type CrashReport = {
  readonly process: ProcessName;
  readonly exitCode: number;
  readonly time: EpochMs;
  readonly appVersion: string;
  readonly records: readonly LogRecord[];
};

export type CrashDeath = {
  readonly process: ProcessName;
  readonly exitCode: number;
  readonly time: EpochMs;
  readonly appVersion: string;
};

/** `crashDir\<time>-<process>.json`, the time in epoch milliseconds so names sort by age. */
export function crashFileName(time: EpochMs, process: ProcessName): string {
  return `${time}-${process}.json`;
}

/**
 * Writes the crash file of one death with the last 200 records of that process (DIAG-7).
 * Returns the file's path, or null when it could not be written; it never throws.
 */
export async function writeCrashReport(
  paths: { readonly crashDir: string; readonly logsDir: string },
  death: CrashDeath,
): Promise<string | null> {
  try {
    const records = await readRecent(paths.logsDir, death.process, CRASH_RECORDS);
    const report: CrashReport = { ...death, records };
    await mkdir(paths.crashDir, { recursive: true });
    const file = join(paths.crashDir, crashFileName(death.time, death.process));
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return file;
  } catch {
    return null;
  }
}

async function crashTime(crashDir: string, name: string): Promise<number> {
  const fromName = Number(name.split('-')[0]);
  if (Number.isFinite(fromName) && fromName > 0) return fromName;
  return stat(join(crashDir, name)).then(
    (stats) => stats.mtimeMs,
    () => 0,
  );
}

/** Removes crash files older than 30 days, then all but the newest 50 (DIAG-10). Returns how many were removed. */
export async function cleanCrashReports(crashDir: string, now: EpochMs): Promise<number> {
  const names = await readdir(crashDir).catch(() => [] as string[]);
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => ({ name, time: await crashTime(crashDir, name) })),
  );
  files.sort((a, b) => b.time - a.time);
  const doomed = files.filter(
    (file, index) => now - file.time > CRASH_MAX_AGE_MS || index >= CRASH_MAX_FILES,
  );
  await Promise.all(
    doomed.map((file) => rm(join(crashDir, file.name), { force: true }).catch(() => undefined)),
  );
  return doomed.length;
}

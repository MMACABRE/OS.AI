import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import type { EpochMs } from '@hsos/contracts/ids';
import {
  cleanCrashReports,
  crashFileName,
  writeCrashReport,
} from '../../src/modules/diagnostics/service/crash-reports';
import type { CrashReport } from '../../src/modules/diagnostics/service/crash-reports';
import { createFileLogger } from '../../src/modules/diagnostics/service/file-logger';
import { toHealth } from '../../src/modules/diagnostics/service/health';
import {
  processDeathReporters,
  processMetricsSources,
  register,
} from '../../src/modules/diagnostics/register.service';
import {
  createContributionStore,
  createDataPaths,
  createServiceContext,
} from '../../src/modules/shell/loader/service-context';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';

const DAY = 24 * 60 * 60 * 1000;
const silent = { log: () => undefined };
/** A branded timestamp, made the way the code under test gets it: from a clock. */
const epoch = (ms: number): EpochMs => createFakeClock(ms).now();

let root = '';
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'hsos-crash-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function waitFor<T>(read: () => Promise<T | null>): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timed out');
}

describe('crash reports', () => {
  it('DIAG-7 a crash file holds exactly the last 200 records, the exit code, time and app version', async () => {
    const logsDir = join(root, 'logs');
    const crashDir = join(root, 'crash');
    const logger = createFileLogger({ process: 'pty-host', logsDir, clock: createFakeClock(1_000) });
    for (let index = 1; index <= 300; index += 1) logger.log('info', `event${index}`);
    await logger.flush();

    const time = epoch(1_700_000_000_000);
    const file = await writeCrashReport(
      { crashDir, logsDir },
      { process: 'pty-host', exitCode: 3, time, appVersion: '0.1.0' },
    );

    expect(file).toBe(join(crashDir, '1700000000000-pty-host.json'));
    expect(crashFileName(time, 'pty-host')).toBe('1700000000000-pty-host.json');
    const report: CrashReport = JSON.parse(
      await readFile(join(crashDir, '1700000000000-pty-host.json'), 'utf8'),
    );
    expect(report.process).toBe('pty-host');
    expect(report.exitCode).toBe(3);
    expect(report.time).toBe(1_700_000_000_000);
    expect(report.appVersion).toBe('0.1.0');
    expect(report.records).toHaveLength(200);
    expect(report.records[0]?.event).toBe('event101');
    expect(report.records[199]?.event).toBe('event300');
    await logger.close();
  });

  it('DIAG-7 a death of a process that never logged still gets a crash file with no records', async () => {
    const crashDir = join(root, 'crash');
    await writeCrashReport(
      { crashDir, logsDir: join(root, 'logs') },
      { process: 'link-service', exitCode: 70, time: epoch(5), appVersion: '0.1.0' },
    );
    const report: CrashReport = JSON.parse(await readFile(join(crashDir, '5-link-service.json'), 'utf8'));
    expect(report.records).toEqual([]);
    expect(report.exitCode).toBe(70);
  });

  it('DIAG-7 writeCrashReport never throws when the crash folder cannot be made', async () => {
    const blocker = join(root, 'file');
    await writeFile(blocker, 'x', 'utf8');
    const result = await writeCrashReport(
      { crashDir: join(blocker, 'inside'), logsDir: root },
      { process: 'main', exitCode: 1, time: epoch(1), appVersion: '0.1.0' },
    );
    expect(result).toBeNull();
  });

  it('DIAG-10 60 crash files with 5 of them 40 days old leave 50, none older than 30 days', async () => {
    const crashDir = join(root, 'crash');
    await mkdir(crashDir, { recursive: true });
    const now = 1_700_000_000_000;
    for (let index = 0; index < 55; index += 1)
      await writeFile(join(crashDir, `${now - (index + 1) * 60_000}-pty-host.json`), '{}', 'utf8');
    for (let index = 0; index < 5; index += 1)
      await writeFile(join(crashDir, `${now - 40 * DAY - index}-pty-host.json`), '{}', 'utf8');

    const removed = await cleanCrashReports(crashDir, epoch(now));

    const left = await readdir(crashDir);
    expect(left).toHaveLength(50);
    expect(removed).toBe(10);
    for (const name of left) expect(now - Number(name.split('-')[0])).toBeLessThanOrEqual(30 * DAY);
  });

  it('DIAG-10 a missing crash folder removes nothing and does not throw', async () => {
    expect(await cleanCrashReports(join(root, 'none'), epoch(1))).toBe(0);
  });

  it('DIAG-10 old files go even when fewer than 50 remain', async () => {
    const crashDir = join(root, 'crash');
    await mkdir(crashDir, { recursive: true });
    const now = 1_700_000_000_000;
    await writeFile(join(crashDir, `${now - 31 * DAY}-main.json`), '{}', 'utf8');
    await writeFile(join(crashDir, `${now - 29 * DAY}-main.json`), '{}', 'utf8');
    await cleanCrashReports(crashDir, epoch(now));
    expect(await readdir(crashDir)).toEqual([`${now - 29 * DAY}-main.json`]);
  });

  it('DIAG-9 toHealth turns a working set of 2 048 KB into 2 MB and uptime into now minus createdAt', () => {
    const rows = toHealth(
      [{ process: 'pty-host', pid: 42, workingSetKb: 2_048, createdAt: epoch(1_000) }],
      epoch(6_000),
    );
    expect(rows).toEqual([{ process: 'pty-host', pid: 42, memoryMb: 2, uptimeMs: 5_000 }]);
  });
});

describe('crash reports, wiring', () => {
  function diagnostics(clockStart = 1_700_000_000_000) {
    const clock = createFakeClock(clockStart);
    const bus = createFakeBus(clock);
    const store = createContributionStore();
    const paths = createDataPaths(join(root, 'cfg'), join(root, 'loc'));
    const ctx = createServiceContext('diagnostics', {
      bus,
      clock,
      paths,
      store,
      logFor: () => silent,
      onStop: () => undefined,
    });
    register(ctx);
    return { bus, store, paths, clock };
  }

  it('DIAG-7 diagnostics contributes one death reporter and calling it writes a crash file', async () => {
    const { store, paths } = diagnostics();
    const logger = createFileLogger({
      process: 'workspace-service',
      logsDir: paths.logsDir,
      clock: createFakeClock(1_000),
    });
    logger.log('error', 'before_death');
    await logger.flush();

    const reporters = store.contributions(processDeathReporters);
    expect(reporters).toHaveLength(1);
    reporters[0]?.({ process: 'workspace-service', exitCode: 9, appVersion: '0.1.0' });

    const file = join(paths.crashDir, '1700000000000-workspace-service.json');
    const report: CrashReport = JSON.parse(await waitFor(() => readFile(file, 'utf8').catch(() => null)));
    expect(report.exitCode).toBe(9);
    expect(report.records.map((record) => record.event)).toEqual(['before_death']);
    await logger.close();
  });

  it('DIAG-10 registering diagnostics removes crash files older than 30 days', async () => {
    const crashDir = join(root, 'loc', 'crash');
    await mkdir(crashDir, { recursive: true });
    const now = 1_700_000_000_000;
    await writeFile(join(crashDir, `${now - 40 * DAY}-main.json`), '{}', 'utf8');
    diagnostics(now);
    await waitFor(async () => ((await readdir(crashDir)).length === 0 ? true : null));
  });

  it('DIAG-9 getHealth returns the rows of a contributed fake metrics source', async () => {
    const { bus, store, clock } = diagnostics(10_000);
    store.contribute(processMetricsSources, () => [
      { process: 'main', pid: 1, workingSetKb: 1_024, createdAt: epoch(4_000) },
      { process: 'pty-host', pid: 2, workingSetKb: 4_096, createdAt: epoch(9_000) },
    ]);

    const result = await bus.call(diagnosticsChannels.getHealth, {});

    expect(clock.now()).toBe(10_000);
    expect(result.ok ? result.value : null).toEqual([
      { process: 'main', pid: 1, memoryMb: 1, uptimeMs: 6_000 },
      { process: 'pty-host', pid: 2, memoryMb: 4, uptimeMs: 1_000 },
    ]);
  });
});

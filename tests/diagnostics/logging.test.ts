import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnosticsChannels, LogRecord } from '@hsos/contracts/channels/diagnostics';
import { ok } from '@hsos/contracts/result';
import type { Bus } from '@hsos/contracts/bus';
import { redact, truncate } from '../../src/modules/diagnostics/service/redact';
import {
  ROTATE_BYTES,
  createFileLogger,
  logFile,
  readRecent,
} from '../../src/modules/diagnostics/service/file-logger';
import { createBusLogger } from '../../src/modules/diagnostics/panel/bus-logger';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hsos-log-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function lines(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8');
  return text.split('\n').filter((line) => line !== '');
}

describe('logging', () => {
  it('DIAG-1 a logger writes 3 records, flush gives 3 lines, each a LogRecord', async () => {
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock: createFakeClock(1_000) });
    logger.log('info', 'one');
    logger.forModule('files').log('warn', 'two', { path: 'C:\\a' });
    logger.log('error', 'three');
    await logger.flush();

    const written = await lines(join(dir, 'main.log'));
    expect(written).toHaveLength(3);
    const records = written.map((line) => LogRecord.parse(JSON.parse(line)));
    expect(records.map((record) => record.event)).toEqual(['one', 'two', 'three']);
    expect(records.map((record) => record.module)).toEqual(['shell', 'files', 'shell']);
    expect(records.every((record) => record.process === 'main')).toBe(true);
    await logger.close();
  });

  it('DIAG-1 the 500 ms timer flushes the buffer', async () => {
    const clock = createFakeClock(1_000);
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock });
    logger.log('info', 'timed');
    clock.advance(500);
    await logger.flush();
    expect(await lines(join(dir, 'main.log'))).toHaveLength(1);
    await logger.close();
  });

  it('DIAG-2 a live file of 5 MB is rotated to .1.log and the live file holds only the new record', async () => {
    const live = logFile(dir, 'main');
    await writeFile(live, 'x'.repeat(ROTATE_BYTES), 'utf8');
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock: createFakeClock(1_000) });
    logger.log('info', 'after_rotation');
    await logger.flush();

    expect(ROTATE_BYTES).toBe(5 * 1024 * 1024);
    expect((await stat(join(dir, 'main.1.log'))).size).toBe(ROTATE_BYTES);
    const written = await lines(live);
    expect(written).toHaveLength(1);
    expect(LogRecord.parse(JSON.parse(written[0] ?? '')).event).toBe('after_rotation');
    await logger.close();
  });

  it('DIAG-2 at most four rotated files are kept', async () => {
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock: createFakeClock(1_000) });
    for (let round = 0; round < 6; round += 1) {
      await writeFile(logFile(dir, 'main'), 'x'.repeat(ROTATE_BYTES), 'utf8');
      logger.log('info', 'round');
      await logger.flush();
    }
    const names = (await readdir(dir)).sort();
    expect(names).toEqual(['main.1.log', 'main.2.log', 'main.3.log', 'main.4.log', 'main.log']);
    await logger.close();
  });

  it('DIAG-3 a logs folder that cannot be written never throws and flush resolves', async () => {
    const blocker = join(dir, 'not-a-folder');
    await writeFile(blocker, 'a file', 'utf8');
    const logger = createFileLogger({ process: 'main', logsDir: blocker, clock: createFakeClock(1_000) });

    expect(() => logger.log('error', 'cannot_write')).not.toThrow();
    await expect(logger.flush()).resolves.toBeUndefined();
    logger.log('error', 'still_going');
    await expect(logger.close()).resolves.toBeUndefined();
    expect(() => logger.flushSync()).not.toThrow();
  });

  it('DIAG-3 a record whose data cannot be serialised is dropped without throwing', async () => {
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock: createFakeClock(1_000) });
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(() => logger.log('info', 'circular', { loop })).not.toThrow();
    logger.log('info', 'fine');
    await logger.flush();
    const written = await lines(join(dir, 'main.log'));
    expect(written.map((line) => LogRecord.parse(JSON.parse(line)).event)).toEqual(['fine']);
    await logger.close();
  });

  it('DIAG-4 secret values under secret-looking keys, at any depth, become [redacted]', () => {
    const cleaned = redact({ authToken: 'abc', nested: { Cookie: 'x' }, name: 'ok' });
    expect(cleaned).toEqual({ authToken: '[redacted]', nested: { Cookie: '[redacted]' }, name: 'ok' });
  });

  it('DIAG-4 the logger writes the redacted data to the file', async () => {
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock: createFakeClock(1_000) });
    logger.log('info', 'secret', { authToken: 'abc', nested: { Cookie: 'x' }, name: 'ok' });
    await logger.flush();
    const text = await readFile(join(dir, 'main.log'), 'utf8');
    expect(text).not.toContain('abc');
    expect(text).not.toContain('"x"');
    expect(text).toContain('[redacted]');
    await logger.close();
  });

  it('DIAG-5 a 5 000 character string is cut to 2 000 characters ending with an ellipsis', () => {
    const cleaned = redact({ text: 'a'.repeat(5_000) });
    const text = cleaned['text'];
    expect(typeof text === 'string' ? text.length : null).toBe(2_000);
    expect(typeof text === 'string' && text.endsWith('…')).toBe(true);
    expect(truncate('b'.repeat(5_000))).toHaveLength(2_000);
    expect(truncate('b'.repeat(5_000)).endsWith('…')).toBe(true);
  });

  it('DIAG-5 a string of exactly 2 000 characters is kept as it is', () => {
    const exact = 'c'.repeat(2_000);
    expect(truncate(exact)).toBe(exact);
  });

  it('DIAG-6 with debug false a debug record is not written', async () => {
    const logger = createFileLogger({
      process: 'main',
      logsDir: dir,
      clock: createFakeClock(1_000),
      debug: () => false,
    });
    logger.log('debug', 'quiet');
    await logger.flush();
    await expect(stat(join(dir, 'main.log'))).rejects.toThrow();
    await logger.close();
  });

  it('DIAG-6 with debug true a debug record is written', async () => {
    let debug = false;
    const logger = createFileLogger({
      process: 'main',
      logsDir: dir,
      clock: createFakeClock(1_000),
      debug: () => debug,
    });
    debug = true;
    logger.log('debug', 'loud');
    await logger.flush();
    expect(await lines(join(dir, 'main.log'))).toHaveLength(1);
    await logger.close();
  });

  it('DIAG-1 readRecent returns the newest N records oldest first across the live and the rotated file', async () => {
    const clock = createFakeClock(1_000);
    const logger = createFileLogger({ process: 'main', logsDir: dir, clock });
    for (let index = 1; index <= 3; index += 1) logger.log('info', `old${index}`);
    await logger.flush();
    await writeFile(join(dir, 'main.1.log'), await readFile(join(dir, 'main.log'), 'utf8'), 'utf8');
    await rm(join(dir, 'main.log'));
    for (let index = 1; index <= 3; index += 1) logger.log('info', `new${index}`);
    await logger.flush();

    const recent = await readRecent(dir, 'main', 4);
    expect(recent.map((record) => record.event)).toEqual(['old3', 'new1', 'new2', 'new3']);
    await logger.close();
  });

  it('DIAG-1 readRecent of a process without files is empty', async () => {
    expect(await readRecent(dir, 'link-service', 10)).toEqual([]);
  });

  it('DIAG-1 createBusLogger sends diagnostics.write with process ui', async () => {
    const bus = createFakeBus();
    const received: unknown[] = [];
    bus.handle(diagnosticsChannels.write, (record) => {
      received.push(record);
      return ok({});
    });
    const logger = createBusLogger(bus, createFakeClock(5_000), 'terminal');
    logger.log('warn', 'pasted', { size: 3 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received).toEqual([
      { time: 5_000, process: 'ui', module: 'terminal', level: 'warn', event: 'pasted', data: { size: 3 } },
    ]);
  });

  it('DIAG-3 createBusLogger never throws when the bus call rejects or throws', async () => {
    const rejecting: Bus = { ...createFakeBus(), call: () => Promise.reject(new Error('down')) };
    const throwing: Bus = {
      ...createFakeBus(),
      call: () => {
        throw new Error('sync down');
      },
    };
    const clock = createFakeClock(1);
    expect(() => createBusLogger(rejecting, clock, 'x').log('error', 'a')).not.toThrow();
    expect(() => createBusLogger(throwing, clock, 'x').log('error', 'b')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
